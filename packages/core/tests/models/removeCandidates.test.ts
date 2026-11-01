import { describe, expect, it } from 'vitest';
import { createGrid, removeCandidates } from '../../src/models/GridImpl.js';
import { hasCandidate } from '../../src/candidates/bitmask.js';

const EASY = '530070000600195000098000060800060003400803001700020006060000280000419005000080079';

describe('removeCandidates', () => {
  it('removes exactly the named candidates', () => {
    const grid = createGrid(EASY);
    // R1C3 starts with 1, 2 and 4.
    expect(hasCandidate(grid.getCellByIndex(2).candidates, 4)).toBe(true);
    const next = removeCandidates(grid, [{ cell: 2, digit: 4 }]);
    expect(hasCandidate(next.getCellByIndex(2).candidates, 4)).toBe(false);
    expect(hasCandidate(next.getCellByIndex(2).candidates, 1)).toBe(true);
    expect(next.getCellByIndex(3).candidates).toBe(grid.getCellByIndex(3).candidates);
  });

  it('leaves the original grid untouched', () => {
    const grid = createGrid(EASY);
    const before = grid.getCellByIndex(2).candidates;
    removeCandidates(grid, [{ cell: 2, digit: 4 }]);
    expect(grid.getCellByIndex(2).candidates).toBe(before);
  });

  it('ignores solved cells and candidates already gone, returning the same grid', () => {
    const grid = createGrid(EASY);
    // Cell 0 is a given 5; 5 is not a candidate in R1C3.
    expect(
      removeCandidates(grid, [
        { cell: 0, digit: 5 },
        { cell: 2, digit: 5 },
      ]),
    ).toBe(grid);
  });
});
