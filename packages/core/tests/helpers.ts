import { createGrid } from '../src/models/GridImpl.js';
import type { Grid } from '../src/types/Grid.js';
import type { Hint } from '../src/types/Hint.js';
import type { HintProducer } from '../src/types/HintProducer.js';

export { createGrid };

export function getHints(producer: HintProducer, grid: Grid): Hint[] {
  const hints: Hint[] = [];
  producer.getHints(grid, (hint) => {
    hints.push(hint);
  });
  return hints;
}

export function getFirstHint(producer: HintProducer, grid: Grid): Hint | null {
  let found: Hint | null = null;
  producer.getHints(grid, (hint) => {
    found = hint;
    return 'stop';
  });
  return found;
}

// Well-known test puzzles
// Easy puzzle solvable with naked/hidden singles only
export const EASY_PUZZLE =
  '530070000600195000098000060800060003400803001700020006060000280000419005000080079';

// Puzzle requiring pointing
export const POINTING_PUZZLE =
  '000000000904607000076804100309701080008000300050308702007502610000403208000000000';

// Puzzle requiring claiming
export const CLAIMING_PUZZLE =
  '000921003009000060000000500080403006007000800500706040003000000020000700800195000';

// A solved grid (no hints should fire)
export const SOLVED_PUZZLE =
  '534678912672195348198342567859761423426853791713924856961537284287419635345286179';
