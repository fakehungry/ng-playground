import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import {
  FunctionTestResult,
  PmStatus,
  StuffingBoxStatus,
  TubingStatus,
  ValveTestType,
} from '../models/well-integrity.models';
import { DEFAULT_TEST_TIME_MIN, defaultTestType } from '../utils/test-defaults';
import { InspectionFormRaw } from './pm.service';
import { WellService } from './well.service';

type Workbook = import('exceljs').Workbook;
type Worksheet = import('exceljs').Worksheet;

const SHEET_RECORDS = 'PM Records';
const SHEET_ELEMENTS = 'XT & Wellhead';
const SHEET_TUBING = 'Tubing & Annulus';
const SHEET_HELP = 'Instructions';

const STATUSES: PmStatus[] = ['Planned', 'In Progress', 'Completed'];
const TEST_TYPES: ValveTestType[] = ['Positive', 'Inflow', 'Observe'];
const FUNCTION_TESTS: FunctionTestResult[] = ['Pass', 'Fail'];
const STUFFING_BOX: StuffingBoxStatus[] = ['Clean', 'Dirty'];
const TUBING_STATUSES: TubingStatus[] = ['Shut-in', 'Flowing'];
const DATA_ROWS = 300;

type XtKey = keyof InspectionFormRaw['xtBody'];
type WellheadKey = keyof InspectionFormRaw['wellhead'];

interface ElementDef {
  label: string;
  group: 'xtBody' | 'wellhead';
  key: XtKey | WellheadKey;
  valve: boolean;
}

const ELEMENTS: ElementDef[] = [
  { label: 'Top Cap', group: 'xtBody', key: 'xtBody', valve: false },
  { label: 'UMV', group: 'xtBody', key: 'umv', valve: true },
  { label: 'LMV', group: 'xtBody', key: 'lmv', valve: true },
  { label: 'WV', group: 'xtBody', key: 'wv', valve: true },
  { label: 'KWV', group: 'xtBody', key: 'kwv', valve: true },
  { label: 'SV', group: 'xtBody', key: 'sv', valve: true },
  { label: 'XMT Carrier (A)', group: 'wellhead', key: 'xmtCarrierA', valve: false },
  {
    label: 'Tubing Hanger Carrier (B)',
    group: 'wellhead',
    key: 'tubingHangerCarrierB',
    valve: false,
  },
  { label: 'Cavity (C)', group: 'wellhead', key: 'cavityC', valve: false },
  { label: 'TBG HGR Seal (D)', group: 'wellhead', key: 'tbgHgrSealD', valve: false },
  { label: '7" CSG Pack-off', group: 'wellhead', key: 'csg7inPackOff', valve: false },
  { label: '9-5/8" CSG Pack-off', group: 'wellhead', key: 'csg9inPackOff', valve: false },
  { label: 'A-ann CSG Valve', group: 'wellhead', key: 'aAnnCsgValve', valve: true },
  { label: 'B-ann CSG Valve', group: 'wellhead', key: 'bAnnCsg', valve: true },
  { label: 'C-ann CSG Valve', group: 'wellhead', key: 'cAnnCsg', valve: true },
  { label: 'A-ann CSG Valve (2nd)', group: 'wellhead', key: 'aAnnCsgValve2', valve: true },
  { label: 'B-ann CSG Valve (2nd)', group: 'wellhead', key: 'bAnnCsg2', valve: true },
  { label: 'C-ann CSG Valve (2nd)', group: 'wellhead', key: 'cAnnCsg2', valve: true },
];

type ColKind = 'num' | 'text' | 'tubingStatus' | 'functionTest';
interface TubingCol {
  header: string;
  section: 'dhsv' | 'tubing' | 'aAnn' | 'bAnn' | 'cAnn';
  field: string;
  kind: ColKind;
}

const TUBING_COLS: TubingCol[] = [
  {
    header: 'DHSV Pressure Before Inflow Test (psi)',
    section: 'dhsv',
    field: 'pressureBeforeInflowTest',
    kind: 'num',
  },
  {
    header: 'DHSV Initial P When Inflow Test (psi)',
    section: 'dhsv',
    field: 'initialPressureWhenInflowTest',
    kind: 'num',
  },
  { header: 'DHSV Final P (psi)', section: 'dhsv', field: 'finalPressure', kind: 'num' },
  { header: 'DHSV Hydraulic Return', section: 'dhsv', field: 'hydraulicReturn', kind: 'num' },
  { header: 'DHSV Function Test', section: 'dhsv', field: 'functionTest', kind: 'functionTest' },
  { header: 'DHSV Comment', section: 'dhsv', field: 'comment', kind: 'text' },
  { header: 'Tubing Pressure Before', section: 'tubing', field: 'pressureBefore', kind: 'num' },
  { header: 'Tubing Pressure After', section: 'tubing', field: 'pressureAfter', kind: 'num' },
  {
    header: 'Tubing Temperature Before',
    section: 'tubing',
    field: 'temperatureBefore',
    kind: 'num',
  },
  { header: 'Tubing Temperature After', section: 'tubing', field: 'temperatureAfter', kind: 'num' },
  { header: 'Tubing Status', section: 'tubing', field: 'currentStatus', kind: 'tubingStatus' },
  { header: 'Tubing Comment', section: 'tubing', field: 'comment', kind: 'text' },
  { header: 'A-Ann Current Pressure', section: 'aAnn', field: 'currentPressure', kind: 'num' },
  { header: 'A-Ann PBU Rate', section: 'aAnn', field: 'pbuRate', kind: 'num' },
  { header: 'A-Ann Comment', section: 'aAnn', field: 'comment', kind: 'text' },
  { header: 'B-Ann Current Pressure', section: 'bAnn', field: 'currentPressure', kind: 'num' },
  { header: 'B-Ann PBU Rate', section: 'bAnn', field: 'pbuRate', kind: 'num' },
  { header: 'B-Ann Comment', section: 'bAnn', field: 'comment', kind: 'text' },
  { header: 'C-Ann Current Pressure', section: 'cAnn', field: 'currentPressure', kind: 'num' },
  { header: 'C-Ann PBU Rate', section: 'cAnn', field: 'pbuRate', kind: 'num' },
  { header: 'C-Ann Comment', section: 'cAnn', field: 'comment', kind: 'text' },
];

export interface ParsedPm {
  ref: string;
  wellId: string;
  wellName: string;
  jobDescription: string;
  plannedDate: string;
  operatorName: string;
  status: PmStatus;
  completedDate: string | null;
  raw: InspectionFormRaw;
  errors: string[];
}

function emptyPressure(assetName?: string, topCap = false) {
  return {
    testType: defaultTestType(assetName, false, topCap),
    initialPressure: null as number | null,
    finalPressure: null as number | null,
    testTime: DEFAULT_TEST_TIME_MIN as number | null,
    comment: '',
  };
}

function emptyValve(assetName?: string) {
  return {
    ...emptyPressure(assetName),
    testType: defaultTestType(assetName, true),
    functionTest: null as FunctionTestResult | null,
    greaseVolume: null as number | null,
    turns: null as number | null,
  };
}

function emptyRaw(assetName?: string): InspectionFormRaw {
  return {
    xtBody: {
      xtBody: emptyPressure(assetName, true),
      umv: emptyValve(assetName),
      lmv: emptyValve(assetName),
      wv: emptyValve(assetName),
      kwv: emptyValve(assetName),
      sv: emptyValve(assetName),
      stuffingBox: { currentStatus: 'Clean', comment: '' },
    },
    wellhead: {
      xmtCarrierA: emptyPressure(assetName),
      tubingHangerCarrierB: emptyPressure(assetName),
      cavityC: emptyPressure(assetName),
      tbgHgrSealD: emptyPressure(assetName),
      csg7inPackOff: emptyPressure(assetName),
      csg9inPackOff: emptyPressure(assetName),
      aAnnCsgValve: emptyValve(assetName),
      bAnnCsg: emptyValve(assetName),
      cAnnCsg: emptyValve(assetName),
      aAnnCsgValve2: emptyValve(assetName),
      bAnnCsg2: emptyValve(assetName),
      cAnnCsg2: emptyValve(assetName),
    },
    tubing: {
      dhsv: {
        pressureBeforeInflowTest: null,
        initialPressureWhenInflowTest: null,
        finalPressure: null,
        hydraulicReturn: null,
        functionTest: null,
        comment: '',
      },
      tubing: {
        pressureBefore: null,
        pressureAfter: null,
        temperatureBefore: null,
        temperatureAfter: null,
        currentStatus: 'Shut-in',
        comment: '',
      },
    },
    annulusPressure: {
      aAnn: { currentPressure: null, pbuRate: null, comment: '' },
      bAnn: { currentPressure: null, pbuRate: null, comment: '' },
      cAnn: { currentPressure: null, pbuRate: null, comment: '' },
    },
  };
}

function cellText(value: unknown): string {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    const v = value as {
      richText?: Array<{ text: string }>;
      text?: unknown;
      result?: unknown;
    };
    if (v.richText)
      return v.richText
        .map((t) => t.text)
        .join('')
        .trim();
    if (v.result != null) return cellText(v.result);
    if (v.text != null) return cellText(v.text);
    return '';
  }
  return String(value).trim();
}

function isIsoDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}

@Injectable({ providedIn: 'root' })
export class PmExcelService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly wellService = inject(WellService);

  private async newWorkbook(): Promise<Workbook> {
    const mod = await import('exceljs');
    const Wb = (mod.default ?? mod).Workbook;
    return new Wb();
  }

  async downloadTemplate(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;
    const wb = await this.newWorkbook();
    const exampleWell = this.wellService.wells()[0]?.name ?? 'WELL-NAME';

    // Sheet 1: records
    const recs = wb.addWorksheet(SHEET_RECORDS);
    recs.columns = [
      { header: 'Ref', width: 8 },
      { header: 'Well Name', width: 18 },
      { header: 'Job Description', width: 40 },
      { header: 'Planned Date (YYYY-MM-DD)', width: 24 },
      { header: 'Operator', width: 20 },
      { header: 'Status', width: 14 },
      { header: 'Completed Date (YYYY-MM-DD)', width: 26 },
      { header: 'Stuffing Box (Clean/Dirty)', width: 24 },
      { header: 'Stuffing Box Comment', width: 30 },
    ];
    recs.addRow([
      '1',
      exampleWell,
      'Annual PM',
      '2026-01-15',
      'Operator name',
      'Planned',
      '',
      'Clean',
      '',
    ]);
    this.listValidation(recs, 'F', STATUSES);
    this.listValidation(recs, 'H', STUFFING_BOX);

    // Sheet 2: elements
    const els = wb.addWorksheet(SHEET_ELEMENTS);
    els.columns = [
      { header: 'Ref', width: 8 },
      { header: 'Element', width: 28 },
      { header: 'Test Type', width: 12 },
      { header: 'Init P (psi)', width: 12 },
      { header: 'Final P (psi)', width: 12 },
      { header: 'Time (min)', width: 11 },
      { header: 'Function Test', width: 14 },
      { header: 'Grease Vol. (kg)', width: 16 },
      { header: 'Turns', width: 8 },
      { header: 'Comment', width: 36 },
    ];
    const exampleAsset = this.wellService.findAsset(
      this.wellService.wells()[0]?.assetId ?? '',
    )?.name;
    for (const el of ELEMENTS) {
      els.addRow([
        '1',
        el.label,
        defaultTestType(exampleAsset, el.valve, el.key === 'xtBody'),
        null,
        null,
        DEFAULT_TEST_TIME_MIN,
        null,
        null,
        null,
        '',
      ]);
    }
    this.listValidation(els, 'C', TEST_TYPES);
    this.listValidation(els, 'G', FUNCTION_TESTS);
    const grey = {
      type: 'pattern' as const,
      pattern: 'solid' as const,
      fgColor: { argb: 'FFE2E8F0' },
    };
    ELEMENTS.forEach((el, i) => {
      if (el.valve) return;
      for (const col of [7, 8, 9]) els.getRow(i + 2).getCell(col).fill = grey;
    });

    // Sheet 3: tubing & annulus
    const tub = wb.addWorksheet(SHEET_TUBING);
    tub.columns = [
      { header: 'Ref', width: 8 },
      ...TUBING_COLS.map((c) => ({ header: c.header, width: Math.max(16, c.header.length * 0.9) })),
    ];
    const tubRow: Array<string | null> = ['1', ...TUBING_COLS.map(() => null)];
    tubRow[1 + TUBING_COLS.findIndex((c) => c.kind === 'tubingStatus')] = 'Shut-in';
    tub.addRow(tubRow);
    this.listValidation(
      tub,
      this.colLetter(1 + TUBING_COLS.findIndex((c) => c.field === 'functionTest') + 1),
      FUNCTION_TESTS,
    );
    this.listValidation(
      tub,
      this.colLetter(1 + TUBING_COLS.findIndex((c) => c.kind === 'tubingStatus') + 1),
      TUBING_STATUSES,
    );

    // Sheet 4: help
    const help = wb.addWorksheet(SHEET_HELP);
    help.getColumn(1).width = 120;
    [
      'PM bulk upload — one PM record per row in "PM Records"; use a unique Ref for each.',
      '"XT & Wellhead" and "Tubing & Annulus" rows are linked to a record by Ref.',
      'Copy the XT & Wellhead element rows and Tubing & Annulus row for each additional Ref.',
      'Well Name must match an existing well. Dates must be YYYY-MM-DD.',
      `Status: ${STATUSES.join(' / ')}. Completed Date is required when Status is Completed.`,
      `Test Type: ${TEST_TYPES.join(' / ')}. Observe passes only when Init P and Final P are both 0.`,
      'Function Test, Grease Vol. and Turns apply to valves only (greyed cells are ignored).',
      'Element names must be kept exactly as in the template. Missing elements are left empty.',
      'The 2nd valve rows are optional — delete them or leave blank if there is no second valve.',
    ].forEach((t) => help.addRow([t]));
    help.getRow(1).font = { bold: true };

    for (const ws of [recs, els, tub]) {
      ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } };
      ws.views = [{ state: 'frozen', ySplit: 1 }];
    }

    await this.save(wb, 'pm-upload-template.xlsx');
  }

  async parse(file: File): Promise<ParsedPm[]> {
    const wb = await this.newWorkbook();
    await wb.xlsx.load(await file.arrayBuffer());
    const recs = wb.getWorksheet(SHEET_RECORDS);
    if (!recs) throw new Error(`Sheet "${SHEET_RECORDS}" not found. Use the downloaded template.`);

    const wells = this.wellService.wells();
    const parsed = new Map<string, ParsedPm>();
    const text = (ws: Worksheet, row: number, col: number) =>
      cellText(ws.getRow(row).getCell(col).value);

    recs.eachRow((row, r) => {
      if (r === 1) return;
      const ref = text(recs, r, 1);
      if (!ref && !text(recs, r, 2) && !text(recs, r, 3)) return;
      const errors: string[] = [];
      if (!ref) errors.push('Ref is required');
      if (parsed.has(ref)) errors.push(`Duplicate Ref "${ref}"`);

      const wellName = text(recs, r, 2);
      const matches = wells.filter((w) => w.name.toLowerCase() === wellName.toLowerCase());
      if (matches.length !== 1) {
        errors.push(
          matches.length === 0 ? `Well "${wellName}" not found` : `Well "${wellName}" is ambiguous`,
        );
      }
      const jobDescription = text(recs, r, 3);
      if (!jobDescription) errors.push('Job Description is required');
      else if (jobDescription.length > 500) errors.push('Job Description exceeds 500 characters');
      const plannedDate = text(recs, r, 4);
      if (!isIsoDate(plannedDate)) errors.push('Planned Date must be YYYY-MM-DD');
      const operatorName = text(recs, r, 5);
      if (!operatorName) errors.push('Operator is required');
      const statusText = text(recs, r, 6) || 'Planned';
      const status = STATUSES.find((s) => s.toLowerCase() === statusText.toLowerCase());
      if (!status) errors.push(`Invalid Status "${statusText}"`);
      const completedDate = text(recs, r, 7);
      if (status === 'Completed' && !isIsoDate(completedDate)) {
        errors.push('Completed Date (YYYY-MM-DD) is required when Status is Completed');
      }

      const assetName =
        matches.length === 1 ? this.wellService.findAsset(matches[0].assetId)?.name : undefined;
      const raw = emptyRaw(assetName);
      const sb = text(recs, r, 8);
      if (sb) {
        const v = STUFFING_BOX.find((s) => s.toLowerCase() === sb.toLowerCase());
        if (v) raw.xtBody.stuffingBox.currentStatus = v;
        else errors.push(`Invalid Stuffing Box "${sb}"`);
      }
      raw.xtBody.stuffingBox.comment = text(recs, r, 9);

      parsed.set(ref || `row${r}`, {
        ref,
        wellId: matches.length === 1 ? matches[0].id : '',
        wellName,
        jobDescription,
        plannedDate,
        operatorName,
        status: status ?? 'Planned',
        completedDate: status === 'Completed' ? completedDate : null,
        raw,
        errors,
      });
    });

    const els = wb.getWorksheet(SHEET_ELEMENTS);
    if (els) this.parseElements(els, parsed);
    const tub = wb.getWorksheet(SHEET_TUBING);
    if (tub) this.parseTubing(tub, parsed);

    return [...parsed.values()];
  }

  private parseElements(ws: Worksheet, parsed: Map<string, ParsedPm>): void {
    const seen = new Set<string>();
    ws.eachRow((row, r) => {
      if (r === 1) return;
      const get = (c: number) => cellText(row.getCell(c).value);
      const ref = get(1);
      const name = get(2);
      if (!ref && !name) return;
      const rec = parsed.get(ref);
      if (!rec) {
        // Attach to nothing; surface on the first record so the problem is visible
        const first = [...parsed.values()][0];
        first?.errors.push(`"${SHEET_ELEMENTS}" row ${r}: unknown Ref "${ref}"`);
        return;
      }
      const err = (m: string) => rec.errors.push(`${name || 'Element'} (row ${r}): ${m}`);
      const el = ELEMENTS.find(
        (e) =>
          e.label.toLowerCase() === name.toLowerCase() ||
          (e.key === 'xtBody' && name.toLowerCase() === 'xt body'),
      );
      if (!el) {
        err(`unknown element "${name}"`);
        return;
      }
      const dupKey = `${ref}|${el.key}`;
      if (seen.has(dupKey)) {
        err('duplicate element for this Ref');
        return;
      }
      seen.add(dupKey);

      const target = (rec.raw[el.group] as unknown as Record<string, Record<string, unknown>>)[
        el.key
      ];
      const tt = get(3);
      if (tt) {
        const v = TEST_TYPES.find((t) => t.toLowerCase() === tt.toLowerCase());
        if (v) target['testType'] = v;
        else err(`invalid Test Type "${tt}"`);
      }
      const num = (col: number, field: string, label: string) => {
        const t = get(col);
        if (!t) return;
        const n = Number(t);
        if (Number.isNaN(n)) err(`${label} must be a number`);
        else target[field] = n;
      };
      num(4, 'initialPressure', 'Init P');
      num(5, 'finalPressure', 'Final P');
      num(6, 'testTime', 'Time');
      if (el.valve) {
        const ft = get(7);
        if (ft) {
          const v = FUNCTION_TESTS.find((t) => t.toLowerCase() === ft.toLowerCase());
          if (v) target['functionTest'] = v;
          else err(`invalid Function Test "${ft}"`);
        }
        num(8, 'greaseVolume', 'Grease Vol.');
        num(9, 'turns', 'Turns');
      }
      target['comment'] = get(10);
    });
  }

  private parseTubing(ws: Worksheet, parsed: Map<string, ParsedPm>): void {
    ws.eachRow((row, r) => {
      if (r === 1) return;
      const ref = cellText(row.getCell(1).value);
      if (!ref) return;
      const rec = parsed.get(ref);
      if (!rec) {
        [...parsed.values()][0]?.errors.push(`"${SHEET_TUBING}" row ${r}: unknown Ref "${ref}"`);
        return;
      }
      TUBING_COLS.forEach((col, i) => {
        const t = cellText(row.getCell(i + 2).value);
        if (!t) return;
        const target = (col.section === 'dhsv' || col.section === 'tubing'
          ? rec.raw.tubing[col.section]
          : rec.raw.annulusPressure[col.section]) as unknown as Record<string, unknown>;
        if (col.kind === 'num') {
          const n = Number(t);
          if (Number.isNaN(n)) rec.errors.push(`${col.header} must be a number`);
          else target[col.field] = n;
        } else if (col.kind === 'functionTest') {
          const v = FUNCTION_TESTS.find((x) => x.toLowerCase() === t.toLowerCase());
          if (v) target[col.field] = v;
          else rec.errors.push(`Invalid ${col.header} "${t}"`);
        } else if (col.kind === 'tubingStatus') {
          const v = TUBING_STATUSES.find((x) => x.toLowerCase() === t.toLowerCase());
          if (v) target[col.field] = v;
          else rec.errors.push(`Invalid ${col.header} "${t}"`);
        } else {
          target[col.field] = t;
        }
      });
    });
  }

  private listValidation(ws: Worksheet, col: string, values: readonly string[]): void {
    for (let r = 2; r <= DATA_ROWS; r++) {
      ws.getCell(`${col}${r}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`"${values.join(',')}"`],
      };
    }
  }

  private colLetter(n: number): string {
    let s = '';
    while (n > 0) {
      const m = (n - 1) % 26;
      s = String.fromCharCode(65 + m) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  }

  private async save(wb: Workbook, filename: string): Promise<void> {
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}
