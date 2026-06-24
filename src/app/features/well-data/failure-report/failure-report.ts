import { Component, computed, effect, inject, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { WellService } from '../../../core/services/well.service';
import { FailureReportService } from '../../../core/services/failure-report.service';
import { ComponentStatus, FailureReport } from '../../../core/models/well-integrity.models';

function itemGroup() {
  return new FormGroup({
    status: new FormControl<ComponentStatus>('Good', { nonNullable: true }),
    comment: new FormControl<string>('', { nonNullable: true }),
  });
}

@Component({
  selector: 'app-failure-report',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './failure-report.html',
})
export class FailureReportForm implements OnInit {
  protected readonly wellService = inject(WellService);
  protected readonly failureReportService = inject(FailureReportService);

  protected readonly saving = signal(false);
  protected readonly saveSuccess = signal(false);
  protected readonly errorMsg = signal('');
  protected readonly selectedReportId = signal<string | null>(null);

  protected readonly form = new FormGroup({
    reportDate: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    reportedBy: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    xt: new FormGroup({
      body: itemGroup(),
      umv:  itemGroup(),
      lmv:  itemGroup(),
      wv:   itemGroup(),
      kwv:  itemGroup(),
      sv:   itemGroup(),
    }),
    annulusPressure: new FormGroup({
      aAnn: itemGroup(),
      bAnn: itemGroup(),
      cAnn: itemGroup(),
    }),
  });

  protected readonly wellReports = computed(() =>
    [...this.failureReportService.reports()].sort((a, b) => b.reportDate.localeCompare(a.reportDate)),
  );

  protected readonly selectedReport = computed<FailureReport | null>(
    () => this.wellReports().find(r => r.id === this.selectedReportId()) ?? null,
  );

  ngOnInit(): void {
    this.wellService.selectAsset(null);
    this.failureReportService.clear();
  }

  constructor() {
    effect(() => {
      const reports = this.wellReports();
      if (reports.length && !this.selectedReportId()) {
        this.selectedReportId.set(reports[0].id);
        this._patchForm(reports[0]);
      }
    });
  }

  protected onAssetChange(event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    this.wellService.selectAsset(id);
    this.failureReportService.clear();
    this.selectedReportId.set(null);
    this._resetForm();
  }

  protected onPlatformChange(event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    this.wellService.selectPlatform(id);
    this.failureReportService.clear();
    this.selectedReportId.set(null);
    this._resetForm();
  }

  protected onWellChange(event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    this.wellService.selectWell(id);
    this.saveSuccess.set(false);
    this.errorMsg.set('');
    this.selectedReportId.set(null);
    this._resetForm();
    if (id) {
      this.failureReportService.loadByWell(id);
    } else {
      this.failureReportService.clear();
    }
  }

  protected onSelectReport(event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    if (!id) {
      this.selectedReportId.set(null);
      this._resetForm();
      return;
    }
    this.selectedReportId.set(id);
    const report = this.wellReports().find(r => r.id === id);
    if (report) this._patchForm(report);
  }

  protected onNewReport(): void {
    this.selectedReportId.set(null);
    this._resetForm();
  }

  protected onSave(): void {
    const wellId = this.wellService.selectedWellId();
    if (!wellId || this.form.invalid) return;

    const now = new Date().toISOString();
    const existing = this.selectedReport();
    const raw = this.form.getRawValue();

    const payload: FailureReport = {
      id: existing?.id ?? crypto.randomUUID(),
      wellId,
      reportDate: raw.reportDate,
      reportedBy: raw.reportedBy,
      xt: {
        body: raw.xt.body,
        umv:  raw.xt.umv,
        lmv:  raw.xt.lmv,
        wv:   raw.xt.wv,
        kwv:  raw.xt.kwv,
        sv:   raw.xt.sv,
      },
      annulusPressure: {
        aAnn: raw.annulusPressure.aAnn,
        bAnn: raw.annulusPressure.bAnn,
        cAnn: raw.annulusPressure.cAnn,
      },
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    this.saving.set(true);
    this.saveSuccess.set(false);
    this.errorMsg.set('');

    this.failureReportService.save(payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.saveSuccess.set(true);
        this.selectedReportId.set(payload.id);
        setTimeout(() => this.saveSuccess.set(false), 3000);
      },
      error: () => {
        this.saving.set(false);
        this.errorMsg.set('Failed to save. Please try again.');
      },
    });
  }

  protected reportLabel(r: FailureReport): string {
    return `${r.reportDate} — Reported by ${r.reportedBy}`;
  }

  private _patchForm(r: FailureReport): void {
    this.form.patchValue({
      reportDate: r.reportDate,
      reportedBy: r.reportedBy,
      xt: r.xt,
      annulusPressure: r.annulusPressure,
    });
  }

  private _resetForm(): void {
    this.form.reset({
      reportDate: '',
      reportedBy: '',
      xt: {
        body: { status: 'Good', comment: '' },
        umv:  { status: 'Good', comment: '' },
        lmv:  { status: 'Good', comment: '' },
        wv:   { status: 'Good', comment: '' },
        kwv:  { status: 'Good', comment: '' },
        sv:   { status: 'Good', comment: '' },
      },
      annulusPressure: {
        aAnn: { status: 'Good', comment: '' },
        bAnn: { status: 'Good', comment: '' },
        cAnn: { status: 'Good', comment: '' },
      },
    });
  }
}
