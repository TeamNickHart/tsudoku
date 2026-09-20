import { describe, expect, it } from 'vitest';
import { createGrid } from '@tsudoku/core';
import {
  bruteForceSolve,
  countSolutions,
  hasUniqueSolution,
  solutionString,
} from '../src/BruteForceAnalysis.js';

const EASY = '530070000600195000098000060800060003400803001700020006060000280000419005000080079';
const SOLVED = '534678912672195348198342567859761423426853791713924856961537284287419635345286179';
/** A well-known 17-clue puzzle — the minimum clue count for a unique solution. */
const MINIMAL_17 =
  '000000010400000000020000000000050407008000300001090000300400200050100000000806000';

/** Structural check: every row, column and box holds each digit exactly once. */
function isValidSolution(s: string): boolean {
  if (s.length !== 81 || s.includes('.')) return false;
  const distinct = (group: string[]): boolean => new Set(group).size === 9;

  for (let r = 0; r < 9; r++) {
    if (!distinct([...s.slice(r * 9, r * 9 + 9)])) return false;
  }
  for (let c = 0; c < 9; c++) {
    if (!distinct(Array.from({ length: 9 }, (_, r) => s[r * 9 + c]!))) return false;
  }
  for (let b = 0; b < 9; b++) {
    const boxRow = Math.floor(b / 3) * 3;
    const boxCol = (b % 3) * 3;
    const cells: string[] = [];
    for (let r = boxRow; r < boxRow + 3; r++) {
      for (let c = boxCol; c < boxCol + 3; c++) {
        cells.push(s[r * 9 + c]!);
      }
    }
    if (!distinct(cells)) return false;
  }
  return true;
}

describe('bruteForceSolve', () => {
  it('solves a puzzle to a structurally valid grid', () => {
    const solution = solutionString(createGrid(EASY));
    expect(solution).not.toBeNull();
    expect(isValidSolution(solution!)).toBe(true);
  });

  it('preserves the givens', () => {
    const solution = solutionString(createGrid(EASY))!;
    for (let i = 0; i < 81; i++) {
      const given = EASY[i]!;
      if (given !== '.' && given !== '0') {
        expect(solution[i]).toBe(given);
      }
    }
  });

  it('returns an already-solved grid unchanged', () => {
    expect(solutionString(createGrid(SOLVED))).toBe(SOLVED);
  });

  it('returns a Grid from bruteForceSolve', () => {
    const solved = bruteForceSolve(createGrid(EASY));
    expect(solved).not.toBeNull();
    expect(solved!.cells.every((c) => c.value !== null)).toBe(true);
  });

  it('solves a 17-clue minimal puzzle', () => {
    const solution = solutionString(createGrid(MINIMAL_17));
    expect(solution).not.toBeNull();
    expect(isValidSolution(solution!)).toBe(true);
  });

  it('returns null when the puzzle has no solution', () => {
    // Two 5s in the first row is an immediate contradiction.
    const contradiction = `55${'.'.repeat(79)}`;
    expect(solutionString(createGrid(contradiction))).toBeNull();
  });
});

describe('countSolutions', () => {
  it('reports exactly one solution for a valid puzzle', () => {
    expect(countSolutions(createGrid(EASY))).toBe(1);
    expect(countSolutions(createGrid(MINIMAL_17))).toBe(1);
    expect(countSolutions(createGrid(SOLVED))).toBe(1);
  });

  it('reports zero for a contradictory grid', () => {
    const contradiction = `55${'.'.repeat(79)}`;
    expect(countSolutions(createGrid(contradiction))).toBe(0);
  });

  it('reports more than one for an under-constrained grid', () => {
    // An empty grid has astronomically many solutions; 2 means "more than one".
    expect(countSolutions(createGrid('.'.repeat(81)))).toBe(2);
  });

  it('detects ambiguity when too many cells are blanked', () => {
    // Blanking the first 20 cells of a solved grid leaves 4 solutions.
    const stripped = SOLVED.split('')
      .map((c, i) => (i < 20 ? '.' : c))
      .join('');
    expect(countSolutions(createGrid(stripped))).toBe(2);
  });
});

describe('hasUniqueSolution', () => {
  it('accepts valid puzzles and rejects ambiguous ones', () => {
    expect(hasUniqueSolution(createGrid(EASY))).toBe(true);
    expect(hasUniqueSolution(createGrid(MINIMAL_17))).toBe(true);
    expect(hasUniqueSolution(createGrid('.'.repeat(81)))).toBe(false);
  });
});
