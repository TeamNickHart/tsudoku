import { CELL_COUNT, SIZE, boxOf, colOf, createGrid, rowOf } from '@tsudoku/core';
import { countSolutions, solveRandom } from '@tsudoku/solver';
import type { Rng } from '@tsudoku/solver';

/**
 * Construct puzzles in the *easy* band, which `generate()` cannot reach.
 *
 * This is not an optimisation of the normal generator — it is a different
 * algorithm for a band the normal one structurally excludes.
 *
 * `generate()` carves a **minimal** puzzle: one where no further clue can be
 * removed without admitting a second solution. Minimal is the *hardest* form of
 * a given solution grid, so its output clusters well above the easiest ratings.
 * Measured over 2500 generated puzzles, SE 1.0 appeared **zero** times, and a
 * 24,000-puzzle harvest found none either. Adding clues back to a minimal
 * puzzle drives the rating down to 1.2 and then plateaus there indefinitely.
 *
 * SE rates a puzzle by its *hardest* step. So a 1.0 puzzle is one where every
 * step is a "full house" — a region with exactly one empty cell, which SE's
 * HiddenSingle reports as `isAlone` at difficulty 1.0. That is a property you
 * can build directly rather than search for:
 *
 *   place the holes so that each one is the only empty cell in its row, its
 *   column and its box
 *
 * Such a puzzle is solved entirely by full houses, so 1.0 is both the hardest
 * and the easiest step. Verified against the real SE CLI: 8 of 8 constructed
 * this way rated `ED=1.0/1.0/1.0`.
 *
 * The constraint "no two holes share a row, column or box" is exactly a
 * non-attacking-rooks placement that also respects boxes, so at most one hole
 * per band and stack — capping `holeCount` at 9 (SIZE).
 *
 * @see Generator.ts for the normal (minimal, harder) path.
 */

/** A constructed puzzle and the solution it was carved from. */
export interface ConstructedPuzzle {
  /** 81 chars, digits and '.' for blanks. */
  readonly puzzle: string;
  /** 81 chars, all digits. */
  readonly solution: string;
  /** How many cells hold a given. */
  readonly clueCount: number;
}

export interface ConstructEasyOptions {
  /**
   * How many cells to empty, 1–9. Each hole is alone in its row, column and
   * box, so 9 is the maximum — a tenth would have to share a line with an
   * existing hole and would stop being a full house.
   *
   * Defaults to 9, the hardest puzzle this shape allows (still rated 1.0).
   */
  readonly holeCount?: number;
  /** Randomness source. Defaults to `Math.random`. */
  readonly rng?: Rng;
}

function toStringGrid(values: readonly (number | null)[]): string {
  let out = '';
  for (let i = 0; i < CELL_COUNT; i++) {
    const value = values[i];
    out += value === null || value === undefined ? '.' : String(value);
  }
  return out;
}

/** Fisher-Yates, so every ordering is equally likely. */
function shuffle(items: number[], rng: Rng): number[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    // Safe: i and j are both in range
    const temp = items[i]!;
    items[i] = items[j]!;
    items[j] = temp;
  }
  return items;
}

/**
 * Construct a puzzle solvable entirely by full houses, which SE rates 1.0.
 *
 * @throws {Error} if `holeCount` is outside 1–9, or if a random solution cannot
 *   be found — the latter would indicate a solver bug, since an empty grid
 *   always has one.
 */
export function constructEasy(options: ConstructEasyOptions = {}): ConstructedPuzzle {
  const rng = options.rng ?? Math.random;
  const holeCount = options.holeCount ?? SIZE;

  if (!Number.isInteger(holeCount) || holeCount < 1 || holeCount > SIZE) {
    throw new Error(
      `holeCount must be an integer in 1..${SIZE} (each hole is alone in its ` +
        `row, column and box, so ${SIZE} is the maximum); got ${holeCount}`,
    );
  }

  // A random solution of an empty grid is a random completed board — the same
  // starting point Generator.generate uses.
  const solved = solveRandom(createGrid('.'.repeat(CELL_COUNT)), rng);
  if (solved === null) {
    throw new Error('Could not solve an empty grid — this indicates a solver bug');
  }
  const solution = toStringGrid(solved.cells.map((c) => c.value));

  const cells = solution.split('');

  // Walk cells in random order, taking any whose row, column and box are all
  // still untouched. That greedily builds a maximal non-attacking set; with 81
  // candidates and at most 9 holes it reaches the requested count comfortably.
  const usedRows = new Set<number>();
  const usedCols = new Set<number>();
  const usedBoxes = new Set<number>();
  let holes = 0;

  for (const index of shuffle([...Array(CELL_COUNT).keys()], rng)) {
    if (holes >= holeCount) break;

    const row = rowOf(index);
    const col = colOf(index);
    const box = boxOf(row, col);
    if (usedRows.has(row) || usedCols.has(col) || usedBoxes.has(box)) continue;

    usedRows.add(row);
    usedCols.add(col);
    usedBoxes.add(box);
    cells[index] = '.';
    holes += 1;
  }

  // Should be unreachable: a 9x9 grid always admits 9 mutually non-attacking
  // cells (the main diagonal is one such placement). Checked rather than
  // assumed, because silently returning a puzzle with fewer holes than asked
  // for would be a confusing way to fail.
  if (holes < holeCount) {
    throw new Error(`could only place ${holes} of ${holeCount} holes — this indicates a bug`);
  }

  const puzzle = cells.join('');

  // Uniqueness is guaranteed by construction here — every hole is the sole
  // empty cell of its row, so its digit is forced — but it is cheap to assert
  // and this is the property the whole corpus depends on.
  if (countSolutions(createGrid(puzzle)) !== 1) {
    throw new Error('constructed puzzle does not have a unique solution — this indicates a bug');
  }

  return { puzzle, solution, clueCount: CELL_COUNT - holeCount };
}

/** Construct `count` easy puzzles. */
export function constructEasyMany(
  count: number,
  options: ConstructEasyOptions = {},
): ConstructedPuzzle[] {
  const out: ConstructedPuzzle[] = [];
  for (let i = 0; i < count; i++) {
    out.push(constructEasy(options));
  }
  return out;
}
