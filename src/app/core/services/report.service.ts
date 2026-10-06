import { inject, Injectable } from '@angular/core';
import {
  AnnulusData,
  AnnulusIntegrityResult,
  AnnulusPressureSection,
  AnnulusType,
  IntegrityStatus,
  PmInspectionData,
  TubingSection,
  ValveComponent,
  WellAnnulusRecord,
  WellheadSection,
  WellIntegrityReport,
  WellStatusRow,
  XtBodySection,
} from '../models/well-integrity.models';
import { PmService } from './pm.service';
import { computeAnnulusStatus, WellDataService } from './well-data.service';
import { WellService } from './well.service';

const ANNULUS_TYPES: AnnulusType[] = ['A', 'B', 'C'];
const STATUS_RANK: Record<IntegrityStatus, number> = { fail: 3, warning: 2, 'no-data': 1, pass: 0 };

function addMonths(isoDate: string, months: number): string {
  const d = new Date(isoDate);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

export function worstStatus(...statuses: IntegrityStatus[]): IntegrityStatus {
  return statuses.reduce(
    (worst, s) => (STATUS_RANK[s] > STATUS_RANK[worst] ? s : worst),
    'pass' as IntegrityStatus,
  );
}

function checkMopVsMasp(data: AnnulusData): IntegrityStatus {
  if (data.mop === null || data.masp === null) return 'no-data';
  return data.mop > data.masp ? 'fail' : 'pass';
}

function checkMespVsMasp(mesp: number | null, data: AnnulusData): IntegrityStatus {
  if (mesp === null || data.masp === null) return 'no-data';
  if (mesp > data.masp) return 'fail';
  if (mesp / data.masp > 0.85) return 'warning';
  return 'pass';
}

// --- Per-component status functions ---

export function computeXtStatus(xt?: XtBodySection): IntegrityStatus {
  if (!xt) return 'no-data';
  const valves = [xt.umv, xt.lmv, xt.wv, xt.kwv, xt.sv];
  if (valves.some((v) => v.leakTest === 'Fail' && v.functionTest === 'Fail')) return 'fail';
  if (valves.some((v) => v.leakTest === 'Fail' || v.functionTest === 'Fail')) return 'warning';
  return 'pass';
}

export function computeWhStatus(wh?: WellheadSection): IntegrityStatus {
  if (!wh) return 'no-data';
  const packoffs = [wh.csg7inPackOff, wh.csg9inPackOff];
  const annValves = [
    wh.aAnnCsgValve,
    wh.bAnnCsg,
    wh.cAnnCsg,
    wh.aAnnCsgValve2,
    wh.bAnnCsg2,
    wh.cAnnCsg2,
  ].filter((v): v is ValveComponent => v != null);
  if (packoffs.some((p) => p.leakTest === 'Fail')) return 'fail';
  if (annValves.some((v) => v.leakTest === 'Fail' && v.functionTest === 'Fail')) return 'fail';
  if (annValves.some((v) => v.leakTest === 'Fail' || v.functionTest === 'Fail')) return 'warning';
  return 'pass';
}

// THGR = Tubing Hanger ports: XMT Carrier A, TBG Hanger B, Cavity C, Seal D
export function computeThgrStatus(wh?: WellheadSection): IntegrityStatus {
  if (!wh) return 'no-data';
  const ports = [wh.xmtCarrierA, wh.tubingHangerCarrierB, wh.cavityC, wh.tbgHgrSealD];
  if (ports.some((p) => p.leakTest === 'Fail')) return 'fail';
  return 'pass';
}

export function computeDhsvStatus(tubing?: TubingSection): IntegrityStatus {
  if (!tubing?.dhsv) return 'no-data';
  const { leakTest, functionTest } = tubing.dhsv;
  if (leakTest === 'Fail' && functionTest === 'Fail') return 'fail';
  if (leakTest === 'Fail' || functionTest === 'Fail') return 'warning';
  return 'pass';
}

export function computeTbgStatus(tubing?: TubingSection): IntegrityStatus {
  if (!tubing) return 'no-data';
  return tubing.currentStatus === 'Fail' ? 'fail' : 'pass';
}

export function computeAnnPressureStatus(annP?: AnnulusPressureSection): IntegrityStatus {
  if (!annP) return 'no-data';
  const statuses: IntegrityStatus[] = [annP.aAnn, annP.bAnn, annP.cAnn].map((a) => {
    if (a.tow != null && a.currentPressure != null) {
      if (a.currentPressure > a.tow) return 'fail';
      if (a.currentPressure / a.tow > 0.85) return 'warning';
      return 'pass';
    }
    return a.currentStatus === 'Fail' ? 'fail' : 'pass';
  });
  return worstStatus(...statuses);
}

export function buildIssueText(insp?: PmInspectionData): string {
  if (!insp) return '';
  const issues: string[] = [];

  const xt = insp.xtBody;
  const xtValves: [string, typeof xt.umv][] = [
    ['UMV', xt.umv],
    ['LMV', xt.lmv],
    ['WV', xt.wv],
    ['KWV', xt.kwv],
    ['SV', xt.sv],
  ];
  xtValves.forEach(([name, v]) => {
    if (v.leakTest === 'Fail' || v.functionTest === 'Fail') {
      const parts = [];
      if (v.leakTest === 'Fail') parts.push('leak');
      if (v.functionTest === 'Fail') parts.push('fn');
      issues.push(`XT ${name}: ${parts.join('+')} fail`);
    }
  });

  const wh = insp.wellhead;
  const packoffs: [string, typeof wh.csg7inPackOff][] = [
    ['7in PackOff', wh.csg7inPackOff],
    ['9-5/8in PackOff', wh.csg9inPackOff],
  ];
  packoffs.forEach(([name, p]) => {
    if (p.leakTest === 'Fail') issues.push(`WH ${name}: leak fail`);
  });

  const dhsv = insp.tubing.dhsv;
  if (dhsv.leakTest === 'Fail' || dhsv.functionTest === 'Fail') {
    const parts = [];
    if (dhsv.leakTest === 'Fail') parts.push('leak');
    if (dhsv.functionTest === 'Fail') parts.push('fn');
    issues.push(`DHSV: ${parts.join('+')} fail`);
  }

  return issues.join('; ');
}

function barrierStatus(
  annType: AnnulusType,
  rec: WellAnnulusRecord | null | undefined,
): IntegrityStatus {
  if (!rec) return 'no-data';
  const aAnn = rec.annuli.A;
  const bAnn = rec.annuli.B;
  return computeAnnulusStatus(
    annType,
    rec.completionType,
    rec.topPerforation,
    aAnn.toc,
    aAnn.cblToc,
    bAnn.shoeDepth,
  );
}

@Injectable({ providedIn: 'root' })
export class ReportService {
  private readonly wellService = inject(WellService);
  private readonly pmService = inject(PmService);
  private readonly wellDataService = inject(WellDataService);

  // Existing single-well report (unchanged — used by export)
  generateReport(wellId: string): WellIntegrityReport | null {
    const well = this.wellService.findWell(wellId);
    if (!well) return null;

    const platform = this.wellService.findPlatform(well.platformId);
    const asset = this.wellService.findAsset(well.assetId);
    if (!platform || !asset) return null;

    const annulusRecord = this.wellDataService.record();
    const pmHistory = this.pmService.records().filter((r) => r.wellId === wellId);
    const mesp = annulusRecord?.wellId === wellId ? (annulusRecord.mesp ?? null) : null;

    const annulusResults: AnnulusIntegrityResult[] = ANNULUS_TYPES.map((type) => {
      const data = annulusRecord?.wellId === wellId ? (annulusRecord.annuli[type] ?? null) : null;
      const hasData = data !== null && data.masp !== null;

      if (!hasData) {
        return {
          annulusType: type,
          data,
          mopVsMaspStatus: 'no-data',
          mespVsMaspStatus: 'no-data',
          overallStatus: 'no-data',
        };
      }

      const mopVsMaspStatus = checkMopVsMasp(data);
      const mespVsMaspStatus = checkMespVsMasp(mesp, data);
      return {
        annulusType: type,
        data,
        mopVsMaspStatus,
        mespVsMaspStatus,
        overallStatus: worstStatus(mopVsMaspStatus, mespVsMaspStatus),
      };
    });

    const overallStatus = worstStatus(...annulusResults.map((r) => r.overallStatus));
    return { well, platform, asset, mesp, annulusResults, pmHistory, overallStatus };
  }

  generateWellStatusRow(wellId: string): WellStatusRow | null {
    const well = this.wellService.findWell(wellId);
    if (!well) return null;
    const platform = this.wellService.findPlatform(well.platformId);
    const asset = this.wellService.findAsset(well.assetId);
    if (!platform || !asset) return null;

    const allPm = this.pmService.records();
    const latestPm =
      [...allPm.filter((r) => r.wellId === wellId)].sort((a, b) =>
        (b.completedDate ?? b.plannedDate).localeCompare(a.completedDate ?? a.plannedDate),
      )[0] ?? null;

    const annulusRecord =
      this.wellDataService.allRecords().find((r) => r.wellId === wellId) ?? null;
    const insp = latestPm?.inspectionData;

    const wh = computeWhStatus(insp?.wellhead);
    const xt = computeXtStatus(insp?.xtBody);
    const thgr = computeThgrStatus(insp?.wellhead);
    const dhsv = computeDhsvStatus(insp?.tubing);
    const tbg = computeTbgStatus(insp?.tubing);
    const annulusPressure = computeAnnPressureStatus(insp?.annulusPressure);

    const aBarrier = barrierStatus('A', annulusRecord);
    const bBarrier = barrierStatus('B', annulusRecord);

    const externalStatus = worstStatus(wh, xt, thgr, dhsv);
    const internalStatus = worstStatus(aBarrier, bBarrier, tbg);
    const extIntCombined = worstStatus(externalStatus, internalStatus);
    const finalStatus = worstStatus(extIntCombined, annulusPressure);

    const today = new Date().toISOString().slice(0, 10);
    const overrideMonths = annulusRecord?.overrideNextPmMonths ?? null;
    const nextPmDate =
      overrideMonths && latestPm?.completedDate
        ? addMonths(latestPm.completedDate, overrideMonths)
        : (latestPm?.nextPmDate ?? null);
    const isOverdue = !!nextPmDate && today > nextPmDate;

    return {
      well,
      platform,
      asset,
      latestPm,
      annulusRecord,
      wh,
      xt,
      thgr,
      dhsv,
      aBarrier,
      bBarrier,
      tbg,
      externalStatus,
      internalStatus,
      extIntCombined,
      annulusPressure,
      mocElements: annulusRecord?.mocElements ?? null,
      finalStatus,
      isOverdue,
      nextPmDate,
      issueText: buildIssueText(insp),
    };
  }
}
