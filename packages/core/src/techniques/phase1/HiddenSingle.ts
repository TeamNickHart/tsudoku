import type { Grid } from '../../types/Grid.js';
import type { HintAccumulator } from '../../types/Hint.js';
import type { HintProducer } from '../../types/HintProducer.js';
import {
  HIDDEN_SINGLE_BOX_DIFFICULTY,
  HIDDEN_SINGLE_LINE_DIFFICULTY,
} from '../../types/Technique.js';

function cellName(row: number, col: number): string {
  return `R${row + 1}C${col + 1}`;
}

function regionName(type: string, index: number): string {
  if (type === 'row') return `row ${index + 1}`;
  if (type === 'col') return `column ${index + 1}`;
  return `box ${index + 1}`;
}

export class HiddenSingle implements HintProducer {
  readonly technique = 'HiddenSingle' as const;
  readonly difficulty = HIDDEN_SINGLE_LINE_DIFFICULTY;

  getHints(grid: Grid, accumulator: HintAccumulator): void {
    // Check boxes first (lower difficulty), then rows and cols
    for (const region of grid.regions) {
      for (let digit = 1; digit <= 9; digit++) {
        const candidateCells = region.getCandidateCells(digit);
        if (candidateCells.length !== 1) continue;

        // Safe: we just checked length is 1
        const cell = candidateCells[0]!; // eslint-disable-line @typescript-eslint/no-non-null-assertion

        const difficulty =
          region.type === 'box' ? HIDDEN_SINGLE_BOX_DIFFICULTY : HIDDEN_SINGLE_LINE_DIFFICULTY;

        const result = accumulator({
          type: 'direct',
          technique: 'HiddenSingle',
          difficulty,
          cell: cell.index,
          digit,
          explanation: `${digit} can only go in ${cellName(cell.row, cell.col)} in ${regionName(region.type, region.index)}`,
          involvedCells: [cell.index],
          involvedCandidates: new Map([[cell.index, [digit]]]),
        });

        if (result === 'stop') return;
      }
    }
  }
}
