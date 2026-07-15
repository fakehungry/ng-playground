import { Component, input, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PmRecord } from '../../../core/models/well-integrity.models';
import { DateFormatPipe } from '../../../shared/pipes/date-format.pipe';
import { StatusBadge } from '../../../shared/components/status-badge/status-badge';

type SectionKey = 'xtBody' | 'wellhead' | 'tubing' | 'annulusPressure';

@Component({
  selector: 'app-pm-inspection-view',
  standalone: true,
  imports: [DecimalPipe, RouterLink, DateFormatPipe, StatusBadge],
  templateUrl: './pm-inspection-view.html',
})
export class PmInspectionView {
  record = input.required<PmRecord>();

  protected readonly sectionExpanded = signal<Record<SectionKey, boolean>>({
    xtBody: true,
    wellhead: false,
    tubing: false,
    annulusPressure: false,
  });

  protected toggleSection(key: SectionKey): void {
    this.sectionExpanded.update(s => ({ ...s, [key]: !s[key] }));
  }
}
