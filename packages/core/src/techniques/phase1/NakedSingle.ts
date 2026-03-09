import type { Grid } from '../../types/Grid.js';
import type { HintAccumulator } from '../../types/Hint.js';
import type { HintProducer } from '../../types/HintProducer.js';
import { NAKED_SINGLE_DIFFICULTY } from '../../types/Technique.js';

function cellName(row: number, col: number): string {
  return `R${row + 1}C${col + 1}`;
}

/**
 * NakedSingle — matches SE's NakedSingle.java algorithm.
 *
 * Iterates cells 0–80 (row by row, left to right). If a cell has exactly
 * one candidate, it's a naked single. Always difficulty 2.3.
 *
 * Note: SE handles the "last empty cell in a region" (difficulty 1.0) case
 * in HiddenSingle (isAlone), not here.
 *
 * SE ref: diuf/sudoku/solver/rules/NakedSingle.java
 */
export class NakedSingle implements HintProducer {
  readonly technique = 'NakedSingle' as const;
  readonly difficulty = NAKED_SINGLE_DIFFICULTY;

  getHints(grid: Grid, accumulator: HintAccumulator): void {
    for (const cell of grid.cells) {
      if (cell.value !== null) continue;
      if (cell.candidateCount !== 1) continue;

      // Safe: candidateCount is 1, so candidateList[0] exists
      const digit = cell.candidateList[0]!; // eslint-disable-line @typescript-eslint/no-non-null-assertion

      const result = accumulator({
        type: 'direct',
        technique: 'NakedSingle',
        difficulty: NAKED_SINGLE_DIFFICULTY,
        cell: cell.index,
        digit,
        explanation: `${cellName(cell.row, cell.col)} has only one remaining candidate: ${digit}`,
        involvedCells: [cell.index],
        involvedCandidates: new Map([[cell.index, [digit]]]),
      });

      if (result === 'stop') return;
    }
  }
}
