import type { Grid } from '../types/Grid.js';
import type { Hint } from '../types/Hint.js';
import type { HintProducer } from '../types/HintProducer.js';
import { DEFAULT_PRODUCERS } from './producers.js';

export class Solver {
  private readonly producers: readonly HintProducer[];

  constructor(producers?: readonly HintProducer[]) {
    this.producers = producers ?? DEFAULT_PRODUCERS;
  }

  getNextHint(grid: Grid): Hint | null {
    let bestHint: Hint | null = null;

    for (const producer of this.producers) {
      producer.getHints(grid, (hint) => {
        if (bestHint === null || hint.difficulty < bestHint.difficulty) {
          bestHint = hint;
        }
        return 'stop';
      });

      if (bestHint !== null) return bestHint;
    }

    return null;
  }

  getAllHints(grid: Grid): readonly Hint[] {
    const hints: Hint[] = [];

    for (const producer of this.producers) {
      producer.getHints(grid, (hint) => {
        hints.push(hint);
      });
    }

    return hints;
  }
}
