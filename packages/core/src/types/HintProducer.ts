import type { Grid } from './Grid.js';
import type { HintAccumulator } from './Hint.js';
import type { Technique } from './Technique.js';

export interface HintProducer {
  readonly technique: Technique;
  readonly difficulty: number;
  getHints(grid: Grid, accumulator: HintAccumulator): void;
}
