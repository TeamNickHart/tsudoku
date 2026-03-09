import type { Grid, Region } from '../../types/Grid.js';
import type { HintAccumulator } from '../../types/Hint.js';
import type { HintProducer } from '../../types/HintProducer.js';
import {
  HIDDEN_SINGLE_ALONE_DIFFICULTY,
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

/**
 * HiddenSingle — matches SE's HiddenSingle.java algorithm.
 *
 * Two passes through regions:
 *   Pass 1 (aloneOnly=true):  "Full house" — last empty cell in a region (difficulty 1.0)
 *   Pass 2 (aloneOnly=false): True hidden singles (box=1.2, line=1.5)
 *
 * Region order within each pass: boxes → columns → rows
 * Within each region: digits 1–9 in order.
 *
 * SE ref: diuf/sudoku/solver/rules/HiddenSingle.java
 */
export class HiddenSingle implements HintProducer {
  readonly technique = 'HiddenSingle' as const;
  readonly difficulty = HIDDEN_SINGLE_LINE_DIFFICULTY;

  getHints(grid: Grid, accumulator: HintAccumulator): void {
    // Pass 1: alone cells (last empty cell in a region) — difficulty 1.0
    // SE order: blocks, columns, rows
    if (this.scanRegions(grid, accumulator, this.getOrderedRegions(grid), true)) return;

    // Pass 2: true hidden singles — difficulty 1.2 (box) / 1.5 (line)
    // SE order: blocks, columns, rows
    this.scanRegions(grid, accumulator, this.getOrderedRegions(grid), false);
  }

  /** Returns regions in SE order: boxes → columns → rows */
  private getOrderedRegions(grid: Grid): Region[] {
    return [
      ...Array.from({ length: 9 }, (_, i) => grid.getBox(i)),
      ...Array.from({ length: 9 }, (_, i) => grid.getCol(i)),
      ...Array.from({ length: 9 }, (_, i) => grid.getRow(i)),
    ];
  }

  /**
   * Scan regions for hidden singles.
   * @returns true if accumulator signalled 'stop'
   */
  private scanRegions(
    grid: Grid,
    accumulator: HintAccumulator,
    regions: readonly Region[],
    aloneOnly: boolean,
  ): boolean {
    for (const region of regions) {
      for (let digit = 1; digit <= 9; digit++) {
        const candidateCells = region.getCandidateCells(digit);
        if (candidateCells.length !== 1) continue;

        const isAlone = region.getUnsolvedCells().length === 1;
        if (isAlone !== aloneOnly) continue;

        // Safe: we just checked length is 1
        const cell = candidateCells[0]!; // eslint-disable-line @typescript-eslint/no-non-null-assertion

        let difficulty: number;
        if (isAlone) {
          difficulty = HIDDEN_SINGLE_ALONE_DIFFICULTY;
        } else if (region.type === 'box') {
          difficulty = HIDDEN_SINGLE_BOX_DIFFICULTY;
        } else {
          difficulty = HIDDEN_SINGLE_LINE_DIFFICULTY;
        }

        const result = accumulator({
          type: 'direct',
          technique: 'HiddenSingle',
          difficulty,
          cell: cell.index,
          digit,
          explanation: isAlone
            ? `${cellName(cell.row, cell.col)} is the last empty cell in ${regionName(region.type, region.index)}, must be ${digit}`
            : `${digit} can only go in ${cellName(cell.row, cell.col)} in ${regionName(region.type, region.index)}`,
          involvedCells: [cell.index],
          involvedCandidates: new Map([[cell.index, [digit]]]),
        });

        if (result === 'stop') return true;
      }
    }
    return false;
  }
}
