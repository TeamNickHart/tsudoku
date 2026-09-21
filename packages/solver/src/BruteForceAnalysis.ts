import {
  CELL_COUNT,
  SIZE,
  HiddenSingle,
  NakedSingle,
  applyHint,
  createGrid,
  hasCandidate,
} from '@tsudoku/core';
import type { Grid, Hint } from '@tsudoku/core';
import { hasNoDoubles } from './NoDoubles.js';

/**
 * Brute-force solution analysis — line-by-line port of SE's
 * `diuf/sudoku/solver/checks/BruteForceAnalysis.java`.
 *
 * The central trick, straight from SE: solve the grid twice, once trying
 * candidate digits in ascending order and once descending. Both directions
 * reach the same solution **if and only if** the puzzle has exactly one
 * solution. Two different solutions prove multiplicity without having to
 * enumerate the whole search space.
 *
 * SE ref: BruteForceAnalysis.java
 */

/** Number of solutions a grid has, as far as this analysis can tell. */
export type SolutionCount = 0 | 1 | 2;

/**
 * A source of randomness, so callers can seed it and get reproducible output.
 *
 * Returns a float in [0, 1), matching `Math.random`.
 */
export type Rng = () => number;

/**
 * SE's `isSolved` — every cell has a value.
 *
 * SE ref: BruteForceAnalysis.isSolved
 */
function isSolved(grid: Grid): boolean {
  for (let i = 0; i < CELL_COUNT; i++) {
    // Safe: i is a valid cell index
    if (grid.cells[i]!.value === null) {
      return false;
    }
  }
  return true;
}

/**
 * SE's `isFillable` — for every region and every digit, the digit is either
 * already present or has somewhere left to go.
 *
 * SE notes this is unnecessary in theory but keeps pathological grids from
 * requiring a huge number of iterations.
 *
 * SE ref: BruteForceAnalysis.isFillable
 */
function isFillable(grid: Grid): boolean {
  for (const region of grid.regions) {
    for (let value = 1; value <= SIZE; value++) {
      const contains = region.cells.some((c) => c.value === value);
      if (!contains && region.getCandidateCells(value).length === 0) {
        return false; // No room for the value in the region
      }
    }
  }
  return true;
}

/**
 * Apply naked and hidden singles until neither fires.
 *
 * SE ref: BruteForceAnalysis.analyse step (1). SE calls nakedSingle first, then
 * hiddenSingle, into a SingleHintAccumulator that keeps the first hint offered.
 */
function applySingles(grid: Grid): Grid {
  const nakedSingle = new NakedSingle();
  const hiddenSingle = new HiddenSingle();

  let current = grid;
  for (;;) {
    let hint: Hint | null = null;

    nakedSingle.getHints(current, (h) => {
      hint = h;
      return 'stop';
    });
    if (hint === null) {
      hiddenSingle.getHints(current, (h) => {
        hint = h;
        return 'stop';
      });
    }

    if (hint === null) {
      return current;
    }
    current = applyHint(current, hint);
  }
}

/**
 * Place a digit directly, bypassing the hint machinery.
 *
 * SE mutates the cell via `setValueAndCancel`; the immutable equivalent here is
 * to rebuild the puzzle string with the digit placed and re-derive the grid,
 * which recomputes candidates the same way SE's cancel does.
 */
function placeValue(grid: Grid, cellIndex: number, digit: number): Grid {
  const chars: string[] = [];
  for (let i = 0; i < CELL_COUNT; i++) {
    // Safe: i is a valid cell index
    const cell = grid.cells[i]!;
    if (i === cellIndex) {
      chars.push(String(digit));
    } else {
      chars.push(cell.value === null ? '.' : String(cell.value));
    }
  }
  return createGrid(chars.join(''));
}

/**
 * SE's recursive `analyse`. Returns the solved grid, or null if this branch
 * has no solution.
 *
 * `isReverse` flips the order in which candidate digits are tried, which is
 * what makes the two-pass uniqueness check work.
 *
 * SE ref: BruteForceAnalysis.analyse(Grid, boolean, Random, ...)
 */
function analyse(grid: Grid, isReverse: boolean, rnd?: Rng): Grid | null {
  // Quick check that every digit still has room in every region.
  if (!isFillable(grid)) {
    return null;
  }

  // (1) Fill all naked singles and hidden singles.
  const settled = applySingles(grid);
  if (isSolved(settled)) {
    return settled;
  }

  // (2) Find the unsolved cell with the fewest candidates. SE reports this
  // empirically gives the best speed.
  let leastCell: number | null = null;
  let leastCardinality = SIZE + 1;
  for (let i = 0; i < CELL_COUNT; i++) {
    // Safe: i is a valid cell index
    const cell = settled.cells[i]!;
    if (cell.value === null) {
      const cardinality = cell.candidateCount;
      if (cardinality < leastCardinality) {
        leastCardinality = cardinality;
        leastCell = i;
      }
    }
  }

  // No unsolved cell but not solved — dead branch.
  if (leastCell === null) {
    return null;
  }

  // (3) Try each possible value for that cell, in forward or reverse order.
  const startValue = isReverse ? SIZE - 1 : 0;
  const stopValue = isReverse ? -1 : SIZE;
  const delta = isReverse ? -1 : 1;

  // SE: `firstValue = rnd.nextInt(9)` — rotating the digit order is what makes
  // solving an *empty* grid produce a random completed board, which is how the
  // generator gets a solution to carve a puzzle from. Without it the search is
  // deterministic and always returns the same grid.
  const firstValue = rnd === undefined ? 0 : Math.floor(rnd() * SIZE);

  // Safe: leastCell was assigned above
  const candidates = settled.cells[leastCell]!.candidates;

  for (let value0 = startValue; value0 !== stopValue; value0 += delta) {
    const value = rnd === undefined ? value0 + 1 : ((value0 + firstValue) % SIZE) + 1;
    if (hasCandidate(candidates, value)) {
      const branch = placeValue(settled, leastCell, value);
      const result = analyse(branch, isReverse, rnd);
      if (result !== null) {
        return result;
      }
      // Otherwise continue with the next value — `settled` is untouched,
      // since every step returns a new Grid rather than mutating.
    }
  }

  // Failed
  return null;
}

/** The 81-character string form of a grid, for comparing solutions. */
function toPuzzleString(grid: Grid): string {
  const chars: string[] = [];
  for (let i = 0; i < CELL_COUNT; i++) {
    // Safe: i is a valid cell index
    const value = grid.cells[i]!.value;
    chars.push(value === null ? '.' : String(value));
  }
  return chars.join('');
}

/**
 * Solve a grid with a randomised digit order.
 *
 * Port of SE's `BruteForceAnalysis.solveRandom`. Solving an *empty* grid this
 * way yields a random completed board — the starting point for generation.
 *
 * SE ref: BruteForceAnalysis.solveRandom
 */
export function solveRandom(grid: Grid, rnd: Rng = Math.random): Grid | null {
  if (!hasNoDoubles(grid)) {
    return null;
  }
  return analyse(grid, false, rnd);
}

/**
 * Solve a grid by brute force, ascending digit order.
 *
 * Returns the solved grid, or null when the puzzle has no solution. When the
 * puzzle has multiple solutions this returns one of them — use
 * {@link countSolutions} or {@link hasUniqueSolution} to find out which.
 */
export function bruteForceSolve(grid: Grid): Grid | null {
  // SE's BruteForceAnalysis docstring: "you should first check that no value
  // appear twice in the same row, column or block. Else, this method may be
  // extremely slow." A doubled value is an immediate contradiction that the
  // search would otherwise take seconds to rule out.
  if (!hasNoDoubles(grid)) {
    return null;
  }
  return analyse(grid, false);
}

/**
 * The solution as an 81-character string, or null if there is none.
 *
 * This is the form to store in game state: a puzzle's solution is invariant,
 * so it is computed once and kept as a string rather than as a Grid.
 */
export function solutionString(grid: Grid): string | null {
  const solved = bruteForceSolve(grid);
  return solved === null ? null : toPuzzleString(solved);
}

/**
 * How many solutions the grid has: 0, 1, or 2 meaning "more than one".
 *
 * SE ref: BruteForceAnalysis.getCountSolutions
 */
export function countSolutions(grid: Grid): SolutionCount {
  // See the note in bruteForceSolve — cheap structural check first.
  if (!hasNoDoubles(grid)) {
    return 0;
  }
  const forward = analyse(grid, false);
  if (forward === null) {
    return 0; // no solution
  }
  const reverse = analyse(grid, true);
  if (reverse === null) {
    // Forward found a solution but reverse did not — should not happen for a
    // consistent grid, but treat it as unsolvable rather than claiming unique.
    return 0;
  }
  return toPuzzleString(forward) === toPuzzleString(reverse) ? 1 : 2;
}

/** Whether the grid is a valid puzzle: exactly one solution. */
export function hasUniqueSolution(grid: Grid): boolean {
  return countSolutions(grid) === 1;
}
