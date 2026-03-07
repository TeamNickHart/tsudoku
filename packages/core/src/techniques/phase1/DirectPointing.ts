import type { Grid } from '../../types/Grid.js';
import type { HintAccumulator } from '../../types/Hint.js';
import type { HintProducer } from '../../types/HintProducer.js';
import { TECHNIQUE_DIFFICULTY } from '../../types/Technique.js';
import { hasCandidate } from '../../candidates/bitmask.js';

function cellName(row: number, col: number): string {
  return `R${row + 1}C${col + 1}`;
}

// Direct Pointing: Within a box, if a digit's candidates all share the same
// row or column, AND removing that digit from the rest of that row/col
// leaves exactly one candidate in some cell, that cell gets placed directly.
//
// SE difficulty: 1.7

export class DirectPointing implements HintProducer {
  readonly technique = 'DirectPointing' as const;
  readonly difficulty = TECHNIQUE_DIFFICULTY.DirectPointing;

  getHints(grid: Grid, accumulator: HintAccumulator): void {
    for (let boxIdx = 0; boxIdx < 9; boxIdx++) {
      const box = grid.getBox(boxIdx);

      for (let digit = 1; digit <= 9; digit++) {
        const candidateCells = box.getCandidateCells(digit);
        if (candidateCells.length < 2 || candidateCells.length > 3) continue;

        // Check if all candidate cells share a row
        // Safe: candidateCells has at least 2 elements
        const firstRow = candidateCells[0]!.row; // eslint-disable-line @typescript-eslint/no-non-null-assertion
        const allSameRow = candidateCells.every((c) => c.row === firstRow);

        if (allSameRow) {
          const placement = this.findDirectPlacement(
            grid,
            grid.getRow(firstRow),
            digit,
            candidateCells.map((c) => c.index),
            boxIdx,
          );
          if (placement !== null) {
            const result = accumulator({
              type: 'direct',
              technique: 'DirectPointing',
              difficulty: this.difficulty,
              cell: placement.cellIndex,
              digit: placement.digit,
              explanation: `Pointing: ${digit} in box ${boxIdx + 1} is confined to row ${firstRow + 1}, placing ${placement.digit} in ${cellName(placement.row, placement.col)}`,
              involvedCells: [...candidateCells.map((c) => c.index), placement.cellIndex],
              involvedCandidates: new Map([
                ...candidateCells.map((c) => [c.index, [digit]] as [number, number[]]),
                [placement.cellIndex, [placement.digit]],
              ]),
            });
            if (result === 'stop') return;
          }
        }

        // Check if all candidate cells share a column
        // Safe: candidateCells has at least 2 elements
        const firstCol = candidateCells[0]!.col; // eslint-disable-line @typescript-eslint/no-non-null-assertion
        const allSameCol = candidateCells.every((c) => c.col === firstCol);

        if (allSameCol) {
          const placement = this.findDirectPlacement(
            grid,
            grid.getCol(firstCol),
            digit,
            candidateCells.map((c) => c.index),
            boxIdx,
          );
          if (placement !== null) {
            const result = accumulator({
              type: 'direct',
              technique: 'DirectPointing',
              difficulty: this.difficulty,
              cell: placement.cellIndex,
              digit: placement.digit,
              explanation: `Pointing: ${digit} in box ${boxIdx + 1} is confined to column ${firstCol + 1}, placing ${placement.digit} in ${cellName(placement.row, placement.col)}`,
              involvedCells: [...candidateCells.map((c) => c.index), placement.cellIndex],
              involvedCandidates: new Map([
                ...candidateCells.map((c) => [c.index, [digit]] as [number, number[]]),
                [placement.cellIndex, [placement.digit]],
              ]),
            });
            if (result === 'stop') return;
          }
        }
      }
    }
  }

  private findDirectPlacement(
    grid: Grid,
    line: { readonly cells: readonly import('../../types/Grid.js').Cell[] },
    lockedDigit: number,
    lockedCellIndices: readonly number[],
    boxIdx: number,
  ): { cellIndex: number; digit: number; row: number; col: number } | null {
    // After removing lockedDigit from cells in the line outside the box,
    // check if any cell in the line (outside the box) ends up with exactly
    // one candidate remaining.
    const lockedSet = new Set(lockedCellIndices);

    for (const cell of line.cells) {
      if (cell.value !== null) continue;
      if (cell.box === boxIdx) continue;
      if (lockedSet.has(cell.index)) continue;

      if (!hasCandidate(cell.candidates, lockedDigit)) continue;

      // This cell would lose lockedDigit. Check if it becomes a naked single.
      if (cell.candidateCount === 2) {
        // After removing lockedDigit, exactly one candidate remains
        for (const d of cell.candidateList) {
          if (d !== lockedDigit) {
            return { cellIndex: cell.index, digit: d, row: cell.row, col: cell.col };
          }
        }
      }
    }
    return null;
  }
}
