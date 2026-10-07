import {
  FunctionTestResult,
  LeakFnSeverity,
  LeakTestConfig,
  LeakTestResult,
  RuleSeverity,
  ValveTestType,
} from '../models/well-integrity.models';

/** Positive: final/initial. Inflow: initial/final. Observe: both readings must be ~zero. */
export function evaluateLeakTest(
  testType: ValveTestType,
  initial: number | null,
  final: number | null,
  cfg: LeakTestConfig,
): LeakTestResult | null {
  if (initial == null || final == null) return null;
  if (testType === 'Observe') {
    return initial <= cfg.observeMaxPressure && final <= cfg.observeMaxPressure ? 'Pass' : 'Fail';
  }
  if (testType === 'Inflow') {
    if (final === 0) return null;
    return initial / final >= cfg.passRatio ? 'Pass' : 'Fail';
  }
  if (initial === 0) return null;
  return final / initial >= cfg.passRatio ? 'Pass' : 'Fail';
}

export function computeDhsvLeakRate(
  topSectionId: number,
  depth: number,
  constant: number,
  initialPressure: number,
  finalPressure: number,
  cfg: LeakTestConfig,
): number {
  return (
    (topSectionId * topSectionId * depth * constant * (finalPressure - initialPressure)) /
    cfg.dhsvLeakRateDivisor
  );
}

export function evaluateDhsvLeakRate(leakRate: number | null, cfg: LeakTestConfig): LeakTestResult | null {
  if (leakRate == null) return null;
  return leakRate <= cfg.dhsvLeakRateLimit ? 'Pass' : 'Fail';
}

/** Severity of a valve-like component from its leak/function results. */
export function leakFnSeverity(
  leak: LeakTestResult | null,
  fn: FunctionTestResult | null,
  rule: LeakFnSeverity,
): RuleSeverity {
  const leakFail = leak === 'Fail';
  const fnFail = fn === 'Fail';
  if (leakFail && fnFail) return rule.both;
  if (leakFail) return rule.leakOnly;
  if (fnFail) return rule.fnOnly;
  return 'pass';
}
