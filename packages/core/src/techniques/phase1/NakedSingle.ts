import type { Grid } from '../../types/Grid.js';
import type { HintAccumulator } from '../../types/Hint.js';
import type { HintProducer } from '../../types/HintProducer.js';
import {
  NAKED_SINGLE_GENERAL_DIFFICULTY,
  NAKED_SINGLE_LAST_VALUE_DIFFICULTY,
} from '../../types/Technique.js';

function isLastValue(grid: Grid, cellIndex: number): boolean {
  const peers = grid.getPeers(cellIndex);
  return peers.every((p) => p.value !== null);
}

function cellName(row: number, col: number): string {
  return `R${row + 1}C${col + 1}`;
}

export class NakedSingle implements HintProducer {
  readonly technique = 'NakedSingle' as const;
  readonly difficulty = NAKED_SINGLE_GENERAL_DIFFICULTY;

  getHints(grid: Grid, accumulator: HintAccumulator): void {
    for (const cell of grid.cells) {
      if (cell.value !== null) continue;
      if (cell.candidateCount !== 1) continue;

      // Safe: candidateCount is 1, so candidateList[0] exists
      const digit = cell.candidateList[0]!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
      const lastValue = isLastValue(grid, cell.index);
      const difficulty = lastValue
        ? NAKED_SINGLE_LAST_VALUE_DIFFICULTY
        : NAKED_SINGLE_GENERAL_DIFFICULTY;

      const result = accumulator({
        type: 'direct',
        technique: 'NakedSingle',
        difficulty,
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
