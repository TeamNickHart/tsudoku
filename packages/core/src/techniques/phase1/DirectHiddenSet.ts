import type { Cell, Grid } from '../../types/Grid.js';
import type { HintAccumulator } from '../../types/Hint.js';
import type { HintProducer } from '../../types/HintProducer.js';
import type { Technique } from '../../types/Technique.js';
import { TECHNIQUE_DIFFICULTY } from '../../types/Technique.js';
function cellName(row: number, col: number): string {
  return `R${row + 1}C${col + 1}`;
}

// Direct Hidden Pair/Triplet: Within a region, if N digits can only appear in
// N cells, then all other candidates can be removed from those cells. If after
// this removal, one of those cells has exactly one candidate remaining, it can
// be placed directly. This is the "direct" variant — it produces a placement,
// not just an elimination.
//
// Direct Hidden Pair: SE 2.0 (size=2)
// Direct Hidden Triplet: SE 2.5 (size=3)

export class DirectHiddenSet implements HintProducer {
  readonly technique: Technique;
  readonly difficulty: number;
  private readonly size: number;

  constructor(size: 2 | 3) {
    this.size = size;
    this.technique = size === 2 ? 'DirectHiddenPair' : 'DirectHiddenTriplet';
    this.difficulty = TECHNIQUE_DIFFICULTY[this.technique];
  }

  getHints(grid: Grid, accumulator: HintAccumulator): void {
    for (const region of grid.regions) {
      // Find digits that have 2-N candidate cells in this region
      const digitPositions: { digit: number; cells: readonly Cell[] }[] = [];
      for (let d = 1; d <= 9; d++) {
        const cells = region.getCandidateCells(d);
        if (cells.length >= 2 && cells.length <= this.size) {
          digitPositions.push({ digit: d, cells });
        }
      }

      if (digitPositions.length < this.size) continue;

      // Try all combinations of `size` digits
      const combos = this.combinations(digitPositions, this.size);
      for (const combo of combos) {
        // Collect all cells that contain any of these digits
        const cellSet = new Set<number>();
        for (const dp of combo) {
          for (const c of dp.cells) {
            cellSet.add(c.index);
          }
        }

        // Hidden set: N digits in exactly N cells
        if (cellSet.size !== this.size) continue;

        const hiddenDigits = new Set(combo.map((dp) => dp.digit));
        const setCells = [...cellSet].map((idx) => grid.getCellByIndex(idx));

        // Check if removing non-hidden candidates from any set cell
        // leaves exactly one candidate
        for (const cell of setCells) {
          let remainingCount = 0;
          let remainingDigit = 0;
          for (const d of cell.candidateList) {
            if (hiddenDigits.has(d)) {
              remainingCount++;
              remainingDigit = d;
            }
          }

          if (remainingCount === 1) {
            const setName = this.size === 2 ? 'Hidden Pair' : 'Hidden Triplet';
            const digitStr = [...hiddenDigits].join(', ');

            const result = accumulator({
              type: 'direct',
              technique: this.technique,
              difficulty: this.difficulty,
              cell: cell.index,
              digit: remainingDigit,
              explanation: `Direct ${setName}: digits {${digitStr}} in ${region.type} ${region.index + 1} are confined to ${this.size} cells, placing ${remainingDigit} in ${cellName(cell.row, cell.col)}`,
              involvedCells: [...cellSet],
              involvedCandidates: new Map(
                setCells.map((c) => [c.index, c.candidateList.filter((d) => hiddenDigits.has(d))]),
              ),
            });
            if (result === 'stop') return;
          }
        }
      }
    }
  }

  private combinations<T>(items: readonly T[], size: number): T[][] {
    if (size === 0) return [[]];
    if (items.length < size) return [];
    const result: T[][] = [];

    for (let i = 0; i <= items.length - size; i++) {
      // Safe: i is within bounds
      const first = items[i]!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
      const rest = items.slice(i + 1);
      for (const combo of this.combinations(rest, size - 1)) {
        result.push([first, ...combo]);
      }
    }
    return result;
  }
}
