import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import {
  IntegrityStatus,
  RigSchedule,
  WellStatusRow,
} from '../../core/models/well-integrity.models';
import { MocEntry } from '../../core/models/well-integrity.models';
import { findCmElement } from '../../core/constants/cm-elements';
import { PmService } from '../../core/services/pm.service';
import { ReportService } from '../../core/services/report.service';
import { RigScheduleService } from '../../core/services/rig-schedule.service';
import { WellDataService } from '../../core/services/well-data.service';
import { WellRemarkService } from '../../core/services/well-remark.service';
import { WellService } from '../../core/services/well.service';
import { WellTree } from './well-tree/well-tree';

interface PieSlice {
  status: IntegrityStatus;
  label: string;
  color: string;
  count: number;
  pct: number;
  path: string;
  isFull: boolean;
}

interface RowEdit {
  issue: string;
  action: string;
  remark: string;
}

interface BarDatum {
  month: string; // 'overdue' | 'YYYY-MM'
  label: string;
  count: number;
  x: number;
  y: number;
  width: number;
  height: number;
  labelWidth: number;
  color: string;
}

interface PlatformBucketGroup {
  platformId: string;
  platformCode: string;
  count: number;
  rows: WellStatusRow[];
  rigs: RigSchedule[];
}

interface BucketColumn {
  month: string;
  label: string;
  totalCount: number;
  groups: PlatformBucketGroup[];
}

const PIE_COLORS: Record<IntegrityStatus, string> = {
  pass: '#22c55e',
  warning: '#fbbf24',
  fail: '#ef4444',
  'no-data': '#cbd5e1',
};

const OVERDUE_COLOR = '#ef4444';
const SCHEDULED_COLOR = '#2563eb';
const BAR_WIDTH = 40;
const BAR_GAP = 24;
const MAX_BAR_HEIGHT = 95;
const BASELINE_Y = 120;

const PIE_LABELS: Record<IntegrityStatus, string> = {
  pass: 'Green — Normal',
  warning: 'Yellow — Issue',
  fail: 'Red — Critical',
  'no-data': 'No Data',
};

const PIE_ORDER: IntegrityStatus[] = ['pass', 'warning', 'fail', 'no-data'];

function fmt(n: number): string {
  return n.toFixed(3);
}

function buildDonutPath(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  start: number,
  end: number,
  isFull: boolean,
): string {
  if (isFull) {
    return [
      `M ${cx} ${cy - outerR} A ${outerR} ${outerR} 0 1 1 ${cx - 0.001} ${cy - outerR} Z`,
      `M ${cx} ${cy - innerR} A ${innerR} ${innerR} 0 1 0 ${cx - 0.001} ${cy - innerR} Z`,
    ].join(' ');
  }
  const oX1 = cx + outerR * Math.cos(start),
    oY1 = cy + outerR * Math.sin(start);
  const oX2 = cx + outerR * Math.cos(end),
    oY2 = cy + outerR * Math.sin(end);
  const iX1 = cx + innerR * Math.cos(end),
    iY1 = cy + innerR * Math.sin(end);
  const iX2 = cx + innerR * Math.cos(start),
    iY2 = cy + innerR * Math.sin(start);
  const la = end - start > Math.PI ? 1 : 0;
  return `M ${fmt(oX1)} ${fmt(oY1)} A ${outerR} ${outerR} 0 ${la} 1 ${fmt(oX2)} ${fmt(oY2)} L ${fmt(iX1)} ${fmt(iY1)} A ${innerR} ${innerR} 0 ${la} 0 ${fmt(iX2)} ${fmt(iY2)} Z`;
}

function buildBar(
  index: number,
  count: number,
  maxCount: number,
): { x: number; y: number; width: number; height: number } {
  const height = maxCount > 0 ? Math.max(2, Math.round((count / maxCount) * MAX_BAR_HEIGHT)) : 0;
  return { x: index * (BAR_WIDTH + BAR_GAP), y: BASELINE_Y - height, width: BAR_WIDTH, height };
}

function monthRange(month: string): { start: string; end: string } {
  const [y, m] = month.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return { start: `${month}-01`, end: `${month}-${String(lastDay).padStart(2, '0')}` };
}

@Component({
  selector: 'app-report',
  standalone: true,
  imports: [WellTree],
  templateUrl: './report.html',
})
export class Report implements OnInit {
  protected readonly wellService = inject(WellService);
  private readonly pmService = inject(PmService);
  private readonly wellDataService = inject(WellDataService);
  private readonly reportService = inject(ReportService);
  protected readonly remarkService = inject(WellRemarkService);
  private readonly rigScheduleService = inject(RigScheduleService);

  protected readonly selectedWellIds = signal<Set<string>>(new Set());
  protected readonly activeTab = signal<'status' | 'schedule'>('status');
  protected readonly selectedMonth = signal<string | null>(null);
  protected readonly activeFilter = signal<IntegrityStatus | null>(null);
  protected readonly hoveredStatus = signal<IntegrityStatus | null>(null);
  protected readonly hoveredMonth = signal<string | null>(null);
  protected readonly expandedCells = signal<Set<string>>(new Set());

  // Local unsaved edits keyed by wellId
  protected readonly editState = signal<Record<string, RowEdit>>({});
  protected readonly saving = signal(false);
  protected readonly saveSuccess = signal(false);

  protected readonly anyDirty = computed(() =>
    this._allRows().some((r) => this.isDirty(r.well.id)),
  );

  protected readonly dirtyCount = computed(
    () => this._allRows().filter((r) => this.isDirty(r.well.id)).length,
  );

  protected readonly _allRows = computed<WellStatusRow[]>(() =>
    [...this.selectedWellIds()]
      .map((id) => this.reportService.generateWellStatusRow(id))
      .filter((r): r is WellStatusRow => r !== null),
  );

  protected readonly rows = computed<WellStatusRow[]>(() => {
    const filter = this.activeFilter();
    const all = this._allRows();
    return filter ? all.filter((r) => r.finalStatus === filter) : all;
  });

  protected readonly scheduleRows = computed<WellStatusRow[]>(() => {
    const month = this.selectedMonth();
    const sorted = this._allRows()
      .slice()
      .sort((a, b) => {
        if (!a.nextPmDate && !b.nextPmDate) return 0;
        if (!a.nextPmDate) return 1;
        if (!b.nextPmDate) return -1;
        return a.nextPmDate.localeCompare(b.nextPmDate);
      });
    if (!month) return sorted;
    if (month === 'overdue') return sorted.filter((r) => r.isOverdue);
    return sorted.filter((r) => !r.isOverdue && r.nextPmDate?.startsWith(month));
  });

  protected readonly monthBuckets = computed<{ month: string; label: string; count: number }[]>(
    () => {
      const all = this._allRows();
      const overdueCount = all.filter((r) => r.isOverdue).length;
      const map = new Map<string, number>();
      all.forEach((r) => {
        if (!r.nextPmDate || r.isOverdue) return;
        const m = r.nextPmDate.slice(0, 7);
        map.set(m, (map.get(m) ?? 0) + 1);
      });
      const upcoming = [...map.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, count]) => ({
          month,
          label: new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric' }).format(
            new Date(month + '-02'),
          ),
          count,
        }));
      const buckets: { month: string; label: string; count: number }[] = [];
      if (overdueCount > 0)
        buckets.push({ month: 'overdue', label: 'Overdue', count: overdueCount });
      return [...buckets, ...upcoming];
    },
  );

  protected readonly scheduleBars = computed<BarDatum[]>(() => {
    const buckets = this.monthBuckets();
    const max = Math.max(0, ...buckets.map((b) => b.count));
    return buckets.map((b, i) => ({
      month: b.month,
      label: b.label,
      count: b.count,
      color: b.month === 'overdue' ? OVERDUE_COLOR : SCHEDULED_COLOR,
      labelWidth: BAR_WIDTH + BAR_GAP,
      ...buildBar(i, b.count, max),
    }));
  });

  protected readonly scheduleChartWidth = computed(() =>
    this.scheduleBars().length ? this.scheduleBars().length * (BAR_WIDTH + BAR_GAP) - BAR_GAP : 0,
  );

  protected readonly scheduleColumns = computed<BucketColumn[]>(() => {
    const month = this.selectedMonth();
    const buckets = month
      ? this.monthBuckets().filter((b) => b.month === month)
      : this.monthBuckets();
    const all = this._allRows();
    const rigSchedules = this.rigScheduleService.schedules();

    return buckets.map((b) => {
      const rowsInBucket = all.filter((r) =>
        b.month === 'overdue' ? r.isOverdue : !r.isOverdue && r.nextPmDate?.startsWith(b.month),
      );
      const byPlatform = new Map<string, WellStatusRow[]>();
      rowsInBucket.forEach((r) => {
        const arr = byPlatform.get(r.platform.id) ?? [];
        arr.push(r);
        byPlatform.set(r.platform.id, arr);
      });
      const refMonth = b.month === 'overdue' ? new Date().toISOString().slice(0, 7) : b.month;
      const { start, end } = monthRange(refMonth);
      const groups: PlatformBucketGroup[] = [...byPlatform.entries()]
        .map(([platformId, rows]) => ({
          platformId,
          platformCode: rows[0].platform.name,
          count: rows.length,
          rows: rows.slice().sort((a, c) => a.well.name.localeCompare(c.well.name)),
          rigs: rigSchedules.filter(
            (r) => r.platformId === platformId && r.startDate <= end && r.endDate >= start,
          ),
        }))
        .sort((a, c) => a.platformCode.localeCompare(c.platformCode));
      return { month: b.month, label: b.label, totalCount: b.count, groups };
    });
  });

  protected readonly pieSlices = computed<PieSlice[]>(() => {
    const all = this._allRows();
    const total = all.length;
    if (total === 0) return [];

    let start = -Math.PI / 2;
    return PIE_ORDER.map((status) => ({
      status,
      count: all.filter((r) => r.finalStatus === status).length,
    }))
      .filter((s) => s.count > 0)
      .map(({ status, count }) => {
        const frac = count / total;
        const end = start + frac * 2 * Math.PI;
        const full = frac === 1;
        const path = full ? '' : buildDonutPath(100, 100, 80, 50, start, end, false);
        const slice: PieSlice = {
          status,
          label: PIE_LABELS[status],
          color: PIE_COLORS[status],
          count,
          pct: Math.round(frac * 100),
          path,
          isFull: full,
        };
        start = end;
        return slice;
      });
  });

  protected readonly centerLabel = computed<{ count: string; label: string } | null>(() => {
    const active = this.hoveredStatus() ?? this.activeFilter();
    if (active) {
      const slice = this.pieSlices().find((s) => s.status === active);
      return slice ? { count: String(slice.count), label: slice.label.split(' — ')[0] } : null;
    }
    const total = this._allRows().length;
    return total > 0 ? { count: String(total), label: 'Total' } : null;
  });

  ngOnInit(): void {
    this.pmService.loadAll();
    this.wellDataService.loadAll();
    this.remarkService.loadAll();
    this.rigScheduleService.loadAll();
  }

  // --- Edit state helpers ---

  protected getEdit(wellId: string, field: keyof RowEdit): string {
    const local = this.editState()[wellId];
    if (local) return local[field];
    const saved = this.remarkService.remarks().find((r) => r.wellId === wellId);
    return saved?.[field] ?? '';
  }

  protected setEdit(wellId: string, field: keyof RowEdit, value: string): void {
    const current = this.editState()[wellId] ?? {
      issue: this.remarkService.remarks().find((r) => r.wellId === wellId)?.issue ?? '',
      action: this.remarkService.remarks().find((r) => r.wellId === wellId)?.action ?? '',
      remark: this.remarkService.remarks().find((r) => r.wellId === wellId)?.remark ?? '',
    };
    this.editState.update((s) => ({ ...s, [wellId]: { ...current, [field]: value } }));
  }

  protected isDirty(wellId: string): boolean {
    const local = this.editState()[wellId];
    if (!local) return false;
    const saved = this.remarkService.remarks().find((r) => r.wellId === wellId);
    return (
      local.issue !== (saved?.issue ?? '') ||
      local.action !== (saved?.action ?? '') ||
      local.remark !== (saved?.remark ?? '')
    );
  }

  protected saveAll(): void {
    const dirtyIds = this._allRows()
      .map((r) => r.well.id)
      .filter((id) => this.isDirty(id));
    if (!dirtyIds.length) return;

    this.saving.set(true);
    this.saveSuccess.set(false);

    forkJoin(dirtyIds.map((id) => this.remarkService.upsert(id, this.editState()[id]))).subscribe({
      next: () => {
        // Clear local edits for saved wells — saved values are now in remarkService.remarks()
        this.editState.update((s) => {
          const n = { ...s };
          dirtyIds.forEach((id) => delete n[id]);
          return n;
        });
        this.saving.set(false);
        this.saveSuccess.set(true);
        setTimeout(() => this.saveSuccess.set(false), 2500);
      },
      error: () => this.saving.set(false),
    });
  }

  // --- Selection & filter ---

  protected onSelectionChange(ids: Set<string>): void {
    this.selectedWellIds.set(ids);
    this.activeFilter.set(null);
  }

  protected onSliceClick(status: IntegrityStatus): void {
    this.activeFilter.update((f) => (f === status ? null : status));
  }

  protected onSliceHover(status: IntegrityStatus | null): void {
    this.hoveredStatus.set(status);
  }

  protected clearFilter(): void {
    this.activeFilter.set(null);
  }

  protected switchTab(tab: 'status' | 'schedule'): void {
    this.activeTab.set(tab);
    this.selectedMonth.set(null);
    this.expandedCells.set(new Set());
    this.hoveredMonth.set(null);
  }

  protected onBarClick(month: string): void {
    this.selectedMonth.update((m) => (m === month ? null : month));
  }

  protected cellKey(month: string, platformId: string): string {
    return `${month}::${platformId}`;
  }

  protected isCellExpanded(month: string, platformId: string): boolean {
    return this.expandedCells().has(this.cellKey(month, platformId));
  }

  protected toggleCell(month: string, platformId: string): void {
    const key = this.cellKey(month, platformId);
    this.expandedCells.update((s) => {
      const next = new Set(s);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  protected daysUntil(dateStr: string | null): number | null {
    if (!dateStr) return null;
    return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
  }

  protected dueBadge(dateStr: string | null): { label: string; classes: string } | null {
    const d = this.daysUntil(dateStr);
    if (d === null) return null;
    if (d < 0) return { label: `${-d}d overdue`, classes: 'bg-red-100 text-red-700 ring-red-300' };
    if (d <= 30)
      return { label: 'Due in 1 month', classes: 'bg-orange-100 text-orange-700 ring-orange-300' };
    if (d <= 60)
      return { label: 'Due in 2 months', classes: 'bg-amber-100 text-amber-700 ring-amber-300' };
    if (d <= 90)
      return { label: 'Due in 3 months', classes: 'bg-yellow-100 text-yellow-700 ring-yellow-300' };
    return null;
  }

  protected rigNames(rigs: RigSchedule[]): string {
    return rigs.map((r) => r.rigName).join(', ');
  }

  protected mocLabel(entries: MocEntry[] | null): string {
    return (entries ?? []).map(e => findCmElement(e.element)?.label ?? e.element).join(', ');
  }

  protected dotClass(status: IntegrityStatus): string {
    switch (status) {
      case 'pass':
        return 'bg-green-500';
      case 'warning':
        return 'bg-amber-400';
      case 'fail':
        return 'bg-red-500';
      default:
        return 'bg-slate-300';
    }
  }

  protected exportCsv(): void {
    const today = new Date().toISOString().slice(0, 10);
    let csv: string;
    let filename: string;

    if (this.activeTab() === 'schedule') {
      const rows = this.scheduleRows();
      if (!rows.length) return;
      const header = [
        'Well',
        'Platform',
        'Asset',
        'Status',
        'Last PM',
        'Next PM Due',
        'Days',
        'Due Badge',
      ];
      const lines = rows.map((r) => {
        const d = this.daysUntil(r.nextPmDate);
        const badge = this.dueBadge(r.nextPmDate)?.label ?? (d !== null ? `${d}d` : '');
        return [
          r.well.name,
          r.platform.name,
          r.asset.name,
          r.finalStatus,
          r.latestPm?.completedDate ?? '',
          r.nextPmDate ?? '',
          d !== null ? String(d) : '',
          badge,
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(',');
      });
      csv = [header.join(','), ...lines].join('\n');
      filename = `pm-schedule-${today}.csv`;
    } else {
      const rows = this._allRows();
      if (!rows.length) return;
      const header = [
        'Well',
        'Asset',
        'Platform',
        'WH',
        'XT',
        'THGR',
        'DHSV',
        'A Barrier',
        'B Barrier',
        'TBG',
        'Combined',
        'Ann. P',
        'MOC',
        'Final',
        'Issue',
        'Action',
        'Remark',
      ];
      const lines = rows.map((r) =>
        [
          r.well.name,
          r.asset.name,
          r.platform.name,
          r.wh,
          r.xt,
          r.thgr,
          r.dhsv,
          r.aBarrier,
          r.bBarrier,
          r.tbg,
          r.extIntCombined,
          r.annulusPressure,
          this.mocLabel(r.mocElements),
          r.finalStatus,
          this.getEdit(r.well.id, 'issue'),
          this.getEdit(r.well.id, 'action'),
          this.getEdit(r.well.id, 'remark'),
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(','),
      );
      csv = [header.join(','), ...lines].join('\n');
      filename = `well-integrity-report-${today}.csv`;
    }

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}
