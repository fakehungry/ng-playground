import { Component, computed, effect, inject, OnInit, QueryList, signal, ViewChildren } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { WellService } from '../../../core/services/well.service';
import { WellDataService, computeAnnulusStatus } from '../../../core/services/well-data.service';
import {
  AnnulusFormValue,
  AnnulusType,
  CompletionType,
  IntegrityStatus,
  PmRecord,
  WellConfigFormValue,
} from '../../../core/models/well-integrity.models';
import { PmService } from '../../../core/services/pm.service';
import { AnnulusTab } from '../annulus-tab/annulus-tab';
import { PmInspectionView } from '../pm-inspection-view/pm-inspection-view';
import { DateFormatPipe } from '../../../shared/pipes/date-format.pipe';
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

  @ViewChildren(AnnulusTab) private annulusTabs!: QueryList<AnnulusTab>;

  ngOnInit(): void {
    this.wellService.selectAsset(null);
    this.wellDataService.clear();
    this.pmService.clear();
  }

  protected readonly annulusTypes: AnnulusType[] = ['A', 'B', 'C'];
  protected readonly activeTab = signal<AnnulusType>('A');
  protected readonly saving = signal(false);
  protected readonly saveSuccess = signal(false);
  protected readonly errorMsg = signal('');
  protected readonly selectedPmId = signal<string | null>(null);

  protected readonly configForm = new FormGroup({
    completionType: new FormControl<CompletionType>('Conventional', { nonNullable: true }),
    mocRecord: new FormControl<boolean>(false, { nonNullable: true }),
    topPerforation: new FormControl<number | null>(null),
  });

  private readonly _configTick = toSignal(this.configForm.valueChanges, { initialValue: null });

  // All three statuses computed from the saved record + current configForm values.
  // Uses record data for A-ann TOC and B-ann shoe depth (cross-annulus references).
  // Statuses refresh after Save All or when configForm changes.
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

  protected readonly selectedPm = computed<PmRecord | null>(
    () => this.wellPmRecords().find(r => r.id === this.selectedPmId()) ?? null,
  );

  constructor() {
    effect(() => {
      const record = this.wellDataService.record();
      if (record) {
        this.configForm.patchValue({
          completionType: record.completionType ?? 'Conventional',
          mocRecord: record.mocRecord ?? false,
          topPerforation: record.topPerforation ?? null,
        });
        const latest = this.wellPmRecords();
        if (latest.length && !this.selectedPmId()) {
          this.selectedPmId.set(latest[0].id);
        }
      } else {
        this.configForm.reset({ completionType: 'Conventional', mocRecord: false, topPerforation: null });
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
    this.selectedPmId.set(null);
  }

  protected onPlatformChange(event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    this.wellService.selectPlatform(id);
    this.wellDataService.clear();
    this.selectedPmId.set(null);
  }

  protected onWellChange(event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    this.wellService.selectWell(id);
    this.saveSuccess.set(false);
    this.errorMsg.set('');
    this.selectedPmId.set(null);
    if (id) {
      this.wellDataService.loadByWell(id);
      this.pmService.loadByWell(id);
    } else {
      this.wellDataService.clear();
    }
  }

  protected onSelectPm(event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    this.selectedPmId.set(id || null);
  }

  protected onSaveAll(): void {
    const wellId = this.wellService.selectedWellId();
    if (!wellId) return;

    const tabs = this.annulusTabs.toArray();
    const types: AnnulusType[] = ['A', 'B', 'C'];
    const annuliValues: Record<AnnulusType, AnnulusFormValue> = {} as Record<AnnulusType, AnnulusFormValue>;
    types.forEach((type, i) => {
      const raw = tabs[i]?.form.getRawValue();
      annuliValues[type] = raw ?? { toc: null, cblToc: null, shoeDepth: null, mesp: null, masp: null, mop: null, tow: null, updatedBy: '' };
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

  protected pmRecordLabel(r: PmRecord): string {
    const date = r.completedDate ?? r.plannedDate;
    return `${date} — ${r.jobDescription.slice(0, 40)} (${r.status})`;
  }
}
