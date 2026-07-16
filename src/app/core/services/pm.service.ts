import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { map, Observable, tap } from 'rxjs';
import {
  AnnulusPressureComponent,
  AnnulusPressureSection,
  ComponentStatus,
  DhsvComponent,
  DhsvData,
  FunctionTestResult,
  LeakTestResult,
  PmFormValue,
  PmInspectionData,
  PmRecord,
  PressureComponent,
  TubingSection,
  ValveComponent,
  WellAnnulusRecord,
  WellheadSection,
  XtBodySection,
} from '../models/well-integrity.models';

type DhsvConfig = Pick<DhsvData, 'topSectionId' | 'dhsvDepth'>;

function addOneYear(isoDate: string): string {
  const d = new Date(isoDate);
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

function leakTest(initial: number | null, final: number | null): LeakTestResult | null {
  if (initial == null || final == null || initial === 0) return null;
  return final / initial >= 0.97 ? 'Pass' : 'Fail';
}

function pressureStatus(lt: LeakTestResult | null): ComponentStatus {
  return lt === 'Pass' ? 'Good' : 'Fail';
}

function valveStatus(lt: LeakTestResult | null, ft: FunctionTestResult | null): ComponentStatus {
  return lt === 'Pass' && ft === 'Pass' ? 'Good' : 'Fail';
}

function sectionStatus(statuses: ComponentStatus[]): ComponentStatus {
  return statuses.includes('Fail') ? 'Fail' : 'Good';
}

export interface InspectionFormRaw {
  xtBody: {
    xtBody: { initialPressure: number | null; finalPressure: number | null; comment: string };
    umv: {
      initialPressure: number | null;
      finalPressure: number | null;
      functionTest: FunctionTestResult | null;
      greaseVolume: number | null;
      comment: string;
    };
    lmv: {
      initialPressure: number | null;
      finalPressure: number | null;
      functionTest: FunctionTestResult | null;
      greaseVolume: number | null;
      comment: string;
    };
    wv: {
      initialPressure: number | null;
      finalPressure: number | null;
      functionTest: FunctionTestResult | null;
      greaseVolume: number | null;
      comment: string;
    };
    kwv: {
      initialPressure: number | null;
      finalPressure: number | null;
      functionTest: FunctionTestResult | null;
      greaseVolume: number | null;
      comment: string;
    };
    sv: {
      initialPressure: number | null;
      finalPressure: number | null;
      functionTest: FunctionTestResult | null;
      greaseVolume: number | null;
      comment: string;
    };
    stuffingBox: { currentStatus: 'Clean' | 'Dirty'; comment: string };
  };
  wellhead: {
    xmtCarrierA: { initialPressure: number | null; finalPressure: number | null; comment: string };
    tubingHangerCarrierB: {
      initialPressure: number | null;
      finalPressure: number | null;
      comment: string;
    };
    cavityC: { initialPressure: number | null; finalPressure: number | null; comment: string };
    tbgHgrSealD: { initialPressure: number | null; finalPressure: number | null; comment: string };
    csg7inPackOff: {
      initialPressure: number | null;
      finalPressure: number | null;
      comment: string;
    };
    csg9inPackOff: {
      initialPressure: number | null;
      finalPressure: number | null;
      comment: string;
    };
    aAnnCsgValve: {
      initialPressure: number | null;
      finalPressure: number | null;
      functionTest: FunctionTestResult | null;
      greaseVolume: number | null;
      comment: string;
    };
    bAnnCsg: {
      initialPressure: number | null;
      finalPressure: number | null;
      functionTest: FunctionTestResult | null;
      greaseVolume: number | null;
      comment: string;
    };
    cAnnCsg: {
      initialPressure: number | null;
      finalPressure: number | null;
      functionTest: FunctionTestResult | null;
      greaseVolume: number | null;
      comment: string;
    };
    aAnnCsgValve2: {
      initialPressure: number | null;
      finalPressure: number | null;
      functionTest: FunctionTestResult | null;
      greaseVolume: number | null;
      comment: string;
    };
    bAnnCsg2: {
      initialPressure: number | null;
      finalPressure: number | null;
      functionTest: FunctionTestResult | null;
      greaseVolume: number | null;
      comment: string;
    };
    cAnnCsg2: {
      initialPressure: number | null;
      finalPressure: number | null;
      functionTest: FunctionTestResult | null;
      greaseVolume: number | null;
      comment: string;
    };
  };
  tubing: {
    dhsv: {
      pressureBeforeInflowTest: number | null;
      initialPressureWhenInflowTest: number | null;
      finalPressure: number | null;
      hydraulicReturn: number | null;
      functionTest: FunctionTestResult | null;
      comment: string;
    };
    tubing: {
      pressureBefore: number | null;
      pressureAfter: number | null;
      temperatureBefore: number | null;
      temperatureAfter: number | null;
      currentStatus: 'Shut-in' | 'Flowing';
      comment: string;
    };
  };
  annulusPressure: {
    aAnn: { currentPressure: number | null; pbuRate: number | null; comment: string };
    bAnn: { currentPressure: number | null; pbuRate: number | null; comment: string };
    cAnn: { currentPressure: number | null; pbuRate: number | null; comment: string };
  };
}

function buildPressureComponent(raw: {
  initialPressure: number | null;
  finalPressure: number | null;
  comment: string;
}): PressureComponent {
  const lt = leakTest(raw.initialPressure, raw.finalPressure);
  return {
    initialPressure: raw.initialPressure,
    finalPressure: raw.finalPressure,
    leakTest: lt,
    currentStatus: pressureStatus(lt),
    comment: raw.comment,
  };
}

function buildValveComponent(raw: {
  initialPressure: number | null;
  finalPressure: number | null;
  functionTest: FunctionTestResult | null;
  greaseVolume: number | null;
  comment: string;
}): ValveComponent {
  const lt = leakTest(raw.initialPressure, raw.finalPressure);
  return {
    initialPressure: raw.initialPressure,
    finalPressure: raw.finalPressure,
    leakTest: lt,
    functionTest: raw.functionTest,
    greaseVolume: raw.greaseVolume,
    currentStatus: valveStatus(lt, raw.functionTest),
    comment: raw.comment,
  };
}

function hasValveInput(raw: {
  initialPressure: number | null;
  finalPressure: number | null;
  functionTest: FunctionTestResult | null;
  greaseVolume: number | null;
  comment: string;
}): boolean {
  return (
    raw.initialPressure != null ||
    raw.finalPressure != null ||
    raw.functionTest != null ||
    raw.greaseVolume != null ||
    raw.comment.trim() !== ''
  );
}

export function buildInspectionData(
  raw: InspectionFormRaw,
  annulusRecord: WellAnnulusRecord | null,
  dhsvConfig?: DhsvConfig | null,
  dhsvConstantOverride?: number | null,
): PmInspectionData {
  const xtBodyComp = buildPressureComponent(raw.xtBody.xtBody);
  const umv = buildValveComponent(raw.xtBody.umv);
  const lmv = buildValveComponent(raw.xtBody.lmv);
  const wv = buildValveComponent(raw.xtBody.wv);
  const kwv = buildValveComponent(raw.xtBody.kwv);
  const sv = buildValveComponent(raw.xtBody.sv);
  const stuffingBox = raw.xtBody.stuffingBox;

  const xtBodySection: XtBodySection = {
    currentStatus: sectionStatus([
      xtBodyComp.currentStatus,
      umv.currentStatus,
      lmv.currentStatus,
      wv.currentStatus,
      kwv.currentStatus,
      sv.currentStatus,
      stuffingBox.currentStatus === 'Dirty' ? 'Fail' : 'Good',
    ]),
    xtBody: xtBodyComp,
    umv,
    lmv,
    wv,
    kwv,
    sv,
    stuffingBox,
  };

  const xmtA = buildPressureComponent(raw.wellhead.xmtCarrierA);
  const thcB = buildPressureComponent(raw.wellhead.tubingHangerCarrierB);
  const cavC = buildPressureComponent(raw.wellhead.cavityC);
  const tbgD = buildPressureComponent(raw.wellhead.tbgHgrSealD);
  const csg7 = buildPressureComponent(raw.wellhead.csg7inPackOff);
  const csg9 = buildPressureComponent(raw.wellhead.csg9inPackOff);
  const aAnnValve = buildValveComponent(raw.wellhead.aAnnCsgValve);
  const bAnn = buildValveComponent(raw.wellhead.bAnnCsg);
  const cAnn = buildValveComponent(raw.wellhead.cAnnCsg);
  const aAnnValve2 = hasValveInput(raw.wellhead.aAnnCsgValve2)
    ? buildValveComponent(raw.wellhead.aAnnCsgValve2)
    : undefined;
  const bAnn2 = hasValveInput(raw.wellhead.bAnnCsg2)
    ? buildValveComponent(raw.wellhead.bAnnCsg2)
    : undefined;
  const cAnn2 = hasValveInput(raw.wellhead.cAnnCsg2)
    ? buildValveComponent(raw.wellhead.cAnnCsg2)
    : undefined;

  const wellheadSection: WellheadSection = {
    currentStatus: sectionStatus([
      xmtA.currentStatus,
      thcB.currentStatus,
      cavC.currentStatus,
      tbgD.currentStatus,
      csg7.currentStatus,
      csg9.currentStatus,
      aAnnValve.currentStatus,
      bAnn.currentStatus,
      cAnn.currentStatus,
      ...(aAnnValve2 ? [aAnnValve2.currentStatus] : []),
      ...(bAnn2 ? [bAnn2.currentStatus] : []),
      ...(cAnn2 ? [cAnn2.currentStatus] : []),
    ]),
    xmtCarrierA: xmtA,
    tubingHangerCarrierB: thcB,
    cavityC: cavC,
    tbgHgrSealD: tbgD,
    csg7inPackOff: csg7,
    csg9inPackOff: csg9,
    aAnnCsgValve: aAnnValve,
    bAnnCsg: bAnn,
    cAnnCsg: cAnn,
    ...(aAnnValve2 ? { aAnnCsgValve2: aAnnValve2 } : {}),
    ...(bAnn2 ? { bAnnCsg2: bAnn2 } : {}),
    ...(cAnn2 ? { cAnnCsg2: cAnn2 } : {}),
  };

  const dhsvRaw = raw.tubing.dhsv;
  const constant = dhsvConstantOverride ?? null;
  let dhsvLeakRate: number | null = null;
  let dhsvLeakTest: LeakTestResult | null = null;
  if (
    dhsvConfig &&
    dhsvRaw.initialPressureWhenInflowTest != null &&
    dhsvRaw.finalPressure != null &&
    constant != null
  ) {
    const { topSectionId, dhsvDepth } = dhsvConfig;
    dhsvLeakRate =
      (topSectionId *
        topSectionId *
        dhsvDepth *
        constant *
        (dhsvRaw.finalPressure - dhsvRaw.initialPressureWhenInflowTest)) /
      30;
    dhsvLeakTest = dhsvLeakRate <= 15 ? 'Pass' : 'Fail';
  }
  const dhsvComp: DhsvComponent = {
    pressureBeforeInflowTest: dhsvRaw.pressureBeforeInflowTest,
    initialPressureWhenInflowTest: dhsvRaw.initialPressureWhenInflowTest,
    finalPressure: dhsvRaw.finalPressure,
    leakRate: dhsvLeakRate,
    leakTest: dhsvLeakTest,
    hydraulicReturn: dhsvRaw.hydraulicReturn,
    functionTest: dhsvRaw.functionTest,
    currentStatus: dhsvLeakTest === 'Pass' && dhsvRaw.functionTest === 'Pass' ? 'Good' : 'Fail',
    comment: dhsvRaw.comment,
  };

  const tubingRaw = raw.tubing.tubing;
  const tubingSection: TubingSection = {
    currentStatus: dhsvComp.currentStatus === 'Fail' ? 'Fail' : 'Good',
    dhsv: dhsvComp,
    tubing: { ...tubingRaw },
  };

  function annPressureComp(
    rawAnn: { currentPressure: number | null; pbuRate: number | null; comment: string },
    tow: number | null,
  ): AnnulusPressureComponent {
    const cs: ComponentStatus =
      rawAnn.currentPressure != null && tow != null && rawAnn.currentPressure <= tow
        ? 'Good'
        : 'Fail';
    return {
      tow,
      currentPressure: rawAnn.currentPressure,
      pbuRate: rawAnn.pbuRate,
      currentStatus: cs,
      comment: rawAnn.comment,
    };
  }

  const annulusPressureSection: AnnulusPressureSection = {
    aAnn: annPressureComp(raw.annulusPressure.aAnn, annulusRecord?.annuli.A.tow ?? null),
    bAnn: annPressureComp(raw.annulusPressure.bAnn, annulusRecord?.annuli.B.tow ?? null),
    cAnn: annPressureComp(raw.annulusPressure.cAnn, annulusRecord?.annuli.C.tow ?? null),
  };

  return {
    xtBody: xtBodySection,
    wellhead: wellheadSection,
    tubing: tubingSection,
    annulusPressure: annulusPressureSection,
  };
}

@Injectable({ providedIn: 'root' })
export class PmService {
  private readonly http = inject(HttpClient);

  private readonly _records = signal<PmRecord[]>([]);
  readonly records = this._records.asReadonly();

  clear(): void {
    this._records.set([]);
  }

  loadAll(): void {
    this.http.get<PmRecord[]>('/api/pmRecords').subscribe((records) => {
      this._records.set(records);
    });
  }

  loadByWell(wellId: string): void {
    this.http.get<PmRecord[]>(`/api/pmRecords?wellId=${wellId}`).subscribe((records) => {
      this._records.set(records);
    });
  }

  getById(id: string): PmRecord | undefined {
    return this._records().find((r) => r.id === id);
  }

  fetchById(id: string): Observable<PmRecord> {
    return this.http.get<PmRecord>(`/api/pmRecords/${id}`);
  }

  fetchDhsvByWell(wellId: string): Observable<DhsvData | null> {
    return this.http
      .get<DhsvData[]>(`/api/dhsvData?wellId=${wellId}`)
      .pipe(map((records) => records[0] ?? null));
  }

  addRecord(value: PmFormValue): Observable<PmRecord> {
    const now = new Date().toISOString();
    const body: PmRecord = {
      id: crypto.randomUUID(),
      wellId: value.wellId,
      jobDescription: value.jobDescription,
      plannedDate: value.plannedDate,
      operatorName: value.operatorName,
      status: value.status,
      createdAt: now,
      updatedAt: now,
      ...(value.status === 'Completed' && value.completedDate
        ? { completedDate: value.completedDate, nextPmDate: addOneYear(value.completedDate) }
        : {}),
      ...(value.inspectionData ? { inspectionData: value.inspectionData } : {}),
    };
    return this.http.post<PmRecord>('/api/pmRecords', body).pipe(tap(() => this.loadAll()));
  }

  updateRecord(id: string, value: PmFormValue): Observable<PmRecord> {
    const existing = this.getById(id);
    const now = new Date().toISOString();
    const body: PmRecord = {
      ...(existing ?? ({} as PmRecord)),
      id,
      wellId: value.wellId,
      jobDescription: value.jobDescription,
      plannedDate: value.plannedDate,
      operatorName: value.operatorName,
      status: value.status,
      updatedAt: now,
      completedDate:
        value.status === 'Completed' && value.completedDate ? value.completedDate : undefined,
      nextPmDate:
        value.status === 'Completed' && value.completedDate
          ? addOneYear(value.completedDate)
          : undefined,
      ...(value.inspectionData ? { inspectionData: value.inspectionData } : {}),
    };
    return this.http.put<PmRecord>(`/api/pmRecords/${id}`, body).pipe(tap(() => this.loadAll()));
  }
}
