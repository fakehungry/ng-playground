import { Component, computed, effect, inject, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { WellService } from '../../../core/services/well.service';
import { FailureReportService } from '../../../core/services/failure-report.service';
import { FailureReport, FailureReportElementEntry } from '../../../core/models/well-integrity.models';
import {
  FAILURE_REPORT_ELEMENTS,
  FailureReportElementDef,
  findFailureReportElement,
} from '../../../core/constants/failure-report-elements';

type ElementGroup = FormGroup<{
  elementKey: FormControl<string>;
  comment: FormControl<string>;
}>;

interface ElementRow {
  index: number;
  group: ElementGroup;
  def: FailureReportElementDef | undefined;
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
  });

  private createElementGroup(): ElementGroup {
    return new FormGroup({
      elementKey: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
      comment: new FormControl<string>('', { nonNullable: true }),
    });
  }

  protected readonly elementsArray = new FormArray<ElementGroup>([]);

  private readonly _elementsTick = toSignal(this.elementsArray.valueChanges, { initialValue: null });

  protected readonly elementRows = computed<ElementRow[]>(() => {
    this._elementsTick();
    return this.elementsArray.controls.map((group, index) => ({
      index,
      group,
      def: findFailureReportElement(group.getRawValue().elementKey),
    }));
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

  /** Elements already chosen in other rows, excluded from this row's dropdown to avoid duplicates. */
  protected availableElements(rowIndex: number): FailureReportElementDef[] {
    const chosenElsewhere = new Set(
      this.elementsArray.controls
        .map((g, i) => (i === rowIndex ? null : g.controls.elementKey.value))
        .filter((k): k is string => !!k),
    );
    return FAILURE_REPORT_ELEMENTS.filter(e => !chosenElsewhere.has(e.key));
  }

  protected addElement(): void {
    this.elementsArray.push(this.createElementGroup());
  }

  protected removeElement(index: number): void {
    this.elementsArray.removeAt(index);
  }

  protected onSave(): void {
    const wellId = this.wellService.selectedWellId();
    this.form.markAllAsTouched();
    this.elementsArray.markAllAsTouched();
    if (!wellId || this.form.invalid || this.elementsArray.invalid) return;

    const now = new Date().toISOString();
    const existing = this.selectedReport();
    const raw = this.form.getRawValue();

    const elements: FailureReportElementEntry[] = this.elementsArray.controls.map(g => {
      const groupRaw = g.getRawValue();
      return { key: groupRaw.elementKey, comment: groupRaw.comment };
    });

    const payload: FailureReport = {
      id: existing?.id ?? crypto.randomUUID(),
      wellId,
      reportDate: raw.reportDate,
      reportedBy: raw.reportedBy,
      elements,
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
    });
    this.elementsArray.clear();
    for (const entry of r.elements) {
      const group = this.createElementGroup();
      group.patchValue({ elementKey: entry.key, comment: entry.comment });
      this.elementsArray.push(group);
    }
  }

  private _resetForm(): void {
    this.form.reset({
      reportDate: '',
      reportedBy: '',
    });
    this.elementsArray.clear();
  }
}
