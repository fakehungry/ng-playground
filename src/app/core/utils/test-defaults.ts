import { ValveTestType } from '../models/well-integrity.models';

export const DEFAULT_TEST_TIME_MIN = 30;

/**
 * S1 asset tests everything Positive; other assets are Inflow for valves and Observe for ports.
 * The top cap is always Observe, for every asset.
 */
export function defaultTestType(
  assetName: string | undefined,
  isValve: boolean,
  isTopCap = false,
): ValveTestType {
  if (isTopCap) return 'Observe';
  if (assetName?.trim().toUpperCase() === 'S1') return 'Positive';
  return isValve ? 'Inflow' : 'Observe';
}
