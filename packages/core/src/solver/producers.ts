import type { HintProducer } from '../types/HintProducer.js';
import { HiddenSingle } from '../techniques/phase1/HiddenSingle.js';
import { NakedSingle } from '../techniques/phase1/NakedSingle.js';
import { DirectPointing } from '../techniques/phase1/DirectPointing.js';
import { DirectClaiming } from '../techniques/phase1/DirectClaiming.js';
import { DirectHiddenSet } from '../techniques/phase1/DirectHiddenSet.js';
import { Locking } from '../techniques/phase2/Locking.js';
import { NakedSet } from '../techniques/phase2/NakedSet.js';
import { HiddenSet } from '../techniques/phase2/HiddenSet.js';
import { Fisherman } from '../techniques/phase2/Fisherman.js';
import { XYWing } from '../techniques/phase2/XYWing.js';

// Producers ordered by SE difficulty (lowest first).
// The solver tries each in order and short-circuits on first hit.
export const DEFAULT_PRODUCERS: readonly HintProducer[] = [
  new HiddenSingle(), // 1.2 (box) / 1.5 (line)
  new DirectPointing(), // 1.7
  new DirectClaiming(), // 1.9
  new DirectHiddenSet(2), // 2.0
  new NakedSingle(), // 2.3 (general) / 1.0 (last value)
  new DirectHiddenSet(3), // 2.5
  new Locking(true), // 2.6 — Pointing
  new Locking(false), // 2.8 — Claiming
  new NakedSet(2), // 3.0 — Naked Pair
  new Fisherman(2), // 3.2 — X-Wing
  new HiddenSet(2), // 3.4 — Hidden Pair
  new NakedSet(3), // 3.6 — Naked Triplet
  new Fisherman(3), // 3.8 — Swordfish
  new HiddenSet(3), // 4.0 — Hidden Triplet
  new XYWing(false), // 4.2 — XY-Wing
  new XYWing(true), // 4.4 — XYZ-Wing
];
