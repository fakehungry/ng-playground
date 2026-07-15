import { Component, computed, input } from '@angular/core';
import { IntegrityStatus, PmStatus } from '../../../core/models/well-integrity.models';

type BadgeStatus = PmStatus | IntegrityStatus;

const PM_CONFIG: Record<PmStatus, { label: string; cls: string }> = {
  'Planned':     { label: 'Planned',     cls: 'bg-blue-100 text-blue-800 ring-1 ring-blue-300' },
  'In Progress': { label: 'In Progress', cls: 'bg-amber-100 text-amber-800 ring-1 ring-amber-300' },
  'Completed':   { label: 'Completed',   cls: 'bg-green-100 text-green-800 ring-1 ring-green-300' },
};

const INTEGRITY_CONFIG: Record<IntegrityStatus, { label: string; cls: string }> = {
  pass:      { label: 'PASS',    cls: 'bg-green-100 text-green-800' },
  fail:      { label: 'FAIL',    cls: 'bg-red-100 text-red-800' },
  warning:   { label: 'WARNING', cls: 'bg-amber-100 text-amber-800' },
  'no-data': { label: 'NO DATA', cls: 'bg-slate-100 text-slate-500' },
};

@Component({
  selector: 'app-status-badge',
  standalone: true,
  template: `<span [class]="badgeClass()">{{ label() }}</span>`,
})
export class StatusBadge {
  status = input.required<BadgeStatus>();

  private static readonly BASE = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ';

  protected readonly label = computed(() => {
    const s = this.status();
    if (s in PM_CONFIG) return PM_CONFIG[s as PmStatus].label;
    return INTEGRITY_CONFIG[s as IntegrityStatus]?.label ?? s;
  });

  protected readonly badgeClass = computed(() => {
    const s = this.status();
    const extra = s in PM_CONFIG ? PM_CONFIG[s as PmStatus].cls : (INTEGRITY_CONFIG[s as IntegrityStatus]?.cls ?? '');
    return StatusBadge.BASE + extra;
  });
}
