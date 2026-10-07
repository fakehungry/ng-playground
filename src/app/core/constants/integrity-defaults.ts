import { IntegrityConfig } from '../models/well-integrity.models';

/** Mirrors the logic that was previously hard-coded; used until/unless an admin saves changes. */
export const DEFAULT_INTEGRITY_CONFIG: IntegrityConfig = {
  id: 'default',
  leakTest: {
    passRatio: 0.97,
    observeMaxPressure: 0,
    dhsvLeakRateLimit: 15,
    dhsvLeakRateDivisor: 30,
  },
  annulusPressure: { warningRatio: 0.85, failRatio: 1 },
  mesp: { warningRatio: 0.85, failRatio: 1 },
  barrier: { cblTocMargin: 30, volTocMargin: 50 },
  rules: {
    xtValve: { leakOnly: 'warning', fnOnly: 'warning', both: 'fail' },
    annulusValve: { leakOnly: 'warning', fnOnly: 'warning', both: 'fail' },
    dhsv: { leakOnly: 'warning', fnOnly: 'warning', both: 'fail' },
    packoffLeak: 'fail',
    thgrPortLeak: 'fail',
    tubingFail: 'fail',
  },
  updatedAt: '',
  updatedBy: '',
};
