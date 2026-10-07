import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  CM_DHSV_ELEMENTS,
  CM_WELLHEAD_ELEMENTS,
  CM_XT_ELEMENTS,
  CmElementDef,
  findCmElement,
} from '../../../core/constants/cm-elements';
import {
  CmDhsvData,
  CmElementEntry,
  CmFormValue,
  CmPressureData,
  CmStuffingBoxData,
  CmValveData,
  DhsvData,
  FunctionTestResult,
  LeakTestResult,
  StuffingBoxStatus,
} from '../../../core/models/well-integrity.models';
import { buildElementData, CmElementFormRaw, CmService } from '../../../core/services/cm.service';
import { IntegrityConfigService } from '../../../core/services/integrity-config.service';
import { PmService } from '../../../core/services/pm.service';
import {
  computeDhsvLeakRate,
  evaluateDhsvLeakRate,
  evaluateLeakTest,
} from '../../../core/utils/leak-test';
import { WellService } from '../../../core/services/well.service';

type ElementGroup = FormGroup<{
  elementKey: FormControl<string>;
  initialPressure: FormControl<number | null>;
  finalPressure: FormControl<number | null>;
  functionTest: FormControl<FunctionTestResult | null>;
  greaseVolume: FormControl<number | null>;
  stuffingBoxStatus: FormControl<StuffingBoxStatus>;
  pressureBeforeInflowTest: FormControl<number | null>;
  initialPressureWhenInflowTest: FormControl<number | null>;
  hydraulicReturn: FormControl<number | null>;
  constantForField: FormControl<number | null>;
  rootCause: FormControl<string>;
  correctiveAction: FormControl<string>;
}>;

interface ElementCalc {
  leakRate: number | null;
  leakTest: LeakTestResult | null;
  status: 'Good' | 'Fail' | null;
}

interface ElementRow {
  index: number;
  group: ElementGroup;
  def: CmElementDef | undefined;
  calc: ElementCalc;
}

@Component({
  selector: 'app-cm-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, DecimalPipe],
  templateUrl: './cm-form.html',
})
export class CmForm implements OnInit {
  private readonly cmService = inject(CmService);
  private readonly pmService = inject(PmService);
  private readonly integrityConfig = inject(IntegrityConfigService);
  protected readonly wellService = inject(WellService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected editId: string | null = null;
  protected readonly saving = signal(false);
  protected readonly errorMsg = signal('');
  protected readonly dhsvData = signal<DhsvData | null>(null);

  protected readonly xtElements = CM_XT_ELEMENTS;
  protected readonly wellheadElements = CM_WELLHEAD_ELEMENTS;
  protected readonly dhsvElements = CM_DHSV_ELEMENTS;

  protected readonly functionTestOptions: FunctionTestResult[] = ['Pass', 'Fail'];
  protected readonly stuffingBoxOptions: StuffingBoxStatus[] = ['Clean', 'Dirty'];

  protected readonly form = new FormGroup({
    assetId: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    platformId: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    wellId: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    eventDate: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    reportedBy: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  private createElementGroup(): ElementGroup {
    return new FormGroup({
      elementKey: new FormControl<string>('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      initialPressure: new FormControl<number | null>(null),
      finalPressure: new FormControl<number | null>(null),
      functionTest: new FormControl<FunctionTestResult | null>(null),
      greaseVolume: new FormControl<number | null>(null),
      stuffingBoxStatus: new FormControl<StuffingBoxStatus>('Clean', { nonNullable: true }),
      pressureBeforeInflowTest: new FormControl<number | null>(null),
      initialPressureWhenInflowTest: new FormControl<number | null>(null),
      hydraulicReturn: new FormControl<number | null>(null),
      constantForField: new FormControl<number | null>(null),
      rootCause: new FormControl<string>('', { nonNullable: true }),
      correctiveAction: new FormControl<string>('', { nonNullable: true }),
    });
  }

  protected readonly elementsArray = new FormArray<ElementGroup>([this.createElementGroup()]);

  private readonly _elementsTick = toSignal(this.elementsArray.valueChanges, { initialValue: null });

  protected readonly elementRows = computed<ElementRow[]>(() => {
    this._elementsTick();
    return this.elementsArray.controls.map((group, index) => {
      const raw = group.getRawValue();
      const def = findCmElement(raw.elementKey);
      const calc = def ? this.calcForKind(def.kind, raw) : { leakRate: null, leakTest: null, status: null };
      return { index, group, def, calc };
    });
  });

  private calcForKind(kind: CmElementDef['kind'], raw: CmElementFormRaw): ElementCalc {
    switch (kind) {
      case 'pressure':
        return { leakRate: null, ...this.calcPressure(raw.initialPressure, raw.finalPressure) };
      case 'valve':
        return {
          leakRate: null,
          ...this.calcValve(raw.initialPressure, raw.finalPressure, raw.functionTest),
        };
      case 'stuffingBox':
        return {
          leakRate: null,
          leakTest: null,
          status: raw.stuffingBoxStatus === 'Dirty' ? 'Fail' : 'Good',
        };
      case 'dhsv':
        return this.calcDhsv(
          raw.initialPressureWhenInflowTest,
          raw.finalPressure,
          raw.constantForField,
          raw.functionTest,
        );
    }
  }

  private calcPressure(
    init: number | null,
    fin: number | null,
  ): { leakTest: LeakTestResult | null; status: 'Good' | 'Fail' | null } {
    const leakTest = evaluateLeakTest('Positive', init, fin, this.integrityConfig.config().leakTest);
    if (leakTest == null) return { leakTest: null, status: null };
    return { leakTest, status: leakTest === 'Pass' ? 'Good' : 'Fail' };
  }

  private calcValve(
    init: number | null,
    fin: number | null,
    ft: FunctionTestResult | null,
  ): { leakTest: LeakTestResult | null; status: 'Good' | 'Fail' | null } {
    const { leakTest } = this.calcPressure(init, fin);
    if (leakTest == null && ft == null) return { leakTest: null, status: null };
    const status = leakTest === 'Pass' && ft === 'Pass' ? 'Good' : 'Fail';
    return { leakTest, status };
  }

  private calcDhsv(
    initialPressureWhenInflowTest: number | null,
    finalPressure: number | null,
    constantForField: number | null,
    ft: FunctionTestResult | null,
  ): ElementCalc {
    const config = this.dhsvData();
    let leakRate: number | null = null;
    let leakTest: LeakTestResult | null = null;
    if (
      config &&
      initialPressureWhenInflowTest != null &&
      finalPressure != null &&
      constantForField != null
    ) {
      const lc = this.integrityConfig.config().leakTest;
      leakRate = computeDhsvLeakRate(
        config.topSectionId,
        config.dhsvDepth,
        constantForField,
        initialPressureWhenInflowTest,
        finalPressure,
        lc,
      );
      leakTest = evaluateDhsvLeakRate(leakRate, lc);
    }
    const status =
      leakTest === 'Pass' && ft === 'Pass' ? 'Good' : leakTest != null || ft != null ? 'Fail' : null;
    return { leakRate, leakTest, status };
  }

  /** Elements already chosen in other rows, excluded from this row's dropdown to avoid duplicates. */
  protected availableElements(rowIndex: number, defs: readonly CmElementDef[]): CmElementDef[] {
    const chosenElsewhere = new Set(
      this.elementsArray.controls
        .map((g, i) => (i === rowIndex ? null : g.controls.elementKey.value))
        .filter((k): k is string => !!k),
    );
    return defs.filter((e) => !chosenElsewhere.has(e.key));
  }

  protected addElement(): void {
    const group = this.createElementGroup();
    const dh = this.dhsvData();
    if (dh) group.controls.constantForField.setValue(dh.constantForField);
    this.elementsArray.push(group);
  }

  protected removeElement(index: number): void {
    if (this.elementsArray.length > 1) {
      this.elementsArray.removeAt(index);
    }
  }

  protected onElementKeyChange(index: number): void {
    const group = this.elementsArray.at(index);
    const key = group.controls.elementKey.value;
    const dh = this.dhsvData();
    group.reset({
      elementKey: key,
      initialPressure: null,
      finalPressure: null,
      functionTest: null,
      greaseVolume: null,
      stuffingBoxStatus: 'Clean',
      pressureBeforeInflowTest: null,
      initialPressureWhenInflowTest: null,
      hydraulicReturn: null,
      constantForField: dh?.constantForField ?? null,
      rootCause: '',
      correctiveAction: '',
    });
  }

  ngOnInit(): void {
    this.editId = this.route.snapshot.paramMap.get('id');

    if (this.editId) {
      this.cmService.fetchById(this.editId).subscribe((record) => {
        if (!record) return;
        const well = this.wellService.findWell(record.wellId);
        this.wellService.selectAsset(well?.assetId ?? null);
        this.wellService.selectPlatform(well?.platformId ?? null);
        this.wellService.selectWell(record.wellId);
        this.pmService.fetchDhsvByWell(record.wellId).subscribe((d) => {
          this.dhsvData.set(d);
        });
        this.form.patchValue({
          assetId: well?.assetId ?? '',
          platformId: well?.platformId ?? '',
          wellId: record.wellId,
          eventDate: record.eventDate,
          reportedBy: record.reportedBy,
        });
        this.patchElementsArray(record.elements);
      });
    }
  }

  private patchElementsArray(entries: CmElementEntry[]): void {
    this.elementsArray.clear();
    for (const entry of entries) {
      const group = this.createElementGroup();
      group.patchValue({ elementKey: entry.elementKey, ...this.rawFromData(entry.kind, entry.elementData) });
      this.elementsArray.push(group);
    }
    if (this.elementsArray.length === 0) {
      this.elementsArray.push(this.createElementGroup());
    }
  }

  private rawFromData(
    kind: string,
    data: CmPressureData | CmValveData | CmStuffingBoxData | CmDhsvData,
  ): Partial<CmElementFormRaw> {
    switch (kind) {
      case 'pressure': {
        const d = data as CmPressureData;
        return {
          initialPressure: d.initialPressure,
          finalPressure: d.finalPressure,
          rootCause: d.rootCause,
          correctiveAction: d.correctiveAction,
        };
      }
      case 'valve': {
        const d = data as CmValveData;
        return {
          initialPressure: d.initialPressure,
          finalPressure: d.finalPressure,
          functionTest: d.functionTest,
          greaseVolume: d.greaseVolume,
          rootCause: d.rootCause,
          correctiveAction: d.correctiveAction,
        };
      }
      case 'stuffingBox': {
        const d = data as CmStuffingBoxData;
        return {
          stuffingBoxStatus: d.currentStatus,
          rootCause: d.rootCause,
          correctiveAction: d.correctiveAction,
        };
      }
      case 'dhsv': {
        const d = data as CmDhsvData;
        return {
          pressureBeforeInflowTest: d.pressureBeforeInflowTest,
          initialPressureWhenInflowTest: d.initialPressureWhenInflowTest,
          finalPressure: d.finalPressure,
          hydraulicReturn: d.hydraulicReturn,
          functionTest: d.functionTest,
          constantForField: d.constantForField,
          rootCause: d.rootCause,
          correctiveAction: d.correctiveAction,
        };
      }
      default:
        return {};
    }
  }

  protected onAssetChange(event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    this.wellService.selectAsset(id);
    this.form.controls.platformId.setValue('');
    this.form.controls.wellId.setValue('');
    this.dhsvData.set(null);
  }

  protected onPlatformChange(event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    this.wellService.selectPlatform(id);
    this.form.controls.wellId.setValue('');
    this.dhsvData.set(null);
  }

  protected onWellChange(event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    this.wellService.selectWell(id);
    this.form.controls.wellId.setValue(id);
    if (id) {
      this.pmService.fetchDhsvByWell(id).subscribe((d) => {
        this.dhsvData.set(d);
        for (const group of this.elementsArray.controls) {
          group.controls.constantForField.setValue(d ? d.constantForField : null);
        }
      });
    } else {
      this.dhsvData.set(null);
    }
  }

  protected submit(): void {
    this.form.markAllAsTouched();
    this.elementsArray.markAllAsTouched();
    if (this.form.invalid || this.elementsArray.invalid) {
      return;
    }
    this.saving.set(true);
    this.errorMsg.set('');

    const raw = this.form.getRawValue();
    const elements: CmElementEntry[] = this.elementsArray.controls.map((group) => {
      const groupRaw = group.getRawValue();
      const def = findCmElement(groupRaw.elementKey);
      if (!def) throw new Error('Element not found for key: ' + groupRaw.elementKey);
      return {
        elementKey: def.key,
        section: def.section,
        kind: def.kind,
        elementData: buildElementData(
          def.kind,
          groupRaw,
          this.dhsvData(),
          this.integrityConfig.config().leakTest,
        ),
      };
    });

    const value: CmFormValue = {
      wellId: raw.wellId,
      eventDate: raw.eventDate,
      reportedBy: raw.reportedBy,
      elements,
    };

    const op$ = this.editId
      ? this.cmService.updateRecord(this.editId, value)
      : this.cmService.addRecord(value);

    op$.subscribe({
      next: () => this.router.navigate(['/cm-records']),
      error: () => {
        this.saving.set(false);
        this.errorMsg.set('Failed to save record. Please try again.');
      },
    });
  }
}
