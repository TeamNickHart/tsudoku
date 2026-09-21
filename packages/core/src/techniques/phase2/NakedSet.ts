import type { Grid, Region, RegionType } from '../../types/Grid.js';
import type { HintAccumulator } from '../../types/Hint.js';
import type { HintProducer } from '../../types/HintProducer.js';
import type { Technique } from '../../types/Technique.js';
import { TECHNIQUE_DIFFICULTY } from '../../types/Technique.js';
import { SIZE } from '../../models/board.js';
import { candidateCount, candidateList } from '../../candidates/bitmask.js';
import { permutations } from '../../tools/permutations.js';

function cellName(row: number, col: number): string {
  return `R${row + 1}C${col + 1}`;
}

function regionName(region: Region): string {
  if (region.type === 'row') return `row ${region.index + 1}`;
  if (region.type === 'col') return `column ${region.index + 1}`;
  return `box ${region.index + 1}`;
}

const SET_NAMES: Record<number, string> = {
  2: 'Naked Pair',
  3: 'Naked Triplet',
  4: 'Naked Quad',
};

/**
 * Naked Pair / Triplet / Quad — line-by-line port of SE's `NakedSet.java`.
 *
 * If N cells in a region hold, between them, exactly N candidate digits, those
 * digits must occupy those cells — so no other cell in the region can use them.
 *
 * One class parameterised by size, as SE has it. Difficulty rises with size:
 * pair 3.0, triplet 3.6, quad 5.0. The quad is Phase 3 by rating but lives
 * here because the code is identical.
 *
 * SE ref: diuf/sudoku/solver/rules/NakedSet.java
 * SE ref: diuf/sudoku/tools/CommonTuples.java (searchCommonTuple)
 */
export class NakedSet implements HintProducer {
  readonly technique: Technique;
  readonly difficulty: number;
  private readonly degree: number;

  constructor(degree: 2 | 3 | 4) {
    this.degree = degree;
    this.technique = degree === 2 ? 'NakedPair' : degree === 3 ? 'NakedTriplet' : 'NakedQuad';
    this.difficulty = TECHNIQUE_DIFFICULTY[this.technique];
  }

  getHints(grid: Grid, accumulator: HintAccumulator): void {
    // SE order: blocks, columns, rows.
    if (this.scanRegionType(grid, 'box', accumulator)) return;
    if (this.scanRegionType(grid, 'col', accumulator)) return;
    this.scanRegionType(grid, 'row', accumulator);
  }

  /** @returns true if the accumulator signalled 'stop' */
  private scanRegionType(grid: Grid, type: RegionType, accumulator: HintAccumulator): boolean {
    for (let i = 0; i < SIZE; i++) {
      const region =
        type === 'row' ? grid.getRow(i) : type === 'col' ? grid.getCol(i) : grid.getBox(i);

      // SE: if (region.getEmptyCellCount() >= degree * 2)
      //
      // Below that, a naked set cannot eliminate anything: the set occupies
      // `degree` cells and there must be at least `degree` others to eliminate
      // from. Skipping early is what keeps this affordable.
      if (region.getUnsolvedCells().length < this.degree * 2) continue;

      if (this.scanRegion(region, accumulator)) return true;
    }
    return false;
  }

  /** @returns true if the accumulator signalled 'stop' */
  private scanRegion(region: Region, accumulator: HintAccumulator): boolean {
    // SE: Permutations perm = new Permutations(degree, 9)
    for (const indexes of permutations(this.degree, SIZE)) {
      const cells = indexes.map((index) => region.cells[index]!); // eslint-disable-line @typescript-eslint/no-non-null-assertion

      // SE's searchCommonTuple: a solved cell (cardinality 0) or a cell with a
      // single candidate disqualifies the tuple, and the union must be exactly
      // `degree` digits.
      let union = 0;
      let valid = true;
      for (const cell of cells) {
        if (cell.candidateCount <= 1) {
          valid = false;
          break;
        }
        union |= cell.candidates;
      }
      if (!valid) continue;
      if (candidateCount(union) !== this.degree) continue;

      if (this.emit(region, cells, union, accumulator)) return true;
    }
    return false;
  }

  /**
   * Port of `createValueUniquenessHint` plus SE's `isWorth()` check — a hint
   * that removes nothing is not offered.
   *
   * @returns true if the accumulator signalled 'stop'
   */
  private emit(
    region: Region,
    setCells: readonly Grid['cells'][number][],
    union: number,
    accumulator: HintAccumulator,
  ): boolean {
    const setIndexes = new Set(setCells.map((c) => c.index));
    const digits = candidateList(union);

    const eliminations: { cell: number; digit: number }[] = [];
    for (const cell of region.cells) {
      if (cell.value !== null) continue;
      if (setIndexes.has(cell.index)) continue;
      for (const digit of digits) {
        if ((cell.candidates & (1 << (digit - 1))) !== 0) {
          eliminations.push({ cell: cell.index, digit });
        }
      }
    }

    if (eliminations.length === 0) return false;

    const involvedCandidates = new Map<number, readonly number[]>();
    for (const cell of setCells) {
      involvedCandidates.set(cell.index, candidateList(cell.candidates));
    }

    const names = setCells.map((c) => cellName(c.row, c.col)).join(', ');
    const result = accumulator({
      type: 'elimination',
      technique: this.technique,
      difficulty: this.difficulty,
      eliminations,
      explanation:
        `${SET_NAMES[this.degree]}: ${names} in ${regionName(region)} hold only ` +
        `{${digits.join(',')}}, so those digits can be removed from the rest of the ${region.type}`,
      involvedCells: setCells.map((c) => c.index),
      involvedCandidates,
    });

    return result === 'stop';
  }
}
