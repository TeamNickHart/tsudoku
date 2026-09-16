import type { Cell, Grid, Region } from '../../types/Grid.js';
import type { HintAccumulator } from '../../types/Hint.js';
import type { HintProducer } from '../../types/HintProducer.js';
import { TECHNIQUE_DIFFICULTY } from '../../types/Technique.js';
import type { Technique } from '../../types/Technique.js';

function cellName(row: number, col: number): string {
  return `R${row + 1}C${col + 1}`;
}

function regionLabel(region: Region): string {
  if (region.type === 'row') return `row ${region.index + 1}`;
  if (region.type === 'col') return `column ${region.index + 1}`;
  return `box ${region.index + 1}`;
}

/**
 * Direct Pointing — matches SE's Locking.java (isDirectMode=true), pointing subset.
 *
 * For each box and each crossing line (column, then row), if a digit's candidates
 * in the box are all confined to that line, look for induced hidden singles in
 * OTHER boxes that also cross the same line.
 *
 * Scan order (matching SE):
 *   Block × Column (all boxes, all columns)
 *   Block × Row (all boxes, all rows)
 *
 * SE ref: diuf/sudoku/solver/rules/Locking.java — getHints() + lookForFollowingHiddenSingles()
 */
export class DirectPointing implements HintProducer {
  readonly technique = 'DirectPointing' as const;
  readonly difficulty = TECHNIQUE_DIFFICULTY.DirectPointing;

  getHints(grid: Grid, accumulator: HintAccumulator): void {
    // SE order: Block×Column, then Block×Row
    if (this.scanPointing(grid, accumulator, 'col')) return;
    this.scanPointing(grid, accumulator, 'row');
  }

  private scanPointing(grid: Grid, accumulator: HintAccumulator, lineType: 'row' | 'col'): boolean {
    for (let boxIdx = 0; boxIdx < 9; boxIdx++) {
      const box = grid.getBox(boxIdx);
      const lineCount = 9;

      for (let lineIdx = 0; lineIdx < lineCount; lineIdx++) {
        const line = lineType === 'col' ? grid.getCol(lineIdx) : grid.getRow(lineIdx);

        // Check if box and line cross (share cells)
        if (!regionsCross(box, line)) continue;

        const lineCellSet = new Set(line.cells.map((c) => c.index));

        for (let digit = 1; digit <= 9; digit++) {
          const boxPositions = box.getCandidateCells(digit);
          if (boxPositions.length <= 1) continue; // cardinality must be > 1

          // Check if ALL candidates for digit in box are within the line
          const allInLine = boxPositions.every((c) => lineCellSet.has(c.index));
          if (!allInLine) continue;

          // Pointing found: digit in box is locked to line.
          // Look for induced hidden singles in OTHER boxes crossing the same line.
          if (
            this.lookForFollowingHiddenSingles(grid, accumulator, boxIdx, line, digit, boxPositions)
          ) {
            return true;
          }
        }
      }
    }
    return false;
  }

  /**
   * SE's lookForFollowingHiddenSingles: for each OTHER box that crosses the
   * same line, check if removing the locked digit's line positions from that
   * box leaves exactly one candidate for the digit — an induced hidden single.
   */
  private lookForFollowingHiddenSingles(
    grid: Grid,
    accumulator: HintAccumulator,
    sourceBoxIdx: number,
    line: Region,
    digit: number,
    lockingCells: readonly Cell[],
  ): boolean {
    const lineCellSet = new Set(line.cells.map((c) => c.index));

    for (let otherBoxIdx = 0; otherBoxIdx < 9; otherBoxIdx++) {
      if (otherBoxIdx === sourceBoxIdx) continue;

      const otherBox = grid.getBox(otherBoxIdx);
      if (!regionsCross(otherBox, line)) continue;

      // Count candidates for digit in otherBox that are NOT in the line
      const otherPositions = otherBox.getCandidateCells(digit);
      if (otherPositions.length <= 1) continue; // must have > 1 to be reduced

      let remainCount = 0;
      let lastRemaining: Cell | null = null;
      for (const cell of otherPositions) {
        if (!lineCellSet.has(cell.index)) {
          remainCount++;
          lastRemaining = cell;
        }
      }

      if (remainCount === 1 && lastRemaining !== null) {
        // Induced hidden single: digit must go in lastRemaining
        const technique: Technique = 'DirectPointing';
        const result = accumulator({
          type: 'direct',
          technique,
          difficulty: this.difficulty,
          cell: lastRemaining.index,
          digit,
          explanation: `Pointing: ${digit} in ${regionLabel(grid.getBox(sourceBoxIdx))} is confined to ${regionLabel(line)}, placing ${digit} in ${cellName(lastRemaining.row, lastRemaining.col)}`,
          involvedCells: [...lockingCells.map((c) => c.index), lastRemaining.index],
          involvedCandidates: new Map([
            ...lockingCells.map((c) => [c.index, [digit]] as [number, number[]]),
            [lastRemaining.index, [digit]],
          ]),
        });
        if (result === 'stop') return true;
      }
    }
    return false;
  }
}

/** Check if two regions share any cells */
function regionsCross(a: Region, b: Region): boolean {
  const bSet = new Set(b.cells.map((c) => c.index));
  return a.cells.some((c) => bSet.has(c.index));
}
