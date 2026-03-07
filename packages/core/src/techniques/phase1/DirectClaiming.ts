import type { Grid } from '../../types/Grid.js';
import type { HintAccumulator } from '../../types/Hint.js';
import type { HintProducer } from '../../types/HintProducer.js';
import { TECHNIQUE_DIFFICULTY } from '../../types/Technique.js';
import { hasCandidate } from '../../candidates/bitmask.js';

function cellName(row: number, col: number): string {
  return `R${row + 1}C${col + 1}`;
}

// Direct Claiming: Within a row or column, if a digit's candidates all fall
// in the same box, AND removing that digit from the rest of the box leaves
// exactly one candidate in some cell, that cell gets placed directly.
//
// SE difficulty: 1.9

export class DirectClaiming implements HintProducer {
  readonly technique = 'DirectClaiming' as const;
  readonly difficulty = TECHNIQUE_DIFFICULTY.DirectClaiming;

  getHints(grid: Grid, accumulator: HintAccumulator): void {
    // Check rows and columns (not boxes — that's pointing)
    for (let regionIdx = 0; regionIdx < 18; regionIdx++) {
      const region = regionIdx < 9 ? grid.getRow(regionIdx) : grid.getCol(regionIdx - 9);

      for (let digit = 1; digit <= 9; digit++) {
        const candidateCells = region.getCandidateCells(digit);
        if (candidateCells.length < 2 || candidateCells.length > 3) continue;

        // Check if all candidate cells share the same box
        // Safe: candidateCells has at least 2 elements
        const firstBox = candidateCells[0]!.box; // eslint-disable-line @typescript-eslint/no-non-null-assertion
        const allSameBox = candidateCells.every((c) => c.box === firstBox);

        if (!allSameBox) continue;

        // The digit is locked to this box from this line.
        // Check if removing it from other cells in the box creates a naked single.
        const box = grid.getBox(firstBox);
        const lockedSet = new Set(candidateCells.map((c) => c.index));

        for (const cell of box.cells) {
          if (cell.value !== null) continue;
          if (lockedSet.has(cell.index)) continue;
          if (!hasCandidate(cell.candidates, digit)) continue;

          // This cell would lose the digit. Does it become a naked single?
          if (cell.candidateCount === 2) {
            for (const d of cell.candidateList) {
              if (d !== digit) {
                const lineType = regionIdx < 9 ? 'row' : 'column';
                const lineNum = regionIdx < 9 ? regionIdx + 1 : regionIdx - 8;

                const result = accumulator({
                  type: 'direct',
                  technique: 'DirectClaiming',
                  difficulty: this.difficulty,
                  cell: cell.index,
                  digit: d,
                  explanation: `Claiming: ${digit} in ${lineType} ${lineNum} is confined to box ${firstBox + 1}, placing ${d} in ${cellName(cell.row, cell.col)}`,
                  involvedCells: [...candidateCells.map((c) => c.index), cell.index],
                  involvedCandidates: new Map([
                    ...candidateCells.map((c) => [c.index, [digit]] as [number, number[]]),
                    [cell.index, [d]],
                  ]),
                });
                if (result === 'stop') return;
              }
            }
          }
        }
      }
    }
  }
}
