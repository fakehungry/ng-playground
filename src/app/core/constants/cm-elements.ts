import { CmElementKind, CmSection } from '../models/well-integrity.models';

export interface CmElementDef {
  key: string;
  label: string;
  section: CmSection;
  kind: CmElementKind;
}

export const CM_ELEMENTS: readonly CmElementDef[] = [
  { key: 'xtBody', label: 'Body', section: 'xtBody', kind: 'pressure' },
  { key: 'umv', label: 'UMV', section: 'xtBody', kind: 'valve' },
  { key: 'lmv', label: 'LMV', section: 'xtBody', kind: 'valve' },
  { key: 'wv', label: 'WV', section: 'xtBody', kind: 'valve' },
  { key: 'kwv', label: 'KWV', section: 'xtBody', kind: 'valve' },
  { key: 'sv', label: 'SV', section: 'xtBody', kind: 'valve' },
  { key: 'stuffingBox', label: 'Stuffing Box', section: 'xtBody', kind: 'stuffingBox' },
  { key: 'xmtCarrierA', label: 'XMT Carrier (A)', section: 'wellhead', kind: 'pressure' },
  {
    key: 'tubingHangerCarrierB',
    label: 'Tubing Hanger Carrier (B)',
    section: 'wellhead',
    kind: 'pressure',
  },
  { key: 'cavityC', label: 'Cavity (C)', section: 'wellhead', kind: 'pressure' },
  { key: 'tbgHgrSealD', label: 'TBG HGR Seal (D)', section: 'wellhead', kind: 'pressure' },
  { key: 'csg7inPackOff', label: '7" CSG Pack-off', section: 'wellhead', kind: 'pressure' },
  { key: 'csg9inPackOff', label: '9-5/8" CSG Pack-off', section: 'wellhead', kind: 'pressure' },
  { key: 'aAnnCsgValve', label: 'A-ann CSG Valve', section: 'wellhead', kind: 'valve' },
  { key: 'bAnnCsg', label: 'B-ann CSG Valve', section: 'wellhead', kind: 'valve' },
  { key: 'cAnnCsg', label: 'C-ann CSG Valve', section: 'wellhead', kind: 'valve' },
  { key: 'dhsv', label: 'DHSV', section: 'dhsv', kind: 'dhsv' },
] as const;

export const CM_XT_ELEMENTS = CM_ELEMENTS.filter((e) => e.section === 'xtBody');
export const CM_WELLHEAD_ELEMENTS = CM_ELEMENTS.filter((e) => e.section === 'wellhead');
export const CM_DHSV_ELEMENTS = CM_ELEMENTS.filter((e) => e.section === 'dhsv');

export function findCmElement(key: string): CmElementDef | undefined {
  return CM_ELEMENTS.find((e) => e.key === key);
}
