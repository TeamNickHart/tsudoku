import { describe, expect, it } from 'vitest';
import { createGrid, applyHint } from '../../src/models/GridImpl.js';
import { candidateList, hasCandidate } from '../../src/candidates/bitmask.js';
import type { EliminationHint, DirectHint } from '../../src/types/Hint.js';

const EASY = '530070000600195000098000060800060003400803001700020006060000280000419005000080079';

function elimination(eliminations: { cell: number; digit: number }[]): EliminationHint {
  return {
    type: 'elimination',
    technique: 'DirectPointing',
    difficulty: 2.6,
    eliminations,
    explanation: 'test',
    involvedCells: [],
    involvedCandidates: new Map(),
  };
}

function placement(cell: number, digit: number): DirectHint {
  return {
    type: 'direct',
    technique: 'NakedSingle',
    difficulty: 2.3,
    cell,
    digit,
    explanation: 'test',
    involvedCells: [],
    involvedCandidates: new Map(),
  };
}

describe('applyHint — placements', () => {
  it('places the digit', () => {
    const grid = applyHint(createGrid(EASY), placement(2, 4));
    expect(grid.getCellByIndex(2).value).toBe(4);
  });

  it('cancels the placed digit from peers', () => {
    const grid = applyHint(createGrid(EASY), placement(2, 4));
    // Cell 2 is r1c3; cell 3 is r1c4, a row peer.
    expect(hasCandidate(grid.getCellByIndex(3).candidates, 4)).toBe(false);
  });

  it('clears the placed cell candidates', () => {
    const grid = applyHint(createGrid(EASY), placement(2, 4));
    expect(grid.getCellByIndex(2).candidates).toBe(0);
  });

  it('leaves non-peers alone', () => {
    const base = createGrid(EASY);
    const before = base.getCellByIndex(80).candidates;
    const grid = applyHint(base, placement(2, 4));
    expect(grid.getCellByIndex(80).candidates).toBe(before);
  });
});

describe('applyHint — eliminations', () => {
  it('removes the candidate and keeps it removed', () => {
    // This is the regression the old implementation could not pass: it
    // recomputed candidates from values, so a logical elimination was undone
    // immediately by arithmetic.
    const base = createGrid(EASY);
    const digits = candidateList(base.getCellByIndex(2).candidates);
    expect(digits.length).toBeGreaterThan(1);

    const grid = applyHint(base, elimination([{ cell: 2, digit: digits[0]! }]));
    expect(hasCandidate(grid.getCellByIndex(2).candidates, digits[0]!)).toBe(false);
  });

  it('leaves the other candidates in that cell intact', () => {
    const base = createGrid(EASY);
    const digits = candidateList(base.getCellByIndex(2).candidates);
    const grid = applyHint(base, elimination([{ cell: 2, digit: digits[0]! }]));
    expect(candidateList(grid.getCellByIndex(2).candidates)).toEqual(digits.slice(1));
  });

  it('does not place any value', () => {
    const base = createGrid(EASY);
    const digits = candidateList(base.getCellByIndex(2).candidates);
    const grid = applyHint(base, elimination([{ cell: 2, digit: digits[0]! }]));
    expect(grid.getCellByIndex(2).value).toBeNull();
  });

  it('applies several eliminations at once', () => {
    const base = createGrid(EASY);
    const a = candidateList(base.getCellByIndex(2).candidates)[0]!;
    const b = candidateList(base.getCellByIndex(3).candidates)[0]!;
    const grid = applyHint(
      base,
      elimination([
        { cell: 2, digit: a },
        { cell: 3, digit: b },
      ]),
    );
    expect(hasCandidate(grid.getCellByIndex(2).candidates, a)).toBe(false);
    expect(hasCandidate(grid.getCellByIndex(3).candidates, b)).toBe(false);
  });

  it('survives a subsequent placement elsewhere', () => {
    // An elimination must not be undone by later work on the grid.
    const base = createGrid(EASY);
    const digit = candidateList(base.getCellByIndex(2).candidates)[0]!;
    let grid = applyHint(base, elimination([{ cell: 2, digit }]));
    grid = applyHint(grid, placement(80, 4));
    expect(hasCandidate(grid.getCellByIndex(2).candidates, digit)).toBe(false);
  });

  it('ignores an elimination on a solved cell', () => {
    const base = createGrid(EASY);
    const grid = applyHint(base, elimination([{ cell: 0, digit: 5 }]));
    expect(grid.getCellByIndex(0).value).toBe(5);
  });
});
