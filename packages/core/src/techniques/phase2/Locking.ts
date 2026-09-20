import type { Grid, Region, RegionType } from '../../types/Grid.js';
import type { HintAccumulator } from '../../types/Hint.js';
import type { HintProducer } from '../../types/HintProducer.js';
import type { Technique } from '../../types/Technique.js';
import { TECHNIQUE_DIFFICULTY } from '../../types/Technique.js';
import { SIZE } from '../../models/board.js';
import { candidateMask } from '../../candidates/bitmask.js';

function cellName(row: number, col: number): string {
  return `R${row + 1}C${col + 1}`;
}

function regionName(region: Region): string {
  if (region.type === 'row') return `row ${region.index + 1}`;
  if (region.type === 'col') return `column ${region.index + 1}`;
  return `box ${region.index + 1}`;
}

/**
 * Pointing and Claiming — line-by-line port of SE's `Locking.java`
 * (`isDirectMode = false`).
 *
 * Both are the same idea seen from two directions: if every place a digit can
 * go in region 1 also lies inside region 2, then that digit cannot appear
 * anywhere else in region 2.
 *
 * - **Pointing** (2.6): region1 is a box, region2 is a line. The digit is
 *   confined to one line within the box, so it is eliminated from the rest of
 *   that line.
 * - **Claiming** (2.8): region1 is a line, region2 is a box. The digit is
 *   confined to one box within the line, so it is eliminated from the rest of
 *   that box.
 *
 * SE runs four region-type pairs in this order:
 *
 *     Block x Column,  Block x Row,  Column x Block,  Row x Block
 *
 * The first two are Pointing, the last two Claiming. SE's remaining pairs
 * (Diagonal, Windoku, DisjointGroup, Custom) are variant boards TSudoku does
 * not model, and are deliberately omitted.
 *
 * SE ref: diuf/sudoku/solver/rules/Locking.java
 */
export class Locking implements HintProducer {
  readonly technique: Technique;
  readonly difficulty: number;
  private readonly pointing: boolean;

  /**
   * @param pointing true for Pointing (box → line), false for Claiming
   *                 (line → box).
   */
  constructor(pointing: boolean) {
    this.pointing = pointing;
    this.technique = pointing ? 'Pointing' : 'Claiming';
    this.difficulty = TECHNIQUE_DIFFICULTY[this.technique];
  }

  getHints(grid: Grid, accumulator: HintAccumulator): void {
    // SE: getHints(grid, Block, Column); getHints(grid, Block, Row);
    //     getHints(grid, Column, Block); getHints(grid, Row, Block);
    //
    // Pointing is the two Block-first pairs; Claiming the two Block-second.
    if (this.pointing) {
      if (this.scanPair(grid, 'box', 'col', accumulator)) return;
      this.scanPair(grid, 'box', 'row', accumulator);
    } else {
      if (this.scanPair(grid, 'col', 'box', accumulator)) return;
      this.scanPair(grid, 'row', 'box', accumulator);
    }
  }

  /**
   * Port of `Locking.getHints(grid, regionType1, regionType2, accu)`.
   *
   * @returns true if the accumulator signalled 'stop'
   */
  private scanPair(
    grid: Grid,
    type1: RegionType,
    type2: RegionType,
    accumulator: HintAccumulator,
  ): boolean {
    for (let i1 = 0; i1 < SIZE; i1++) {
      for (let i2 = 0; i2 < SIZE; i2++) {
        const region1 = this.regionOf(grid, type1, i1);
        const region2 = this.regionOf(grid, type2, i2);

        // SE: if (region1.crosses(region2))
        if (!crosses(region1, region2)) continue;

        const region2Cells = new Set(region2.cells.map((c) => c.index));

        // SE: for (int value = 1; value <= 9; value++)
        for (let value = 1; value <= SIZE; value++) {
          const positions = region1.getCandidateCells(value);

          // SE: if cardinality == 1 this is a Hidden Single, not a Locking.
          if (positions.length <= 1) continue;

          // SE: test if all potential positions are also in part2
          let isInCommonSet = true;
          for (const cell of positions) {
            if (!region2Cells.has(cell.index)) {
              isInCommonSet = false;
            }
          }
          if (!isInCommonSet) continue;

          if (this.emit(region1, region2, value, accumulator)) return true;
        }
      }
    }
    return false;
  }

  private regionOf(grid: Grid, type: RegionType, index: number): Region {
    if (type === 'row') return grid.getRow(index);
    if (type === 'col') return grid.getCol(index);
    return grid.getBox(index);
  }

  /**
   * Port of `createLockingHint`, plus SE's `isWorth()` check — a hint with no
   * eliminations is not offered.
   *
   * @returns true if the accumulator signalled 'stop'
   */
  private emit(
    region1: Region,
    region2: Region,
    value: number,
    accumulator: HintAccumulator,
  ): boolean {
    const region1Cells = new Set(region1.cells.map((c) => c.index));

    // SE: removable potentials are cells of p2 outside p1 that hold the value.
    const eliminations: { cell: number; digit: number }[] = [];
    // SE: highlighted cells are cells of p2 inside p1 that hold the value.
    const highlighted: number[] = [];

    for (const cell of region2.cells) {
      if (cell.value !== null) continue;
      const hasValue = (cell.candidates & candidateMask(value)) !== 0;
      if (!hasValue) continue;

      if (region1Cells.has(cell.index)) {
        highlighted.push(cell.index);
      } else {
        eliminations.push({ cell: cell.index, digit: value });
      }
    }

    // SE: if (hint.isWorth())
    if (eliminations.length === 0) return false;

    const involvedCandidates = new Map<number, readonly number[]>();
    for (const cell of region1.getCandidateCells(value)) {
      involvedCandidates.set(cell.index, [value]);
    }

    const targets = eliminations
      .map((e) => {
        const cell = region2.cells.find((c) => c.index === e.cell)!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
        return cellName(cell.row, cell.col);
      })
      .join(', ');

    const label = this.pointing ? 'Pointing' : 'Claiming';
    const result = accumulator({
      type: 'elimination',
      technique: this.technique,
      difficulty: this.difficulty,
      eliminations,
      explanation:
        `${label}: ${value} in ${regionName(region1)} is confined to ` +
        `${regionName(region2)}, so ${value} can be removed from ${targets}`,
      involvedCells: highlighted,
      involvedCandidates,
    });

    return result === 'stop';
  }
}

/** Whether two regions share at least one cell. SE ref: `Region.crosses`. */
function crosses(a: Region, b: Region): boolean {
  const aCells = new Set(a.cells.map((c) => c.index));
  return b.cells.some((c) => aCells.has(c.index));
}
