// @tsudoku/core — Board model, candidate engine, technique detectors, solver orchestrator

export const VERSION = '0.0.0';

// Types
export type { Cell, Grid, Region, RegionType } from './types/Grid.js';
export type { Hint, DirectHint, EliminationHint, HintAccumulator } from './types/Hint.js';
export type { HintProducer } from './types/HintProducer.js';
export type { Technique } from './types/Technique.js';
export {
  TECHNIQUE_DIFFICULTY,
  HIDDEN_SINGLE_BOX_DIFFICULTY,
  HIDDEN_SINGLE_LINE_DIFFICULTY,
  NAKED_SINGLE_LAST_VALUE_DIFFICULTY,
  NAKED_SINGLE_GENERAL_DIFFICULTY,
} from './types/Technique.js';

// Bitmask utilities
export {
  FULL_CANDIDATES,
  candidateMask,
  hasCandidate,
  addCandidate,
  removeCandidate,
  candidateList,
  candidateCount,
  candidateIntersection,
  candidateUnion,
} from './candidates/bitmask.js';

// Grid factory and operations
export { createGrid, recomputeCandidates, applyHint } from './models/GridImpl.js';

// Solver
export { Solver } from './solver/Solver.js';
export { DEFAULT_PRODUCERS } from './solver/producers.js';

// Techniques
export { NakedSingle } from './techniques/phase1/NakedSingle.js';
export { HiddenSingle } from './techniques/phase1/HiddenSingle.js';
export { DirectPointing } from './techniques/phase1/DirectPointing.js';
export { DirectClaiming } from './techniques/phase1/DirectClaiming.js';
export { DirectHiddenSet } from './techniques/phase1/DirectHiddenSet.js';
