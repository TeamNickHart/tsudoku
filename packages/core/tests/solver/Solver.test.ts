import { describe, it, expect } from 'vitest';
import { Solver } from '../../src/solver/Solver.js';
import { applyHint } from '../../src/models/GridImpl.js';
import { createGrid, EASY_PUZZLE, SOLVED_PUZZLE } from '../helpers.js';

describe('Solver', () => {
  const solver = new Solver();

  it('returns the easiest hint available', () => {
    const grid = createGrid(EASY_PUZZLE);
    const hint = solver.getNextHint(grid);
    expect(hint).not.toBeNull();
    expect(hint!.type).toBe('direct'); // eslint-disable-line @typescript-eslint/no-non-null-assertion
  });

  it('returns null on a solved grid', () => {
    const grid = createGrid(SOLVED_PUZZLE);
    const hint = solver.getNextHint(grid);
    expect(hint).toBeNull();
  });

  it('getAllHints returns multiple hints', () => {
    const grid = createGrid(EASY_PUZZLE);
    const hints = solver.getAllHints(grid);
    expect(hints.length).toBeGreaterThan(0);
  });

  it('can solve an easy puzzle step by step', () => {
    let grid = createGrid(EASY_PUZZLE);
    let steps = 0;
    const maxSteps = 200;

    while (steps < maxSteps) {
      const hint = solver.getNextHint(grid);
      if (hint === null) break;
      grid = applyHint(grid, hint);
      steps++;
    }

    // All cells should be solved
    const unsolved = grid.cells.filter((c) => c.value === null);
    expect(unsolved).toHaveLength(0);
    expect(steps).toBeGreaterThan(0);
    expect(steps).toBeLessThan(maxSteps);
  });
});
