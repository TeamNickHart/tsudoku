import type { Grid, Region } from '../../types/Grid.js';
import type { HintAccumulator } from '../../types/Hint.js';
import type { HintProducer } from '../../types/HintProducer.js';
import type { Technique } from '../../types/Technique.js';
import { TECHNIQUE_DIFFICULTY } from '../../types/Technique.js';

function cellName(row: number, col: number): string {
  return `R${row + 1}C${col + 1}`;
}

/**
 * Direct Hidden Set — line-by-line port of SE's HiddenSet.java (isDirect=true).
 *
 * For each region, iterates over all C(9, degree) combinations of digits.
 * For each combination, checks if the union of their candidate positions has
 * cardinality == degree (a hidden set). If so, looks for OTHER digits in the
 * region whose positions, after removing the hidden set cells, have cardinality
 * 1 — an induced hidden single.
 *
 * Region order: blocks → columns → rows (matching SE).
 *
 * SE ref: diuf/sudoku/solver/rules/HiddenSet.java
 * SE ref: diuf/sudoku/tools/Permutations.java
 * SE ref: diuf/sudoku/tools/CommonTuples.java
 */
export class DirectHiddenSet implements HintProducer {
  readonly technique: Technique;
  readonly difficulty: number;
  private readonly degree: number;

  constructor(degree: 2 | 3) {
    this.degree = degree;
    this.technique = degree === 2 ? 'DirectHiddenPair' : 'DirectHiddenTriplet';
    this.difficulty = TECHNIQUE_DIFFICULTY[this.technique];
  }

  getHints(grid: Grid, accumulator: HintAccumulator): void {
    // SE order: blocks, columns, rows
    // SE: getHints(grid, Grid.Block.class, accu);
    if (this.getHintsForRegionType(grid, accumulator, 'box')) return;
    // SE: getHints(grid, Grid.Column.class, accu);
    if (this.getHintsForRegionType(grid, accumulator, 'col')) return;
    // SE: getHints(grid, Grid.Row.class, accu);
    this.getHintsForRegionType(grid, accumulator, 'row');
  }

  /**
   * Port of HiddenSet.getHints(grid, regionType, accu).
   * @returns true if accumulator signalled 'stop'
   */
  private getHintsForRegionType(
    grid: Grid,
    accumulator: HintAccumulator,
    regionType: 'box' | 'col' | 'row',
  ): boolean {
    for (let i = 0; i < 9; i++) {
      const region =
        regionType === 'box'
          ? grid.getBox(i)
          : regionType === 'col'
            ? grid.getCol(i)
            : grid.getRow(i);

      const nbEmptyCells = region.getUnsolvedCells().length;
      // SE: if (nbEmptyCells > degree * 2 || (isDirect && nbEmptyCells > degree))
      // isDirect is always true for this class
      if (nbEmptyCells > this.degree) {
        // SE: Permutations perm = new Permutations(degree, 9);
        // Iterate on all C(9, degree) combinations of digits
        const perms = permutations(this.degree, 9);
        for (const bitNums of perms) {
          // SE: values[i] += 1; // 0..8 -> 1..9
          const values = bitNums.map((b) => b + 1);

          // SE: Build potential positions for each value of the tuple
          // SE uses region.getPotentialPositions(value) which returns a BitSet
          // of cell indices within the region. We use a Set<number> of cell
          // indices within the region (0-8).
          const potentialIndexes: Set<number>[] = [];
          for (let d = 0; d < this.degree; d++) {
            const positions = new Set<number>();
            for (let cellIdx = 0; cellIdx < 9; cellIdx++) {
              const cell = region.cells[cellIdx];
              if (
                cell !== undefined &&
                cell.value === null &&
                cell.candidateList.includes(values[d]!)
              ) {
                positions.add(cellIdx);
              }
            }
            potentialIndexes.push(positions);
          }

          // SE: CommonTuples.searchCommonTuple(potentialIndexes, degree)
          const commonPositions = searchCommonTuple(potentialIndexes, this.degree);
          if (commonPositions !== null) {
            // SE: createHiddenSetHint(region, values, commonPotentialPositions)
            const result = this.createDirectHint(
              grid,
              region,
              values,
              commonPositions,
              accumulator,
            );
            if (result) return true;
          }
        }
      }
    }
    return false;
  }

  /**
   * Port of HiddenSet.createHiddenSetHint() — isDirect branch only.
   * Looks for induced hidden singles: other digits whose positions in the
   * region, after removing the hidden set cells, have cardinality 1.
   * @returns true if accumulator signalled 'stop'
   */
  private createDirectHint(
    grid: Grid,
    region: Region,
    values: number[],
    commonPositions: Set<number>,
    accumulator: HintAccumulator,
  ): boolean {
    // SE: BitSet valueSet — set of the hidden set digit values
    const valueSet = new Set(values);

    // Collect the cells in the hidden set (for hint metadata)
    const setCellIndices: number[] = [];
    for (let index = 0; index < 9; index++) {
      if (commonPositions.has(index)) {
        const cell = region.cells[index];
        if (cell !== undefined) {
          setCellIndices.push(cell.index);
        }
      }
    }

    // SE: isDirect branch — Look for Hidden Single
    // For each digit NOT in the hidden set, check if removing the hidden set
    // cells from its positions leaves exactly one position.
    for (let value = 1; value <= 9; value++) {
      if (valueSet.has(value)) continue;

      // SE: BitSet positions = region.copyPotentialPositions(value);
      const positions = new Set<number>();
      for (let cellIdx = 0; cellIdx < 9; cellIdx++) {
        const cell = region.cells[cellIdx];
        if (cell !== undefined && cell.value === null && cell.candidateList.includes(value)) {
          positions.add(cellIdx);
        }
      }

      // SE: if (positions.cardinality() > 1)
      if (positions.size > 1) {
        // SE: positions.andNot(commonPotentialPositions);
        for (const pos of commonPositions) {
          positions.delete(pos);
        }
        // SE: if (positions.cardinality() == 1)
        if (positions.size === 1) {
          // Hidden single found
          // SE: int index = positions.nextSetBit(0);
          const index = [...positions][0]!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
          const cell = region.cells[index]!; // eslint-disable-line @typescript-eslint/no-non-null-assertion

          const setName = this.degree === 2 ? 'Hidden Pair' : 'Hidden Triplet';
          const digitStr = values.join(', ');

          const result = accumulator({
            type: 'direct',
            technique: this.technique,
            difficulty: this.difficulty,
            cell: cell.index,
            digit: value,
            explanation: `Direct ${setName}: digits {${digitStr}} in ${region.type} ${region.index + 1} confine ${value} to ${cellName(cell.row, cell.col)}`,
            involvedCells: [...setCellIndices, cell.index],
            involvedCandidates: new Map(
              setCellIndices.map((idx) => {
                const c = grid.getCellByIndex(idx);
                return [idx, c.candidateList.filter((d) => valueSet.has(d))];
              }),
            ),
          });
          if (result === 'stop') return true;
        }
      }
    }

    // Nothing found
    return false;
  }
}

/**
 * Port of CommonTuples.searchCommonTuple().
 * Checks if all position sets have cardinality > 1 and their union has
 * cardinality == degree. Returns the union set, or null.
 */
function searchCommonTuple(candidates: Set<number>[], degree: number): Set<number> | null {
  const result = new Set<number>();
  for (const candidate of candidates) {
    if (candidate.size <= 1) return null;
    for (const pos of candidate) {
      result.add(pos);
    }
  }
  if (result.size === degree) return result;
  return null;
}

/**
 * Port of Permutations(countOnes, countBits).
 * Generates all C(countBits, countOnes) combinations as arrays of 0-based
 * bit indices, in increasing binary order.
 *
 * Uses the Gosper's hack algorithm from "Hacker's Delight",
 * same as SE's Permutations.java.
 */
function permutations(countOnes: number, countBits: number): number[][] {
  const results: number[][] = [];
  if (countBits === 0) return results;

  // Port of SE's Permutations.java — Gosper's hack from "Hacker's Delight"
  let value = (1 << countOnes) - 1;
  const mask = (1 << (countBits - countOnes)) - 1;
  let isLast = false;

  // SE: while (perm.hasNext()) { int[] values = perm.nextBitNums(); ... }
  // hasNext() returns !isLast (before update), then sets isLast for next call
  for (;;) {
    const hasNext = !isLast;
    isLast = (value & -value & mask) === 0;
    if (!hasNext) break;

    // SE: nextBitNums() — convert bitmask to array of set bit indices
    const bitNums: number[] = [];
    const current = value;
    for (let src = 0; src < countBits; src++) {
      if ((current & (1 << src)) !== 0) {
        bitNums.push(src);
      }
    }
    results.push(bitNums);

    // SE: next() — advance to next permutation
    if (!isLast) {
      const smallest = value & -value;
      const ripple = value + smallest;
      const ones = ((value ^ ripple) >>> 2) / smallest;
      value = ripple | ones;
    }
  }

  return results;
}
