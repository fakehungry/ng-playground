import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  DhsvData,
  FunctionTestResult,
  LeakTestResult,
  PmFormValue,
  PmInspectionData,
  PmStatus,
  StuffingBoxStatus,
  TubingStatus,
} from '../../../core/models/well-integrity.models';
import {
  buildInspectionData,
  InspectionFormRaw,
  PmService,
} from '../../../core/services/pm.service';
import { WellDataService } from '../../../core/services/well-data.service';
import { WellService } from '../../../core/services/well.service';

type SectionKey = 'xtBody' | 'wellhead' | 'tubing' | 'annulusPressure';
type WellheadKey =
  | 'xmtCarrierA'
  | 'tubingHangerCarrierB'
  | 'cavityC'
  | 'tbgHgrSealD'
  | 'csg7inPackOff'
  | 'csg9inPackOff'
  | 'aAnnCsgValve'
  | 'bAnnCsg'
  | 'cAnnCsg'
  | 'aAnnCsgValve2'
  | 'bAnnCsg2'
  | 'cAnnCsg2';
type SecondValveKey = 'aAnnCsgValve2' | 'bAnnCsg2' | 'cAnnCsg2';

@Component({
  selector: 'app-pm-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, DecimalPipe],
  templateUrl: './pm-form.html',
})
export class PmForm implements OnInit {
  private readonly pmService = inject(PmService);
  protected readonly wellService = inject(WellService);
  private readonly wellDataService = inject(WellDataService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected editId: string | null = null;
  protected readonly saving = signal(false);
  protected readonly errorMsg = signal('');
  protected readonly dhsvData = signal<DhsvData | null>(null);
  protected readonly annulusRecord = this.wellDataService.record;

  protected readonly sectionExpanded = signal<Record<SectionKey, boolean>>({
    xtBody: true,
    wellhead: false,
    tubing: false,
    annulusPressure: false,
  });

  protected readonly statusOptions: PmStatus[] = ['Planned', 'In Progress', 'Completed'];
  protected readonly functionTestOptions: FunctionTestResult[] = ['Pass', 'Fail'];
  protected readonly stuffingBoxOptions: StuffingBoxStatus[] = ['Clean', 'Dirty'];
  protected readonly tubingStatusOptions: TubingStatus[] = ['Shut-in', 'Flowing'];

  protected readonly wellheadRows: Array<{
    key: WellheadKey;
    label: string;
    hasFunc: boolean;
    secondKey?: SecondValveKey;
  }> = [
    { key: 'xmtCarrierA', label: 'XMT Carrier (A)', hasFunc: false },
    { key: 'tubingHangerCarrierB', label: 'Tubing Hanger Carrier (B)', hasFunc: false },
    { key: 'cavityC', label: 'Cavity (C)', hasFunc: false },
    { key: 'tbgHgrSealD', label: 'TBG HGR Seal (D)', hasFunc: false },
    { key: 'csg7inPackOff', label: '7" CSG Pack-off', hasFunc: false },
    { key: 'csg9inPackOff', label: '9-5/8" CSG Pack-off', hasFunc: false },
    { key: 'aAnnCsgValve', label: 'A-ann CSG Valve', hasFunc: true, secondKey: 'aAnnCsgValve2' },
    { key: 'bAnnCsg', label: 'B-ann CSG Valve', hasFunc: true, secondKey: 'bAnnCsg2' },
    { key: 'cAnnCsg', label: 'C-ann CSG Valve', hasFunc: true, secondKey: 'cAnnCsg2' },
  ];

  protected readonly secondValveVisible = signal<Record<SecondValveKey, boolean>>({
    aAnnCsgValve2: false,
    bAnnCsg2: false,
    cAnnCsg2: false,
  });

  protected readonly form = new FormGroup({
    assetId: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    platformId: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    wellId: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    jobDescription: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(500)],
    }),
    plannedDate: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    operatorName: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    status: new FormControl<PmStatus>('Planned', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    completedDate: new FormControl<string>('', { nonNullable: true }),
  });

  protected readonly showCompletedDate = signal(false);

  private pressureGroup() {
    return new FormGroup({
      initialPressure: new FormControl<number | null>(null),
      finalPressure: new FormControl<number | null>(null),
      comment: new FormControl<string>('', { nonNullable: true }),
    });
  }

  private valveGroup() {
    return new FormGroup({
      initialPressure: new FormControl<number | null>(null),
      finalPressure: new FormControl<number | null>(null),
      functionTest: new FormControl<FunctionTestResult | null>(null),
      greaseVolume: new FormControl<number | null>(null),
      comment: new FormControl<string>('', { nonNullable: true }),
    });
  }

  protected readonly inspectionForm = new FormGroup({
    xtBody: new FormGroup({
      xtBody: this.pressureGroup(),
      umv: this.valveGroup(),
      lmv: this.valveGroup(),
      wv: this.valveGroup(),
      kwv: this.valveGroup(),
      sv: this.valveGroup(),
      stuffingBox: new FormGroup({
        currentStatus: new FormControl<StuffingBoxStatus>('Clean', { nonNullable: true }),
        comment: new FormControl<string>('', { nonNullable: true }),
      }),
    }),
    wellhead: new FormGroup({
      xmtCarrierA: this.pressureGroup(),
      tubingHangerCarrierB: this.pressureGroup(),
      cavityC: this.pressureGroup(),
      tbgHgrSealD: this.pressureGroup(),
      csg7inPackOff: this.pressureGroup(),
      csg9inPackOff: this.pressureGroup(),
      aAnnCsgValve: this.valveGroup(),
      bAnnCsg: this.valveGroup(),
      cAnnCsg: this.valveGroup(),
      aAnnCsgValve2: this.valveGroup(),
      bAnnCsg2: this.valveGroup(),
      cAnnCsg2: this.valveGroup(),
    }),
    tubing: new FormGroup({
      dhsv: new FormGroup({
        pressureBeforeInflowTest: new FormControl<number | null>(null),
        initialPressureWhenInflowTest: new FormControl<number | null>(null),
        finalPressure: new FormControl<number | null>(null),
        hydraulicReturn: new FormControl<number | null>(null),
        functionTest: new FormControl<FunctionTestResult | null>(null),
        constantForField: new FormControl<number | null>(null), // pre-filled from API, not saved
        comment: new FormControl<string>('', { nonNullable: true }),
      }),
      tubing: new FormGroup({
        pressureBefore: new FormControl<number | null>(null),
        pressureAfter: new FormControl<number | null>(null),
        temperatureBefore: new FormControl<number | null>(null),
        temperatureAfter: new FormControl<number | null>(null),
        currentStatus: new FormControl<TubingStatus>('Shut-in', { nonNullable: true }),
        comment: new FormControl<string>('', { nonNullable: true }),
      }),
    }),
    annulusPressure: new FormGroup({
      aAnn: new FormGroup({
        currentPressure: new FormControl<number | null>(null),
        pbuRate: new FormControl<number | null>(null),
        comment: new FormControl<string>('', { nonNullable: true }),
      }),
      bAnn: new FormGroup({
        currentPressure: new FormControl<number | null>(null),
        pbuRate: new FormControl<number | null>(null),
        comment: new FormControl<string>('', { nonNullable: true }),
      }),
      cAnn: new FormGroup({
        currentPressure: new FormControl<number | null>(null),
        pbuRate: new FormControl<number | null>(null),
        comment: new FormControl<string>('', { nonNullable: true }),
      }),
    }),
  });

  // Converts form valueChanges into a signal so computed() tracks it reactively
  private readonly _formTick = toSignal(this.inspectionForm.valueChanges, { initialValue: null });

  protected readonly xtBodyCalc = computed(() => {
    this._formTick();
    const f = this.inspectionForm.controls.xtBody.getRawValue();
    return {
      xtBody: this.calcPressure(f.xtBody.initialPressure, f.xtBody.finalPressure),
      umv: this.calcValve(f.umv.initialPressure, f.umv.finalPressure, f.umv.functionTest),
      lmv: this.calcValve(f.lmv.initialPressure, f.lmv.finalPressure, f.lmv.functionTest),
      wv: this.calcValve(f.wv.initialPressure, f.wv.finalPressure, f.wv.functionTest),
      kwv: this.calcValve(f.kwv.initialPressure, f.kwv.finalPressure, f.kwv.functionTest),
      sv: this.calcValve(f.sv.initialPressure, f.sv.finalPressure, f.sv.functionTest),
    };
  });

  protected readonly wellheadCalc = computed(() => {
    this._formTick();
    const f = this.inspectionForm.controls.wellhead.getRawValue();
    return {
      xmtCarrierA: this.calcPressure(f.xmtCarrierA.initialPressure, f.xmtCarrierA.finalPressure),
      tubingHangerCarrierB: this.calcPressure(
        f.tubingHangerCarrierB.initialPressure,
        f.tubingHangerCarrierB.finalPressure,
      ),
      cavityC: this.calcPressure(f.cavityC.initialPressure, f.cavityC.finalPressure),
      tbgHgrSealD: this.calcPressure(f.tbgHgrSealD.initialPressure, f.tbgHgrSealD.finalPressure),
      csg7inPackOff: this.calcPressure(
        f.csg7inPackOff.initialPressure,
        f.csg7inPackOff.finalPressure,
      ),
      csg9inPackOff: this.calcPressure(
        f.csg9inPackOff.initialPressure,
        f.csg9inPackOff.finalPressure,
      ),
      aAnnCsgValve: this.calcValve(
        f.aAnnCsgValve.initialPressure,
        f.aAnnCsgValve.finalPressure,
        f.aAnnCsgValve.functionTest,
      ),
      bAnnCsg: this.calcValve(
        f.bAnnCsg.initialPressure,
        f.bAnnCsg.finalPressure,
        f.bAnnCsg.functionTest,
      ),
      cAnnCsg: this.calcValve(
        f.cAnnCsg.initialPressure,
        f.cAnnCsg.finalPressure,
        f.cAnnCsg.functionTest,
      ),
      aAnnCsgValve2: this.calcValve(
        f.aAnnCsgValve2.initialPressure,
        f.aAnnCsgValve2.finalPressure,
        f.aAnnCsgValve2.functionTest,
      ),
      bAnnCsg2: this.calcValve(
        f.bAnnCsg2.initialPressure,
        f.bAnnCsg2.finalPressure,
        f.bAnnCsg2.functionTest,
      ),
      cAnnCsg2: this.calcValve(
        f.cAnnCsg2.initialPressure,
        f.cAnnCsg2.finalPressure,
        f.cAnnCsg2.functionTest,
      ),
    };
  });

  protected readonly tubingCalc = computed(() => {
    this._formTick();
    const dhsv = this.inspectionForm.controls.tubing.controls.dhsv.getRawValue();
    const config = this.dhsvData();
    let leakRate: number | null = null;
    let leakTest: LeakTestResult | null = null;
    if (
      config &&
      dhsv.initialPressureWhenInflowTest != null &&
      dhsv.finalPressure != null &&
      dhsv.constantForField != null
    ) {
      leakRate =
        (config.topSectionId *
          config.topSectionId *
          config.dhsvDepth *
          dhsv.constantForField *
          (dhsv.finalPressure - dhsv.initialPressureWhenInflowTest)) /
        30;
      leakTest = leakRate <= 15 ? 'Pass' : 'Fail';
    }
    const dhsvStatus =
      leakTest === 'Pass' && dhsv.functionTest === 'Pass'
        ? 'Good'
        : leakTest != null || dhsv.functionTest != null
          ? 'Fail'
          : null;
    return { leakRate, leakTest, dhsvStatus };
  });

  protected readonly annPressureCalc = computed(() => {
    this._formTick();
    const f = this.inspectionForm.controls.annulusPressure.getRawValue();
    const ar = this.annulusRecord();
    return {
      aAnn: this.calcAnnPressure(f.aAnn.currentPressure, ar?.annuli.A.tow ?? null),
      bAnn: this.calcAnnPressure(f.bAnn.currentPressure, ar?.annuli.B.tow ?? null),
      cAnn: this.calcAnnPressure(f.cAnn.currentPressure, ar?.annuli.C.tow ?? null),
    };
  });

  private calcPressure(
    init: number | null,
    fin: number | null,
  ): { leakTest: LeakTestResult | null; status: 'Good' | 'Fail' | null } {
    if (init == null || fin == null || init === 0) return { leakTest: null, status: null };
    const pass = fin / init >= 0.97;
    return { leakTest: pass ? 'Pass' : 'Fail', status: pass ? 'Good' : 'Fail' };
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

  private calcAnnPressure(cp: number | null, tow: number | null): 'Good' | 'Fail' | null {
    if (cp == null || tow == null) return null;
    return cp <= tow ? 'Good' : 'Fail';
  }

  ngOnInit(): void {
    this.editId = this.route.snapshot.paramMap.get('id');

    if (this.editId) {
      this.pmService.fetchById(this.editId).subscribe((record) => {
        if (!record) return;
        const well = this.wellService.findWell(record.wellId);
        this.wellService.selectAsset(well?.assetId ?? null);
        this.wellService.selectPlatform(well?.platformId ?? null);
        this.wellService.selectWell(record.wellId);
        this.wellDataService.loadByWell(record.wellId);
        this.pmService.fetchDhsvByWell(record.wellId).subscribe((d) => {
          this.dhsvData.set(d);
          if (d)
            this.inspectionForm.controls.tubing.controls.dhsv.controls.constantForField.setValue(
              d.constantForField,
            );
        });
        this.form.patchValue({
          assetId: well?.assetId ?? '',
          platformId: well?.platformId ?? '',
          wellId: record.wellId,
          jobDescription: record.jobDescription,
          plannedDate: record.plannedDate,
          operatorName: record.operatorName,
          status: record.status,
          completedDate: record.completedDate ?? '',
        });
        this.showCompletedDate.set(record.status === 'Completed');
        this.updateCompletedValidator(record.status === 'Completed');

        if (record.inspectionData) {
          this.patchInspectionForm(record.inspectionData);
        }
      });
    }
  }

  private patchInspectionForm(data: PmInspectionData): void {
    const pv = (c: {
      initialPressure: number | null;
      finalPressure: number | null;
      comment: string;
    }) => ({
      initialPressure: c.initialPressure,
      finalPressure: c.finalPressure,
      comment: c.comment,
    });
    const vv = (c: {
      initialPressure: number | null;
      finalPressure: number | null;
      functionTest: FunctionTestResult | null;
      greaseVolume: number | null;
      comment: string;
    }) => ({
      initialPressure: c.initialPressure,
      finalPressure: c.finalPressure,
      functionTest: c.functionTest,
      greaseVolume: c.greaseVolume,
      comment: c.comment,
    });

    this.inspectionForm.patchValue({
      xtBody: {
        xtBody: pv(data.xtBody.xtBody),
        umv: vv(data.xtBody.umv),
        lmv: vv(data.xtBody.lmv),
        wv: vv(data.xtBody.wv),
        kwv: vv(data.xtBody.kwv),
        sv: vv(data.xtBody.sv),
        stuffingBox: data.xtBody.stuffingBox,
      },
      wellhead: {
        xmtCarrierA: pv(data.wellhead.xmtCarrierA),
        tubingHangerCarrierB: pv(data.wellhead.tubingHangerCarrierB),
        cavityC: pv(data.wellhead.cavityC),
        tbgHgrSealD: pv(data.wellhead.tbgHgrSealD),
        csg7inPackOff: pv(data.wellhead.csg7inPackOff),
        csg9inPackOff: pv(data.wellhead.csg9inPackOff),
        aAnnCsgValve: vv(data.wellhead.aAnnCsgValve),
        bAnnCsg: vv(data.wellhead.bAnnCsg),
        cAnnCsg: vv(data.wellhead.cAnnCsg),
      },
      tubing: {
        dhsv: {
          pressureBeforeInflowTest: data.tubing.dhsv.pressureBeforeInflowTest,
          initialPressureWhenInflowTest: data.tubing.dhsv.initialPressureWhenInflowTest,
          finalPressure: data.tubing.dhsv.finalPressure,
          hydraulicReturn: data.tubing.dhsv.hydraulicReturn,
          functionTest: data.tubing.dhsv.functionTest,
          comment: data.tubing.dhsv.comment,
        },
        tubing: {
          pressureBefore: data.tubing.tubing.pressureBefore,
          pressureAfter: data.tubing.tubing.pressureAfter,
          temperatureBefore: data.tubing.tubing.temperatureBefore,
          temperatureAfter: data.tubing.tubing.temperatureAfter,
          currentStatus: data.tubing.tubing.currentStatus,
          comment: data.tubing.tubing.comment,
        },
      },
      annulusPressure: {
        aAnn: {
          currentPressure: data.annulusPressure.aAnn.currentPressure,
          pbuRate: data.annulusPressure.aAnn.pbuRate,
          comment: data.annulusPressure.aAnn.comment,
        },
        bAnn: {
          currentPressure: data.annulusPressure.bAnn.currentPressure,
          pbuRate: data.annulusPressure.bAnn.pbuRate,
          comment: data.annulusPressure.bAnn.comment,
        },
        cAnn: {
          currentPressure: data.annulusPressure.cAnn.currentPressure,
          pbuRate: data.annulusPressure.cAnn.pbuRate,
          comment: data.annulusPressure.cAnn.comment,
        },
      },
    });

    (['aAnnCsgValve2', 'bAnnCsg2', 'cAnnCsg2'] as const).forEach((key) => {
      const secondValve = data.wellhead[key];
      if (secondValve) {
        this.inspectionForm.controls.wellhead.controls[key].patchValue(vv(secondValve));
      }
      this.secondValveVisible.update((s) => ({ ...s, [key]: !!secondValve }));
    });
  }

  protected toggleSection(key: SectionKey): void {
    this.sectionExpanded.update((s) => ({ ...s, [key]: !s[key] }));
  }

  protected toggleSecondValve(key: SecondValveKey): void {
    const showing = this.secondValveVisible()[key];
    if (showing) {
      this.inspectionForm.controls.wellhead.controls[key].reset({
        initialPressure: null,
        finalPressure: null,
        functionTest: null,
        comment: '',
      });
    }
    this.secondValveVisible.update((s) => ({ ...s, [key]: !showing }));
  }

  protected onAssetChange(event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    this.wellService.selectAsset(id);
    this.form.controls.platformId.setValue('');
    this.form.controls.wellId.setValue('');
    this.dhsvData.set(null);
    this.wellDataService.clear();
  }

  protected onPlatformChange(event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    this.wellService.selectPlatform(id);
    this.form.controls.wellId.setValue('');
    this.dhsvData.set(null);
    this.wellDataService.clear();
  }

  protected onWellChange(event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    this.wellService.selectWell(id);
    this.form.controls.wellId.setValue(id);
    if (id) {
      this.wellDataService.loadByWell(id);
      this.pmService.fetchDhsvByWell(id).subscribe((d) => {
        this.dhsvData.set(d);
        this.inspectionForm.controls.tubing.controls.dhsv.controls.constantForField.setValue(
          d ? d.constantForField : null,
        );
      });
    } else {
      this.dhsvData.set(null);
      this.wellDataService.clear();
    }
  }

  protected onStatusChange(event: Event): void {
    const status = (event.target as HTMLSelectElement).value as PmStatus;
    const isCompleted = status === 'Completed';
    this.showCompletedDate.set(isCompleted);
    this.updateCompletedValidator(isCompleted);
  }

  private updateCompletedValidator(required: boolean): void {
    const ctrl = this.form.controls.completedDate;
    if (required) {
      ctrl.setValidators([Validators.required]);
    } else {
      ctrl.clearValidators();
      ctrl.setValue('');
    }
    ctrl.updateValueAndValidity();
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.errorMsg.set('');

    const raw = this.form.getRawValue();
    const inspRaw = this.inspectionForm.getRawValue() as InspectionFormRaw;
    const dhsvConstant =
      this.inspectionForm.controls.tubing.controls.dhsv.controls.constantForField.value;
    const inspectionData = buildInspectionData(
      inspRaw,
      this.annulusRecord(),
      this.dhsvData(),
      dhsvConstant,
    );

    const value: PmFormValue = {
      wellId: raw.wellId,
      jobDescription: raw.jobDescription,
      plannedDate: raw.plannedDate,
      operatorName: raw.operatorName,
      status: raw.status,
      completedDate: raw.completedDate || null,
      inspectionData,
    };

    const op$ = this.editId
      ? this.pmService.updateRecord(this.editId, value)
      : this.pmService.addRecord(value);

    op$.subscribe({
      next: () => this.router.navigate(['/pm-records']),
      error: () => {
        this.saving.set(false);
        this.errorMsg.set('Failed to save record. Please try again.');
      },
    });
  }
}
