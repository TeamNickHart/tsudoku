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
 * Direct Claiming — matches SE's Locking.java (isDirectMode=true), claiming subset.
 *
 * For each line (column, then row) and each crossing box, if a digit's candidates
 * in the line are all confined to that box, look for induced hidden singles in
 * OTHER lines of the same type that also cross the same box.
 *
 * Scan order (matching SE):
 *   Column × Block (all columns, all boxes)
 *   Row × Block (all rows, all boxes)
 *
 * SE ref: diuf/sudoku/solver/rules/Locking.java — getHints() + lookForFollowingHiddenSingles()
 */
export class DirectClaiming implements HintProducer {
  readonly technique = 'DirectClaiming' as const;
  readonly difficulty = TECHNIQUE_DIFFICULTY.DirectClaiming;

  getHints(grid: Grid, accumulator: HintAccumulator): void {
    // SE order: Column×Block, then Row×Block
    if (this.scanClaiming(grid, accumulator, 'col')) return;
    this.scanClaiming(grid, accumulator, 'row');
  }

  private scanClaiming(grid: Grid, accumulator: HintAccumulator, lineType: 'row' | 'col'): boolean {
    for (let lineIdx = 0; lineIdx < 9; lineIdx++) {
      const line = lineType === 'col' ? grid.getCol(lineIdx) : grid.getRow(lineIdx);

      for (let boxIdx = 0; boxIdx < 9; boxIdx++) {
        const box = grid.getBox(boxIdx);

        // Check if line and box cross (share cells)
        if (!regionsCross(line, box)) continue;

        const boxCellSet = new Set(box.cells.map((c) => c.index));

        for (let digit = 1; digit <= 9; digit++) {
          const linePositions = line.getCandidateCells(digit);
          if (linePositions.length <= 1) continue;

          // Check if ALL candidates for digit in line are within the box
          const allInBox = linePositions.every((c) => boxCellSet.has(c.index));
          if (!allInBox) continue;

          // Claiming found: digit in line is locked to box.
          // Look for induced hidden singles in OTHER lines crossing the same box.
          if (
            this.lookForFollowingHiddenSingles(
              grid,
              accumulator,
              lineIdx,
              lineType,
              box,
              digit,
              linePositions,
            )
          ) {
            return true;
          }
        }
      }
    }
    return false;
  }

  /**
   * SE's lookForFollowingHiddenSingles: for each OTHER line of the same type
   * that crosses the same box, check if removing the locked digit's box positions
   * from that line leaves exactly one candidate for the digit — an induced hidden single.
   */
  private lookForFollowingHiddenSingles(
    grid: Grid,
    accumulator: HintAccumulator,
    sourceLineIdx: number,
    lineType: 'row' | 'col',
    box: Region,
    digit: number,
    lockingCells: readonly Cell[],
  ): boolean {
    const boxCellSet = new Set(box.cells.map((c) => c.index));

    for (let otherLineIdx = 0; otherLineIdx < 9; otherLineIdx++) {
      if (otherLineIdx === sourceLineIdx) continue;

      const otherLine = lineType === 'col' ? grid.getCol(otherLineIdx) : grid.getRow(otherLineIdx);
      if (!regionsCross(otherLine, box)) continue;

      // Count candidates for digit in otherLine that are NOT in the box
      const otherPositions = otherLine.getCandidateCells(digit);
      if (otherPositions.length <= 1) continue;

      let remainCount = 0;
      let lastRemaining: Cell | null = null;
      for (const cell of otherPositions) {
        if (!boxCellSet.has(cell.index)) {
          remainCount++;
          lastRemaining = cell;
        }
      }

      if (remainCount === 1 && lastRemaining !== null) {
        // Induced hidden single: digit must go in lastRemaining
        const sourceLine =
          lineType === 'col' ? grid.getCol(sourceLineIdx) : grid.getRow(sourceLineIdx);
        const technique: Technique = 'DirectClaiming';
        const result = accumulator({
          type: 'direct',
          technique,
          difficulty: this.difficulty,
          cell: lastRemaining.index,
          digit,
          explanation: `Claiming: ${digit} in ${regionLabel(sourceLine)} is confined to ${regionLabel(box)}, placing ${digit} in ${cellName(lastRemaining.row, lastRemaining.col)}`,
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
