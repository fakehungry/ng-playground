import { Component, computed, effect, inject, OnInit, QueryList, signal, ViewChildren } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { WellService } from '../../../core/services/well.service';
import { WellDataService, computeAnnulusStatus } from '../../../core/services/well-data.service';
import {
  AnnulusFormValue,
  AnnulusType,
  CompletionType,
  FailureReport,
  IntegrityStatus,
  PmRecord,
  WellConfigFormValue,
} from '../../../core/models/well-integrity.models';
import { PmService } from '../../../core/services/pm.service';
import { FailureReportService } from '../../../core/services/failure-report.service';
import { AnnulusTab } from '../annulus-tab/annulus-tab';
import { PmInspectionView } from '../pm-inspection-view/pm-inspection-view';
import { DateFormatPipe } from '../../../shared/pipes/date-format.pipe';

type HistoryItem =
  | { type: 'pm'; id: string; label: string; record: PmRecord }
  | { type: 'failure'; id: string; label: string; record: FailureReport };

@Component({
  selector: 'app-well-data-form',
  standalone: true,
  imports: [ReactiveFormsModule, AnnulusTab, PmInspectionView, DateFormatPipe],
  templateUrl: './well-data-form.html',
})
export class WellDataForm implements OnInit {
  protected readonly wellService = inject(WellService);
  protected readonly wellDataService = inject(WellDataService);
  protected readonly pmService = inject(PmService);
  protected readonly failureReportService = inject(FailureReportService);

  @ViewChildren(AnnulusTab) private annulusTabs!: QueryList<AnnulusTab>;

  ngOnInit(): void {
    this.wellService.selectAsset(null);
    this.wellDataService.clear();
    this.pmService.clear();
    this.failureReportService.clear();
  }

  protected readonly annulusTypes: AnnulusType[] = ['A', 'B', 'C'];
  protected readonly activeTab = signal<AnnulusType>('A');
  protected readonly saving = signal(false);
  protected readonly saveSuccess = signal(false);
  protected readonly errorMsg = signal('');
  protected readonly selectedItemId = signal<string | null>(null);

  protected readonly configForm = new FormGroup({
    completionType: new FormControl<CompletionType>('Conventional', { nonNullable: true }),
    mocRecord: new FormControl<boolean>(false, { nonNullable: true }),
    topPerforation: new FormControl<number | null>(null),
    mesp: new FormControl<number | null>(null, [Validators.min(0)]),
  });

  private readonly _configTick = toSignal(this.configForm.valueChanges, { initialValue: null });

  protected readonly allAnnulusStatuses = computed<Record<AnnulusType, IntegrityStatus>>(() => {
    this._configTick();
    const record = this.wellDataService.record();
    const ct = this.configForm.getRawValue().completionType;
    const topPerf = this.configForm.getRawValue().topPerforation;

    if (!record) return { A: 'no-data', B: 'no-data', C: 'no-data' };

    const aAnn = record.annuli.A;
    const bAnn = record.annuli.B;

    return {
      A: computeAnnulusStatus('A', ct, topPerf, aAnn.toc, aAnn.cblToc, bAnn.shoeDepth),
      B: computeAnnulusStatus('B', ct, topPerf, aAnn.toc, aAnn.cblToc, bAnn.shoeDepth),
      C: computeAnnulusStatus('C', ct, topPerf, aAnn.toc, aAnn.cblToc, bAnn.shoeDepth),
    };
  });

  protected readonly wellPmRecords = computed<PmRecord[]>(() => {
    const wellId = this.wellService.selectedWellId();
    if (!wellId) return [];
    return [...this.pmService.records().filter(r => r.wellId === wellId)].sort((a, b) => {
      const da = a.completedDate ?? a.plannedDate;
      const db = b.completedDate ?? b.plannedDate;
      return db.localeCompare(da);
    });
  });

  protected readonly historyItems = computed<HistoryItem[]>(() => {
    const pms: HistoryItem[] = this.wellPmRecords().map(r => ({
      type: 'pm',
      id: r.id,
      label: `[PM] ${r.completedDate ?? r.plannedDate} — ${r.jobDescription.slice(0, 35)} (${r.status})`,
      record: r,
    }));
    const frs: HistoryItem[] = [...this.failureReportService.reports()]
      .sort((a, b) => b.reportDate.localeCompare(a.reportDate))
      .map(r => ({
        type: 'failure',
        id: r.id,
        label: `[FR] ${r.reportDate} — Reported by ${r.reportedBy}`,
        record: r,
      }));
    return [...pms, ...frs].sort((a, b) => {
      const da = a.type === 'pm' ? (a.record.completedDate ?? a.record.plannedDate) : a.record.reportDate;
      const db = b.type === 'pm' ? (b.record.completedDate ?? b.record.plannedDate) : b.record.reportDate;
      return db.localeCompare(da);
    });
  });

  protected readonly selectedItem = computed<HistoryItem | null>(
    () => this.historyItems().find(i => i.id === this.selectedItemId()) ?? null,
  );

  constructor() {
    effect(() => {
      const record = this.wellDataService.record();
      if (record) {
        this.configForm.patchValue({
          completionType: record.completionType ?? 'Conventional',
          mocRecord: record.mocRecord ?? false,
          topPerforation: record.topPerforation ?? null,
          mesp: record.mesp ?? null,
        });
        const items = this.historyItems();
        if (items.length && !this.selectedItemId()) {
          this.selectedItemId.set(items[0].id);
        }
      } else {
        this.configForm.reset({ completionType: 'Conventional', mocRecord: false, topPerforation: null, mesp: null });
      }
    });
  }

  protected annulusDataFor(type: AnnulusType) {
    return this.wellDataService.record()?.annuli[type] ?? null;
  }

  protected onAssetChange(event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    this.wellService.selectAsset(id);
    this.wellDataService.clear();
    this.selectedItemId.set(null);
  }

  protected onPlatformChange(event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    this.wellService.selectPlatform(id);
    this.wellDataService.clear();
    this.selectedItemId.set(null);
  }

  protected onWellChange(event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    this.wellService.selectWell(id);
    this.saveSuccess.set(false);
    this.errorMsg.set('');
    this.selectedItemId.set(null);
    if (id) {
      this.wellDataService.loadByWell(id);
      this.pmService.loadByWell(id);
      this.failureReportService.loadByWell(id);
    } else {
      this.wellDataService.clear();
      this.failureReportService.clear();
    }
  }

  protected onSelectItem(event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    this.selectedItemId.set(id || null);
  }

  protected onSaveAll(): void {
    const wellId = this.wellService.selectedWellId();
    if (!wellId) return;

    const tabs = this.annulusTabs.toArray();
    const types: AnnulusType[] = ['A', 'B', 'C'];
    const annuliValues: Record<AnnulusType, AnnulusFormValue> = {} as Record<AnnulusType, AnnulusFormValue>;
    types.forEach((type, i) => {
      const raw = tabs[i]?.form.getRawValue();
      annuliValues[type] = raw ?? { toc: null, cblToc: null, shoeDepth: null, masp: null, mop: null, tow: null, updatedBy: '' };
    });

    const config: WellConfigFormValue = this.configForm.getRawValue();

    this.saving.set(true);
    this.saveSuccess.set(false);
    this.errorMsg.set('');

    this.wellDataService.saveAll(wellId, config, annuliValues).subscribe({
      next: () => {
        this.saving.set(false);
        this.saveSuccess.set(true);
        setTimeout(() => this.saveSuccess.set(false), 3000);
      },
      error: () => {
        this.saving.set(false);
        this.errorMsg.set('Failed to save. Please try again.');
      },
    });
  }
}
