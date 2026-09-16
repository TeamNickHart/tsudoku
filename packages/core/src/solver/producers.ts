import type { HintProducer } from '../types/HintProducer.js';
import { HiddenSingle } from '../techniques/phase1/HiddenSingle.js';
import { NakedSingle } from '../techniques/phase1/NakedSingle.js';
import { DirectPointing } from '../techniques/phase1/DirectPointing.js';
import { DirectClaiming } from '../techniques/phase1/DirectClaiming.js';
import { DirectHiddenSet } from '../techniques/phase1/DirectHiddenSet.js';

// Producers ordered by SE difficulty (lowest first).
// The solver tries each in order and short-circuits on first hit.
export const DEFAULT_PRODUCERS: readonly HintProducer[] = [
  new HiddenSingle(), // 1.2 (box) / 1.5 (line)
  new DirectPointing(), // 1.7
  new DirectClaiming(), // 1.9
  new DirectHiddenSet(2), // 2.0
  new NakedSingle(), // 2.3 (general) / 1.0 (last value)
  new DirectHiddenSet(3), // 2.5
];
