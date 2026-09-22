import { describe, expect, it } from 'vitest';
import { CELL_COUNT, SIZE, applyHint, boxOf, colOf, createGrid, rowOf } from '@tsudoku/core';
import { Solver } from '@tsudoku/core';
import { countSolutions } from '@tsudoku/solver';
import { constructEasy, constructEasyMany } from '../src/ConstructEasy.js';

/** Deterministic RNG (mulberry32), so a failure is reproducible. */
function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The hardest technique difficulty the solver needs, or null if it cannot finish. */
function rate(puzzle: string): number | null {
  const solver = new Solver();
  let grid = createGrid(puzzle);
  let hardest = 0;
  for (let step = 0; step < 300; step++) {
    const hint = solver.getNextHint(grid);
    if (hint === null) break;
    if (hint.difficulty > hardest) hardest = hint.difficulty;
    grid = applyHint(grid, hint);
  }
  return grid.cells.every((c) => c.value !== null) ? Math.round(hardest * 10) / 10 : null;
}

describe('constructEasy', () => {
  it('produces a puzzle rated 1.0 — the property the whole module exists for', () => {
    const rng = seeded(1);
    for (let i = 0; i < 20; i++) {
      expect(rate(constructEasy({ rng }).puzzle)).toBe(1.0);
    }
  });

  it('rates 1.0 at every supported hole count', () => {
    for (let holeCount = 1; holeCount <= SIZE; holeCount++) {
      const rng = seeded(100 + holeCount);
      expect(rate(constructEasy({ holeCount, rng }).puzzle)).toBe(1.0);
    }
  });

  it('places every hole alone in its row, column and box', () => {
    const rng = seeded(2);
    for (let i = 0; i < 20; i++) {
      const { puzzle } = constructEasy({ rng });
      const rows = new Set<number>();
      const cols = new Set<number>();
      const boxes = new Set<number>();

      for (let index = 0; index < CELL_COUNT; index++) {
        if (puzzle[index] !== '.') continue;
        const row = rowOf(index);
        const col = colOf(index);
        const box = boxOf(row, col);
        // This is the invariant that makes every step a full house.
        expect(rows.has(row)).toBe(false);
        expect(cols.has(col)).toBe(false);
        expect(boxes.has(box)).toBe(false);
        rows.add(row);
        cols.add(col);
        boxes.add(box);
      }
    }
  });

  it('has exactly one solution', () => {
    const rng = seeded(3);
    for (let i = 0; i < 10; i++) {
      expect(countSolutions(createGrid(constructEasy({ rng }).puzzle))).toBe(1);
    }
  });

  it('reports a clue count matching the blanks it left', () => {
    const rng = seeded(4);
    for (let holeCount = 1; holeCount <= SIZE; holeCount++) {
      const { puzzle, clueCount } = constructEasy({ holeCount, rng });
      expect(clueCount).toBe(CELL_COUNT - holeCount);
      expect(puzzle.split('').filter((c) => c === '.').length).toBe(holeCount);
    }
  });

  it('returns a solution consistent with the puzzle', () => {
    const rng = seeded(5);
    const { puzzle, solution } = constructEasy({ rng });
    expect(solution).toHaveLength(CELL_COUNT);
    expect(solution).not.toContain('.');
    for (let i = 0; i < CELL_COUNT; i++) {
      if (puzzle[i] !== '.') expect(puzzle[i]).toBe(solution[i]);
    }
  });

  it('is reproducible for a given seed, and varies across seeds', () => {
    expect(constructEasy({ rng: seeded(7) }).puzzle).toBe(constructEasy({ rng: seeded(7) }).puzzle);
    expect(constructEasy({ rng: seeded(7) }).puzzle).not.toBe(
      constructEasy({ rng: seeded(8) }).puzzle,
    );
  });

  it('rejects a hole count outside 1..9', () => {
    for (const holeCount of [0, -1, 10, 81, 1.5, NaN]) {
      expect(() => constructEasy({ holeCount })).toThrow(/holeCount must be an integer/);
    }
  });

  it('constructEasyMany returns the requested count', () => {
    const rng = seeded(9);
    const puzzles = constructEasyMany(5, { rng });
    expect(puzzles).toHaveLength(5);
    expect(new Set(puzzles.map((p) => p.puzzle)).size).toBe(5);
  });
});
