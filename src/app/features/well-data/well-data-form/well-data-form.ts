import { Component, computed, effect, inject, OnInit, QueryList, signal, ViewChildren } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  CM_DHSV_ELEMENTS,
  CM_WELLHEAD_ELEMENTS,
  CM_XT_ELEMENTS,
  CmElementDef,
} from '../../../core/constants/cm-elements';
import { forkJoin, Observable, of } from 'rxjs';
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
  FLOW_MECHANISMS,
  MocEntry,
  PM_OVERRIDE_MONTHS,
  PmOverrideMonths,
  FlowMechanism,
} from '../../../core/models/well-integrity.models';
import { IntegrityConfigService } from '../../../core/services/integrity-config.service';
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
  private readonly integrityConfig = inject(IntegrityConfigService);
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
  protected mocAvailable(current: string | null, defs: readonly CmElementDef[]): CmElementDef[] {
    const taken = this.configForm.controls.mocElements.value.map(m => m.element);
    return defs.filter(e => e.key === current || !taken.includes(e.key));
  }

  protected mocHasOptions(): boolean {
    const all = [...this.xtElements, ...this.wellheadElements, ...this.dhsvElements];
    return this.mocAvailable(null, all).length > 0;
  }

  private setMocElements(next: MocEntry[]): void {
    const ctrl = this.configForm.controls.mocElements;
    ctrl.setValue(next);
    ctrl.markAsDirty();
  }

  protected onMocElementAdd(event: Event): void {
    const select = event.target as HTMLSelectElement;
    if (select.value) {
      this.setMocElements([...this.configForm.controls.mocElements.value, { element: select.value, link: '' }]);
    }
    select.value = '';
  }

  protected onMocElementChange(index: number, event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.setMocElements(this.configForm.controls.mocElements.value.map((m, i) => (i === index ? { ...m, element: value } : m)));
  }

  protected onMocLinkChange(index: number, event: Event): void {
    const link = (event.target as HTMLInputElement).value;
    this.setMocElements(this.configForm.controls.mocElements.value.map((m, i) => (i === index ? { ...m, link } : m)));
  }

  protected removeMocElement(index: number): void {
    this.setMocElements(this.configForm.controls.mocElements.value.filter((_, i) => i !== index));
  }

  protected onOverrideChange(event: Event): void {
    const v = (event.target as HTMLSelectElement).value;
    this.configForm.controls.overrideNextPmMonths.setValue(v ? (Number(v) as PmOverrideMonths) : null);
  }

  protected readonly saving = signal(false);
  protected readonly saveSuccess = signal(false);
  protected readonly errorMsg = signal('');
  protected readonly selectedItemId = signal<string | null>(null);

  protected readonly flowMechanisms = FLOW_MECHANISMS;
  protected readonly xtElements = CM_XT_ELEMENTS;
  protected readonly wellheadElements = CM_WELLHEAD_ELEMENTS;
  protected readonly dhsvElements = CM_DHSV_ELEMENTS;
  protected readonly pmOverrideOptions = PM_OVERRIDE_MONTHS;

  protected readonly configForm = new FormGroup({
    flowMechanism: new FormControl<FlowMechanism>('N', { nonNullable: true }),
    completionType: new FormControl<CompletionType>('Conventional', { nonNullable: true }),
    mocElements: new FormControl<MocEntry[]>([], { nonNullable: true }),
    overrideNextPmMonths: new FormControl<PmOverrideMonths | null>(null),
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
    const margins = this.integrityConfig.config().barrier;

    return {
      A: computeAnnulusStatus('A', ct, topPerf, aAnn.toc, aAnn.cblToc, bAnn.shoeDepth, margins),
      B: computeAnnulusStatus('B', ct, topPerf, aAnn.toc, aAnn.cblToc, bAnn.shoeDepth, margins),
      C: computeAnnulusStatus('C', ct, topPerf, aAnn.toc, aAnn.cblToc, bAnn.shoeDepth, margins),
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
      const wellId = this.wellService.selectedWellId();
      const well = wellId ? this.wellService.findWell(wellId) : undefined;
      this.configForm.controls.flowMechanism.setValue(well?.flowMechanism ?? 'N');
    });

    effect(() => {
      const record = this.wellDataService.record();
      if (record) {
        this.configForm.patchValue({
          completionType: record.completionType ?? 'Conventional',
          mocElements: record.mocElements ?? [],
          overrideNextPmMonths: record.overrideNextPmMonths ?? null,
          topPerforation: record.topPerforation ?? null,
          mesp: record.mesp ?? null,
        });
        const items = this.historyItems();
        if (items.length && !this.selectedItemId()) {
          this.selectedItemId.set(items[0].id);
        }
      } else {
        this.configForm.patchValue({ completionType: 'Conventional', mocElements: [], overrideNextPmMonths: null, topPerforation: null, mesp: null });
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

    const { flowMechanism, ...config }: WellConfigFormValue & { flowMechanism: FlowMechanism } =
      this.configForm.getRawValue();

    this.saving.set(true);
    this.saveSuccess.set(false);
    this.errorMsg.set('');

    const currentFlow = this.wellService.findWell(wellId)?.flowMechanism;
    const flow$: Observable<unknown> =
      flowMechanism !== currentFlow
        ? this.wellService.updateFlowMechanism(wellId, flowMechanism)
        : of(null);

    forkJoin([this.wellDataService.saveAll(wellId, config, annuliValues), flow$]).subscribe({
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
