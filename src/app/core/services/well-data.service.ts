import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import {
  AnnulusData,
  AnnulusFormValue,
  AnnulusType,
  CompletionType,
  IntegrityStatus,
  WellAnnulusRecord,
  WellConfigFormValue,
} from '../models/well-integrity.models';

function emptyAnnulus(type: AnnulusType): AnnulusData {
  return { annulusType: type, toc: null, cblToc: null, shoeDepth: null, masp: null, mop: null, tow: null, updatedAt: '', updatedBy: '' };
}

// aAnnVolToc / aAnnCblToc = A-annulus TOC values (used for all annulus types in Monobore).
// bAnnShoeDepth = B-annulus shoe depth, used as "Previous Shoe Depth" to determine
// whether only A-annulus is required (perforations below B-casing shoe → A is sufficient barrier).
export function computeAnnulusStatus(
  annulusType: AnnulusType,
  completionType: CompletionType,
  topPerforation: number | null,
  aAnnVolToc: number | null,
  aAnnCblToc: number | null,
  bAnnShoeDepth: number | null,
  margins: { cblTocMargin: number; volTocMargin: number } = { cblTocMargin: 30, volTocMargin: 50 },
): IntegrityStatus {
  if (completionType === 'Conventional') return 'pass';

  // Monobore: TOC condition based on A-annulus values
  const tocCondition =
    (topPerforation != null && aAnnCblToc != null && topPerforation >= aAnnCblToc + margins.cblTocMargin) ||
    (topPerforation != null && aAnnVolToc != null && topPerforation >= aAnnVolToc + margins.volTocMargin);

  if (annulusType === 'A') {
    if (topPerforation == null || (aAnnCblToc == null && aAnnVolToc == null)) return 'no-data';
    return tocCondition ? 'pass' : 'fail';
  }

  // B and C: Good only when "only A-ann required" (tocCondition AND topPerf > B-shoe)
  const shoeCondition = topPerforation != null && bAnnShoeDepth != null && topPerforation > bAnnShoeDepth;
  return tocCondition && shoeCondition ? 'pass' : 'no-data';
}

@Injectable({ providedIn: 'root' })
export class WellDataService {
  private readonly http = inject(HttpClient);

  private readonly _record = signal<WellAnnulusRecord | null>(null);
  readonly record = this._record.asReadonly();

  private readonly _allRecords = signal<WellAnnulusRecord[]>([]);
  readonly allRecords = this._allRecords.asReadonly();

  loadAll(): void {
    this.http.get<WellAnnulusRecord[]>('/api/wellAnnulusRecords').subscribe(records => {
      this._allRecords.set(records);
    });
  }

  clear(): void {
    this._record.set(null);
  }

  loadByWell(wellId: string): void {
    this.http.get<WellAnnulusRecord[]>(`/api/wellAnnulusRecords?wellId=${wellId}`).subscribe(records => {
      this._record.set(records[0] ?? null);
    });
  }

  saveAll(
    wellId: string,
    config: WellConfigFormValue,
    annuliValues: Record<AnnulusType, AnnulusFormValue>,
  ): Observable<WellAnnulusRecord> {
    const now = new Date().toISOString();
    const updatedBy = annuliValues.A.updatedBy || annuliValues.B.updatedBy || annuliValues.C.updatedBy || '';

    const buildAnnulus = (type: AnnulusType, val: AnnulusFormValue): AnnulusData => {
      const existing = this._record()?.annuli[type];
      return {
        annulusType: type,
        toc: val.toc,
        cblToc: val.cblToc,
        shoeDepth: val.shoeDepth,
        masp: val.masp,
        mop: val.mop,
        tow: val.tow,
        updatedAt: now,
        updatedBy: val.updatedBy || existing?.updatedBy || '',
      };
    };

    const existing = this._record();
    const annuli: Record<AnnulusType, AnnulusData> = {
      A: buildAnnulus('A', annuliValues.A),
      B: buildAnnulus('B', annuliValues.B),
      C: buildAnnulus('C', annuliValues.C),
    };

    if (existing) {
      const body: WellAnnulusRecord = {
        ...existing,
        completionType: config.completionType,
        mocElements: config.mocElements,
        overrideNextPmMonths: config.overrideNextPmMonths,
        topPerforation: config.topPerforation,
        mesp: config.mesp,
        annuli,
        lastUpdatedAt: now,
        lastUpdatedBy: updatedBy,
      };
      return this.http.put<WellAnnulusRecord>(`/api/wellAnnulusRecords/${existing.id}`, body).pipe(
        tap(() => this.loadByWell(wellId)),
      );
    } else {
      const body: WellAnnulusRecord = {
        id: crypto.randomUUID(),
        wellId,
        completionType: config.completionType,
        mocElements: config.mocElements,
        overrideNextPmMonths: config.overrideNextPmMonths,
        topPerforation: config.topPerforation,
        mesp: config.mesp,
        annuli,
        lastUpdatedAt: now,
        lastUpdatedBy: updatedBy,
      };
      return this.http.post<WellAnnulusRecord>('/api/wellAnnulusRecords', body).pipe(
        tap(() => this.loadByWell(wellId)),
      );
    }
  }
}
