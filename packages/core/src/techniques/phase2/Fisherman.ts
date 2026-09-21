import type { Grid, Region } from '../../types/Grid.js';
import type { HintAccumulator } from '../../types/Hint.js';
import type { HintProducer } from '../../types/HintProducer.js';
import type { Technique } from '../../types/Technique.js';
import { TECHNIQUE_DIFFICULTY } from '../../types/Technique.js';
import { SIZE } from '../../models/board.js';
import { permutations } from '../../tools/permutations.js';

const FISH_NAMES: Record<number, string> = {
  2: 'X-Wing',
  3: 'Swordfish',
  4: 'Jellyfish',
};

/**
 * X-Wing / Swordfish / Jellyfish — line-by-line port of SE's `Fisherman.java`.
 *
 * All three are **the same technique at different sizes**, which is worth
 * saying plainly because the separate names hide it: if a digit's possible
 * positions across N rows all fall within the same N columns, then those
 * columns are fully committed to that digit and it can be eliminated from
 * every other cell in them. And symmetrically with rows and columns swapped.
 *
 * - N=2 is an X-Wing (3.2)
 * - N=3 is a Swordfish (3.8)
 * - N=4 is a Jellyfish (5.2)
 *
 * The logic does not change with N, only the spatial load of seeing it.
 *
 * SE ref: diuf/sudoku/solver/rules/Fisherman.java
 */
export class Fisherman implements HintProducer {
  readonly technique: Technique;
  readonly difficulty: number;
  private readonly degree: number;

  constructor(degree: 2 | 3 | 4) {
    this.degree = degree;
    this.technique = degree === 2 ? 'XWing' : degree === 3 ? 'Swordfish' : 'Jellyfish';
    this.difficulty = TECHNIQUE_DIFFICULTY[this.technique];
  }

  getHints(grid: Grid, accumulator: HintAccumulator): void {
    // SE: getHints(grid, Row, Column) then getHints(grid, Column, Row).
    if (this.scan(grid, 'row', accumulator)) return;
    this.scan(grid, 'col', accumulator);
  }

  /**
   * @param baseType the lines the pattern is *found* in; eliminations happen
   *   in the perpendicular lines.
   * @returns true if the accumulator signalled 'stop'
   */
  private scan(grid: Grid, baseType: 'row' | 'col', accumulator: HintAccumulator): boolean {
    // SE: occurances[value] — how many of this digit are already placed.
    const placed = new Array<number>(SIZE + 1).fill(0);
    for (const cell of grid.cells) {
      if (cell.value !== null) placed[cell.value] = (placed[cell.value] ?? 0) + 1;
    }

    for (const indexes of permutations(this.degree, SIZE)) {
      for (let value = 1; value <= SIZE; value++) {
        // SE: the pattern needs at least degree*2 missing occurrences.
        if ((placed[value] ?? 0) + this.degree * 2 > SIZE) continue;

        const baseLines = indexes.map((i) =>
          baseType === 'row' ? grid.getRow(i) : grid.getCol(i),
        );

        // Positions of `value` within each base line, as cross-line indexes.
        let valid = true;
        const union = new Set<number>();
        for (const line of baseLines) {
          const positions = line.getCandidateCells(value);
          if (positions.length <= 1) {
            valid = false;
            break;
          }
          for (const cell of positions) {
            union.add(baseType === 'row' ? cell.col : cell.row);
          }
        }
        if (!valid) continue;

        // The defining condition: N lines, N cross-lines.
        if (union.size !== this.degree) continue;

        if (this.emit(grid, baseType, indexes, [...union], value, accumulator)) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Port of `createFishHint` plus SE's `isWorth()` — eliminations are the
   * digit's other positions in the covering lines.
   *
   * @returns true if the accumulator signalled 'stop'
   */
  private emit(
    grid: Grid,
    baseType: 'row' | 'col',
    baseIndexes: readonly number[],
    coverIndexes: readonly number[],
    value: number,
    accumulator: HintAccumulator,
  ): boolean {
    const baseSet = new Set(baseIndexes);
    const eliminations: { cell: number; digit: number }[] = [];
    const involvedCells: number[] = [];
    const involvedCandidates = new Map<number, readonly number[]>();

    for (const coverIndex of coverIndexes) {
      const coverLine: Region =
        baseType === 'row' ? grid.getCol(coverIndex) : grid.getRow(coverIndex);

      for (const cell of coverLine.getCandidateCells(value)) {
        const cellBaseIndex = baseType === 'row' ? cell.row : cell.col;
        if (baseSet.has(cellBaseIndex)) {
          // Part of the pattern itself — highlight, do not eliminate.
          involvedCells.push(cell.index);
          involvedCandidates.set(cell.index, [value]);
        } else {
          eliminations.push({ cell: cell.index, digit: value });
        }
      }
    }

    if (eliminations.length === 0) return false;

    const baseLabel = baseType === 'row' ? 'rows' : 'columns';
    const coverLabel = baseType === 'row' ? 'columns' : 'rows';
    const baseList = baseIndexes.map((i) => i + 1).join(', ');
    const coverList = coverIndexes.map((i) => i + 1).join(', ');

    const result = accumulator({
      type: 'elimination',
      technique: this.technique,
      difficulty: this.difficulty,
      eliminations,
      explanation:
        `${FISH_NAMES[this.degree]}: in ${baseLabel} ${baseList}, ${value} can only go in ` +
        `${coverLabel} ${coverList}. Those ${coverLabel} are therefore used up by ${value}, ` +
        `so it can be removed elsewhere in them`,
      involvedCells,
      involvedCandidates,
    });

    return result === 'stop';
  }
}
