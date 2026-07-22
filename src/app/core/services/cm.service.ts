import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import {
  CmDhsvData,
  CmElementData,
  CmElementKind,
  CmFormValue,
  CmPressureData,
  CmRecord,
  CmStuffingBoxData,
  CmValveData,
  ComponentStatus,
  DhsvData,
  FunctionTestResult,
  LeakTestResult,
  StuffingBoxStatus,
} from '../models/well-integrity.models';

type DhsvConfig = Pick<DhsvData, 'topSectionId' | 'dhsvDepth'>;

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

export interface CmElementFormRaw {
  initialPressure: number | null;
  finalPressure: number | null;
  functionTest: FunctionTestResult | null;
  greaseVolume: number | null;
  stuffingBoxStatus: StuffingBoxStatus;
  pressureBeforeInflowTest: number | null;
  initialPressureWhenInflowTest: number | null;
  hydraulicReturn: number | null;
  constantForField: number | null;
  rootCause: string;
  correctiveAction: string;
}

export function buildElementData(
  kind: CmElementKind,
  raw: CmElementFormRaw,
  dhsvConfig?: DhsvConfig | null,
): CmElementData {
  switch (kind) {
    case 'pressure': {
      const lt = leakTest(raw.initialPressure, raw.finalPressure);
      const data: CmPressureData = {
        initialPressure: raw.initialPressure,
        finalPressure: raw.finalPressure,
        leakTest: lt,
        currentStatus: pressureStatus(lt),
        rootCause: raw.rootCause,
        correctiveAction: raw.correctiveAction,
      };
      return data;
    }
    case 'valve': {
      const lt = leakTest(raw.initialPressure, raw.finalPressure);
      const data: CmValveData = {
        initialPressure: raw.initialPressure,
        finalPressure: raw.finalPressure,
        leakTest: lt,
        functionTest: raw.functionTest,
        greaseVolume: raw.greaseVolume,
        currentStatus: valveStatus(lt, raw.functionTest),
        rootCause: raw.rootCause,
        correctiveAction: raw.correctiveAction,
      };
      return data;
    }
    case 'stuffingBox': {
      const data: CmStuffingBoxData = {
        currentStatus: raw.stuffingBoxStatus,
        rootCause: raw.rootCause,
        correctiveAction: raw.correctiveAction,
      };
      return data;
    }
    case 'dhsv': {
      let leakRate: number | null = null;
      let lt: LeakTestResult | null = null;
      if (
        dhsvConfig &&
        raw.initialPressureWhenInflowTest != null &&
        raw.finalPressure != null &&
        raw.constantForField != null
      ) {
        const { topSectionId, dhsvDepth } = dhsvConfig;
        leakRate =
          (topSectionId *
            topSectionId *
            dhsvDepth *
            raw.constantForField *
            (raw.finalPressure - raw.initialPressureWhenInflowTest)) /
          30;
        lt = leakRate <= 15 ? 'Pass' : 'Fail';
      }
      const data: CmDhsvData = {
        pressureBeforeInflowTest: raw.pressureBeforeInflowTest,
        initialPressureWhenInflowTest: raw.initialPressureWhenInflowTest,
        finalPressure: raw.finalPressure,
        leakRate,
        leakTest: lt,
        hydraulicReturn: raw.hydraulicReturn,
        functionTest: raw.functionTest,
        constantForField: raw.constantForField,
        currentStatus: lt === 'Pass' && raw.functionTest === 'Pass' ? 'Good' : 'Fail',
        rootCause: raw.rootCause,
        correctiveAction: raw.correctiveAction,
      };
      return data;
    }
  }
}

@Injectable({ providedIn: 'root' })
export class CmService {
  private readonly http = inject(HttpClient);

  private readonly _records = signal<CmRecord[]>([]);
  readonly records = this._records.asReadonly();

  clear(): void {
    this._records.set([]);
  }

  loadAll(): void {
    this.http.get<CmRecord[]>('/api/cmRecords').subscribe((records) => {
      this._records.set(records);
    });
  }

  loadByWell(wellId: string): void {
    this.http.get<CmRecord[]>(`/api/cmRecords?wellId=${wellId}`).subscribe((records) => {
      this._records.set(records);
    });
  }

  getById(id: string): CmRecord | undefined {
    return this._records().find((r) => r.id === id);
  }

  fetchById(id: string): Observable<CmRecord> {
    return this.http.get<CmRecord>(`/api/cmRecords/${id}`);
  }

  addRecord(value: CmFormValue): Observable<CmRecord> {
    const now = new Date().toISOString();
    const body: CmRecord = {
      id: crypto.randomUUID(),
      wellId: value.wellId,
      eventDate: value.eventDate,
      reportedBy: value.reportedBy,
      createdAt: now,
      updatedAt: now,
      elements: value.elements,
    };
    return this.http.post<CmRecord>('/api/cmRecords', body).pipe(tap(() => this.loadAll()));
  }

  updateRecord(id: string, value: CmFormValue): Observable<CmRecord> {
    const existing = this.getById(id);
    const now = new Date().toISOString();
    const body: CmRecord = {
      ...(existing ?? ({} as CmRecord)),
      id,
      wellId: value.wellId,
      eventDate: value.eventDate,
      reportedBy: value.reportedBy,
      updatedAt: now,
      elements: value.elements,
    };
    return this.http.put<CmRecord>(`/api/cmRecords/${id}`, body).pipe(tap(() => this.loadAll()));
  }
}
