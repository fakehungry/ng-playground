import { CM_WELLHEAD_ELEMENTS, CM_XT_ELEMENTS } from './cm-elements';

export interface FailureReportElementDef {
  key: string;
  label: string;
}

export const FAILURE_REPORT_ELEMENTS: readonly FailureReportElementDef[] = [
  ...CM_XT_ELEMENTS.map(({ key, label }) => ({ key, label })),
  ...CM_WELLHEAD_ELEMENTS.map(({ key, label }) => ({ key, label })),
  { key: 'dhsv', label: 'DHSV' },
  { key: 'packer', label: 'Packer' },
  { key: 'cementA', label: 'A Cement' },
  { key: 'cementB', label: 'B Cement' },
  { key: 'cementC', label: 'C Cement' },
  { key: 'commTubingAAnn', label: 'Tubing and A-ann Communication' },
  { key: 'commAAnnBAnn', label: 'A-ann and B-ann Communication' },
  { key: 'commBAnnCAnn', label: 'B-ann and C-ann Communication' },
] as const;

export function findFailureReportElement(key: string): FailureReportElementDef | undefined {
  return FAILURE_REPORT_ELEMENTS.find((e) => e.key === key);
}
