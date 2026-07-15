# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Start both json-server (port 3000) and Angular dev server (port 4200)
npm run dev

# Start individually
npm run start:server   # json-server only
npm run start:app      # Angular only

# Build
npm run build

# Type-check without emitting
npx tsc --noEmit -p tsconfig.app.json

# Run tests
npm test
```

The Angular dev server proxies `/api/*` → `http://localhost:3000` (json-server) via `proxy.conf.json`. Both must run together for the app to work. json-server reads `db.json` at startup — restart it after editing `db.json`.

## Architecture

### Data layer
All mock data lives in `db.json` (root). json-server exposes it as REST endpoints: `/api/assets`, `/api/platforms`, `/api/wells`, `/api/pmRecords`, `/api/wellAnnulusRecords`, `/api/wellRemarks`. The schema is **flat** — assets, platforms, and wells are separate collections linked by IDs (`assetId`, `platformId`), not nested.

All types are in `src/app/core/models/well-integrity.models.ts` — the single source of truth for interfaces and union types used across the whole app.

### Services pattern
Services in `src/app/core/services/` use two distinct patterns:

- **`WellService`**: data loaded once via `toSignal(http.get(...), { initialValue: [] })` at construction. Exposes `selectedAssetId/PlatformId/WellId` writable signals and `filteredPlatforms/filteredWells` computed signals for cascading dropdowns. Calling `selectAsset()` cascades resets downstream.
- **`PmService` / `WellDataService`**: data loaded on demand via `loadAll()` / `loadByWell()` which mutate a private `signal<T>`. Write operations (`addRecord`, `upsertAnnulus`) return `Observable<T>` and call the load method inside `tap()` to refresh the signal after the API write. `WellDataService` has two parallel APIs: `record` / `loadByWell` (single-well, used by the well-data page) and `allRecords` / `loadAll` (all wells, used by the report page).
- **`WellRemarkService`**: loads and upserts `WellRemark` records (`/api/wellRemarks`). `upsert(wellId, data)` does PUT if a record exists for the well, POST otherwise, then calls `loadAll()` in `tap()` to refresh.
- **`ReportService`**: pure computation — no HTTP calls. Reads from the other services' signals synchronously. `generateWellStatusRow(wellId)` returns a `WellStatusRow` for the multi-well report table. `generateReport(wellId)` returns the single-well `WellIntegrityReport` used by the export flow. Both are safe to call inside `computed()`.
- **`ExportService`**: browser-only CSV download. Guards `document` access with `isPlatformBrowser(PLATFORM_ID)`.

### Report page (`src/app/features/report/`)
Two-panel layout: left WellTree + right content.

**WellTree** (`well-tree/well-tree.ts`): hierarchical asset → platform → well selector. Ctrl/Cmd+click for multi-select. Emits `selectionChange: EventEmitter<Set<string>>`. Click on asset selects all its wells; click on platform selects all its wells.

**Report component** has two tabs controlled by `activeTab = signal<'status' | 'schedule'>`:
- **Status Report**: interactive SVG donut chart (click slice to filter table) + multi-well integrity status table with traffic-light dots (WH, XT, THGR, DHSV, A/B Barrier, TBG, Combined, Ann. P, MOC, Final) + editable Issue/Action/Remark columns saved via `WellRemarkService`.
- **PM Schedule**: month-filter pills (Overdue / month buckets) + schedule table sorted by `nextPmDate` ascending with due-date badges (1/2/3 months, overdue).

Export CSV respects the active tab: status tab exports integrity columns; schedule tab exports scheduling columns.

**Fixed save bar** appears on both tabs. Shows dirty-row count and triggers `forkJoin` bulk upsert via `WellRemarkService`.

**Donut chart**: SVG built with `buildDonutPath()`. Full-circle (100% one status) uses a `<circle stroke>` element to avoid compound-path fill-rule issues. Slices use `fill-rule="evenodd"` paths for partial arcs.

### Well-data page (`src/app/features/well-data/`)
Three annulus tabs (A, B, C) always rendered in the DOM with `[class.hidden]` (not `@if`) so `@ViewChildren(AnnulusTab)` always finds all three. Cross-annulus status (B/C barrier depends on A-annulus TOC and B-annulus shoeDepth) is computed in the parent `WellDataForm` and passed as `[annulusStatus]` input to each `AnnulusTab`.

### Status computation (`ReportService` exported functions)
- `computeWhStatus(wh)`: packoff leak → fail; annulus valve both fail → fail; one fail → warning
- `computeXtStatus(xt)`: any valve both leakTest+fnTest fail → fail; either → warning
- `computeThgrStatus(wh)`: any tubing-hanger port leak → fail
- `computeDhsvStatus(tubing)`: both tests fail → fail; either → warning
- `computeTbgStatus(tubing)`: `currentStatus === 'Fail'` → fail
- `computeAnnPressureStatus(annP)`: `currentPressure / tow > 1` → fail; `> 0.85` → warning; worst of A/B/C
- `worstStatus(...statuses)`: rank order fail > warning > no-data > pass
- `computeAnnulusStatus` (exported from `well-data.service.ts`): barrier status from TOC/cblToc/shoeDepth geometry

### UI patterns
- **All routes are `RenderMode.Client`** (`app.routes.server.ts`) — prerendering is disabled because pages depend on a running json-server.
- Feature pages are lazy-loaded via `loadComponent`.
- The shell (`layout/shell/shell.ts`) provides the fixed sidebar + scrollable main layout. The `App` root component is just `<router-outlet />`.
- Cascading well selectors are **not** a shared component — each page implements its own `<select>` elements wired to `wellService.selectAsset/Platform/Well()` via `(change)` events. This is intentional.
- Dynamic Tailwind classes must be complete strings (not assembled fragments) so the JIT scanner can detect them. Use `[class]="'base-classes ' + dynamicClass()"` — never string interpolation inside the `class` attribute.
- Dates are stored and passed as ISO strings (`YYYY-MM-DD`), never as `Date` objects. The `DateFormatPipe` formats them for display using `Intl.DateTimeFormat`.
- Template visibility: use `[class.hidden]` instead of `@if` when child components must always exist in the DOM (e.g., for `@ViewChildren` to find them).
- Angular `NG8107`: avoid `?.` on non-nullable types in templates (`computed()` signals always return their typed value, never null).
- Angular `NG8113`: unused component imports in `imports: []` cause build errors — remove any component not referenced in the template.

### Integrity rules (ReportService)
- `mopVsMaspStatus`: `no-data` if either null, `fail` if MOP > MASP, otherwise `pass`
- `mespVsMaspStatus`: `no-data` if either null, `fail` if MESP > MASP, `warning` if MESP/MASP > 0.85, otherwise `pass`
- Overall status is the worst across both checks per annulus, then across all three annuli
- `finalStatus` on `WellStatusRow` = worst of extIntCombined and annulusPressure. Any `no-data` component propagates upward — a well needs both a PM record with `inspectionData` AND a `wellAnnulusRecord` to avoid `no-data`.

## Constraints

- **Strict TypeScript** (`strict: true`, `strictTemplates: true`). No `any`.
- **Standalone components only** — no NgModules.
- **State via Angular signals** (`signal`, `computed`, `toSignal`). RxJS is used only for `HttpClient` Observables and `tap()` side-effects.
- **Reactive Forms** for all form inputs; `FormControl<T>` with explicit generics.
- `withFetch()` on `provideHttpClient()` is required for SSR compatibility — don't remove it even though all routes are currently `RenderMode.Client`.
- Prettier config: 100-char print width, single quotes, `angular` HTML parser.
- Template-accessible members must be `protected` (not `private`) — Angular's strict template compiler enforces this.
