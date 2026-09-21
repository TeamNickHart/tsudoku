import type { Cell, Grid, Region, RegionType } from '../../types/Grid.js';
import type { HintAccumulator } from '../../types/Hint.js';
import type { HintProducer } from '../../types/HintProducer.js';
import type { Technique } from '../../types/Technique.js';
import { TECHNIQUE_DIFFICULTY } from '../../types/Technique.js';
import { SIZE } from '../../models/board.js';
import { candidateList, hasCandidate } from '../../candidates/bitmask.js';
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
  2: 'Hidden Pair',
  3: 'Hidden Triplet',
  4: 'Hidden Quad',
};

/**
 * Hidden Pair / Triplet / Quad — line-by-line port of SE's `HiddenSet.java`
 * with `isDirect = false`.
 *
 * The dual of NakedSet. Where a naked set finds N cells holding N digits
 * between them, a hidden set finds N *digits* that can only go in N cells —
 * so those cells can hold nothing else, however many other candidates they
 * appear to have.
 *
 * "Hidden" because the set is obscured by the extra candidates that are about
 * to be eliminated.
 *
 * SE ref: diuf/sudoku/solver/rules/HiddenSet.java
 */
export class HiddenSet implements HintProducer {
  readonly technique: Technique;
  readonly difficulty: number;
  private readonly degree: number;

  constructor(degree: 2 | 3 | 4) {
    this.degree = degree;
    this.technique = degree === 2 ? 'HiddenPair' : degree === 3 ? 'HiddenTriplet' : 'HiddenQuad';
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

      // SE: if (nbEmptyCells > degree * 2) for the indirect case.
      // Strictly greater, unlike NakedSet — a hidden set in exactly 2*degree
      // cells is the complementary naked set, which NakedSet already reports.
      if (region.getUnsolvedCells().length <= this.degree * 2) continue;

      if (this.scanRegion(region, accumulator)) return true;
    }
    return false;
  }

  /** @returns true if the accumulator signalled 'stop' */
  private scanRegion(region: Region, accumulator: HintAccumulator): boolean {
    // SE iterates permutations of *values* here, not of cells.
    for (const indexes of permutations(this.degree, SIZE)) {
      const values = indexes.map((i) => i + 1); // SE: values[i] += 1

      // Positions within the region where each value can still go.
      const positionSets = values.map((value) =>
        region.getCandidateCells(value).map((c) => c.index),
      );

      // searchCommonTuple: every value must have somewhere to go, and the
      // union of their positions must be exactly `degree` cells.
      let valid = true;
      const union = new Set<number>();
      for (const positions of positionSets) {
        if (positions.length <= 1) {
          valid = false;
          break;
        }
        for (const p of positions) union.add(p);
      }
      if (!valid) continue;
      if (union.size !== this.degree) continue;

      if (this.emit(region, values, [...union], accumulator)) return true;
    }
    return false;
  }

  /**
   * Port of `createHiddenSetHint` plus SE's `isWorth()` — the eliminations are
   * the *other* candidates in the set's own cells.
   *
   * @returns true if the accumulator signalled 'stop'
   */
  private emit(
    region: Region,
    values: readonly number[],
    cellIndexes: readonly number[],
    accumulator: HintAccumulator,
  ): boolean {
    const setCells: Cell[] = [];
    const eliminations: { cell: number; digit: number }[] = [];

    for (const index of cellIndexes) {
      const cell = region.cells.find((c) => c.index === index);
      if (cell === undefined || cell.value !== null) continue;
      setCells.push(cell);

      for (const digit of candidateList(cell.candidates)) {
        if (!values.includes(digit)) {
          eliminations.push({ cell: cell.index, digit });
        }
      }
    }

    if (eliminations.length === 0) return false;

    const involvedCandidates = new Map<number, readonly number[]>();
    for (const cell of setCells) {
      involvedCandidates.set(
        cell.index,
        values.filter((v) => hasCandidate(cell.candidates, v)),
      );
    }

    const names = setCells.map((c) => cellName(c.row, c.col)).join(', ');
    const result = accumulator({
      type: 'elimination',
      technique: this.technique,
      difficulty: this.difficulty,
      eliminations,
      explanation:
        `${SET_NAMES[this.degree]}: {${values.join(',')}} in ${regionName(region)} can only go ` +
        `in ${names}, so those cells hold nothing else`,
      involvedCells: setCells.map((c) => c.index),
      involvedCandidates,
    });

    return result === 'stop';
  }
}
