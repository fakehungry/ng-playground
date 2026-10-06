export type AnnulusType = 'A' | 'B' | 'C';
export type CompletionType = 'Monobore' | 'Conventional';
export type PmStatus = 'Planned' | 'In Progress' | 'Completed';
export type IntegrityStatus = 'pass' | 'fail' | 'warning' | 'no-data';
export type ComponentStatus = 'Good' | 'Fail';
export type FunctionTestResult = 'Pass' | 'Fail';
export type LeakTestResult = 'Pass' | 'Fail';
export type StuffingBoxStatus = 'Clean' | 'Dirty';
export type TubingStatus = 'Shut-in' | 'Flowing';
export type ValveTestType = 'Positive' | 'Inflow' | 'Observe';

export interface Asset {
  id: string;
  name: string;
}

export interface Platform {
  id: string;
  assetId: string;
  name: string;
}

export interface Well {
  id: string;
  platformId: string;
  assetId: string;
  name: string;
  type: 'producer' | 'injector' | 'observation';
}

export interface AnnulusData {
  annulusType: AnnulusType;
  toc: number | null;
  cblToc: number | null;
  shoeDepth: number | null;
  masp: number | null;
  mop: number | null;
  tow: number | null;
  updatedAt: string;
  updatedBy: string;
}

export interface WellAnnulusRecord {
  id: string;
  wellId: string;
  completionType: CompletionType;
  mocRecord: boolean;
  topPerforation: number | null;
  mesp: number | null;
  annuli: Record<AnnulusType, AnnulusData>;
  lastUpdatedAt: string;
  lastUpdatedBy: string;
}

export interface PressureComponent {
  testType: ValveTestType;
  initialPressure: number | null;
  finalPressure: number | null;
  testTime: number | null; // minutes
  leakTest: LeakTestResult | null;
  currentStatus: ComponentStatus;
  comment: string;
}

export interface ValveComponent extends PressureComponent {
  functionTest: FunctionTestResult | null;
  greaseVolume: number | null;
  turns: number | null;
}

export interface DhsvComponent {
  pressureBeforeInflowTest: number | null;
  initialPressureWhenInflowTest: number | null;
  finalPressure: number | null;
  leakRate: number | null; // (topSectionId² × depth × constant × ΔP) / 30
  leakTest: LeakTestResult | null; // Pass if leakRate <= 15, else Fail
  hydraulicReturn: number | null;
  functionTest: FunctionTestResult | null;
  currentStatus: ComponentStatus; // Pass requires both leakTest and functionTest = Pass
  comment: string;
}

export interface TubingComponent {
  pressureBefore: number | null;
  pressureAfter: number | null;
  temperatureBefore: number | null;
  temperatureAfter: number | null;
  currentStatus: TubingStatus;
  comment: string;
}

export interface AnnulusPressureComponent {
  tow: number | null;
  currentPressure: number | null;
  pbuRate: number | null;
  currentStatus: ComponentStatus;
  comment: string;
}

export interface XtBodySection {
  currentStatus: ComponentStatus;
  xtBody: PressureComponent;
  umv: ValveComponent;
  lmv: ValveComponent;
  wv: ValveComponent;
  kwv: ValveComponent;
  sv: ValveComponent;
  stuffingBox: { currentStatus: StuffingBoxStatus; comment: string };
}

export interface WellheadSection {
  currentStatus: ComponentStatus;
  xmtCarrierA: PressureComponent;
  tubingHangerCarrierB: PressureComponent;
  cavityC: PressureComponent;
  tbgHgrSealD: PressureComponent;
  csg7inPackOff: PressureComponent;
  csg9inPackOff: PressureComponent;
  aAnnCsgValve: ValveComponent;
  bAnnCsg: ValveComponent;
  cAnnCsg: ValveComponent;
  aAnnCsgValve2?: ValveComponent;
  bAnnCsg2?: ValveComponent;
  cAnnCsg2?: ValveComponent;
}

export interface TubingSection {
  currentStatus: ComponentStatus;
  dhsv: DhsvComponent;
  tubing: TubingComponent;
}

export interface AnnulusPressureSection {
  aAnn: AnnulusPressureComponent;
  bAnn: AnnulusPressureComponent;
  cAnn: AnnulusPressureComponent;
}

export interface PmInspectionData {
  xtBody: XtBodySection;
  wellhead: WellheadSection;
  tubing: TubingSection;
  annulusPressure: AnnulusPressureSection;
}

export interface DhsvData {
  id: string;
  wellId: string;
  dhsvType: string;
  dhsvDepth: number;
  topSectionId: number;
  constantForField: number;
  dhsvStatus: 'Normal' | 'Lock-open' | 'CL Communicated';
}

export interface PmRecord {
  id: string;
  wellId: string;
  jobDescription: string;
  plannedDate: string;
  operatorName: string;
  status: PmStatus;
  /** @deprecated legacy record-level value; test type is now per component */
  valveTestType?: ValveTestType;
  completedDate?: string;
  nextPmDate?: string;
  createdAt: string;
  updatedAt: string;
  inspectionData?: PmInspectionData;
}

export interface PmFormValue {
  wellId: string;
  jobDescription: string;
  plannedDate: string;
  operatorName: string;
  status: PmStatus;
  completedDate: string | null;
  inspectionData?: PmInspectionData;
}

export interface AnnulusFormValue {
  toc: number | null;
  cblToc: number | null;
  shoeDepth: number | null;
  masp: number | null;
  mop: number | null;
  tow: number | null;
  updatedBy: string;
}

export interface WellConfigFormValue {
  completionType: CompletionType;
  mocRecord: boolean;
  topPerforation: number | null;
  mesp: number | null;
}

export interface AnnulusIntegrityResult {
  annulusType: AnnulusType;
  data: AnnulusData | null;
  mopVsMaspStatus: IntegrityStatus;
  mespVsMaspStatus: IntegrityStatus;
  overallStatus: IntegrityStatus;
}

export interface WellIntegrityReport {
  well: Well;
  platform: Platform;
  asset: Asset;
  mesp: number | null;
  annulusResults: AnnulusIntegrityResult[];
  pmHistory: PmRecord[];
  overallStatus: IntegrityStatus;
}

export interface WellRemark {
  id: string;
  wellId: string;
  issue: string;
  action: string;
  remark: string;
}

export interface RigSchedule {
  id: string;
  platformId: string;
  rigName: string;
  startDate: string;
  endDate: string;
}

export interface WellStatusRow {
  well: Well;
  platform: Platform;
  asset: Asset;
  latestPm: PmRecord | null;
  annulusRecord: WellAnnulusRecord | null;
  wh: IntegrityStatus;
  xt: IntegrityStatus;
  thgr: IntegrityStatus;
  dhsv: IntegrityStatus;
  aBarrier: IntegrityStatus;
  bBarrier: IntegrityStatus;
  tbg: IntegrityStatus;
  externalStatus: IntegrityStatus;
  internalStatus: IntegrityStatus;
  extIntCombined: IntegrityStatus;
  annulusPressure: IntegrityStatus;
  mocRecord: boolean | null;
  finalStatus: IntegrityStatus;
  isOverdue: boolean;
  nextPmDate: string | null;
  issueText: string;
}

export interface FailureReportItem {
  status: ComponentStatus;
  comment: string;
}

export interface FailureReport {
  id: string;
  wellId: string;
  reportDate: string;
  reportedBy: string;
  xt: {
    body: FailureReportItem;
    umv: FailureReportItem;
    lmv: FailureReportItem;
    wv: FailureReportItem;
    kwv: FailureReportItem;
    sv: FailureReportItem;
  };
  annulusPressure: {
    aAnn: FailureReportItem;
    bAnn: FailureReportItem;
    cAnn: FailureReportItem;
  };
  createdAt: string;
  updatedAt: string;
}

export type CmSection = 'xtBody' | 'wellhead' | 'dhsv';
export type CmElementKind = 'pressure' | 'valve' | 'stuffingBox' | 'dhsv';

export interface CmPressureData {
  initialPressure: number | null;
  finalPressure: number | null;
  leakTest: LeakTestResult | null;
  currentStatus: ComponentStatus;
  rootCause: string;
  correctiveAction: string;
}

export interface CmValveData extends CmPressureData {
  functionTest: FunctionTestResult | null;
  greaseVolume: number | null;
}

export interface CmStuffingBoxData {
  currentStatus: StuffingBoxStatus;
  rootCause: string;
  correctiveAction: string;
}

export interface CmDhsvData {
  pressureBeforeInflowTest: number | null;
  initialPressureWhenInflowTest: number | null;
  finalPressure: number | null;
  leakRate: number | null;
  leakTest: LeakTestResult | null;
  hydraulicReturn: number | null;
  functionTest: FunctionTestResult | null;
  constantForField: number | null;
  currentStatus: ComponentStatus;
  rootCause: string;
  correctiveAction: string;
}

export type CmElementData = CmPressureData | CmValveData | CmStuffingBoxData | CmDhsvData;

export interface CmElementEntry {
  elementKey: string;
  section: CmSection;
  kind: CmElementKind;
  elementData: CmElementData;
}

export interface CmRecord {
  id: string;
  wellId: string;
  eventDate: string;
  reportedBy: string;
  createdAt: string;
  updatedAt: string;
  elements: CmElementEntry[];
}

export interface CmFormValue {
  wellId: string;
  eventDate: string;
  reportedBy: string;
  elements: CmElementEntry[];
}
