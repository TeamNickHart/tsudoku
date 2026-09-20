import { SIZE, addCandidate, hasCandidate } from '@tsudoku/core';
import type { Grid } from '@tsudoku/core';

/**
 * Check that no value appears more than once in the same row, column or box —
 * line-by-line port of SE's `diuf/sudoku/solver/checks/NoDoubles.java`.
 *
 * SE's `BruteForceAnalysis` docstring warns that its analysis "may be extremely
 * slow" on a grid containing a doubled value, because a contradiction that is
 * obvious structurally is not obvious to the search. So this runs first.
 *
 * SE ref: NoDoubles.isValid
 */
export function hasNoDoubles(grid: Grid): boolean {
  for (const region of grid.regions) {
    let values = 0;
    for (const cell of region.cells) {
      const value = cell.value;
      if (value !== null) {
        if (hasCandidate(values, value)) {
          return false; // value appears twice in this region
        }
        values = addCandidate(values, value);
      }
    }
  }
  return true;
}

/** The region and digit of the first duplicate found, or null when valid. */
export function findDuplicate(grid: Grid): { region: string; digit: number } | null {
  for (const region of grid.regions) {
    let values = 0;
    for (const cell of region.cells) {
      const value = cell.value;
      if (value !== null) {
        if (hasCandidate(values, value)) {
          return { region: `${region.type} ${region.index + 1}`, digit: value };
        }
        values = addCandidate(values, value);
      }
    }
  }
  return null;
}

/** Re-exported for callers that want the digit range without importing core. */
export const DIGIT_COUNT = SIZE;
