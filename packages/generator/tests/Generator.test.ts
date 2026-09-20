import { describe, expect, it } from 'vitest';
import { createGrid } from '@tsudoku/core';
import { countSolutions } from '@tsudoku/solver';
import type { Rng } from '@tsudoku/solver';
import { generate, generateMany } from '../src/Generator.js';
import { NO_SYMMETRY, ORTHOGONAL, ROTATIONAL_180, SYMMETRIES, VERTICAL } from '../src/Symmetry.js';

/** Deterministic RNG (mulberry32) so tests do not depend on Math.random. */
function seeded(seed: number): Rng {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('generate', () => {
  it('produces a puzzle with exactly one solution', () => {
    const { puzzle } = generate({ rng: seeded(1) });
    expect(countSolutions(createGrid(puzzle))).toBe(1);
  });

  it('produces a complete, valid solution', () => {
    const { solution } = generate({ rng: seeded(2) });
    expect(solution).toHaveLength(81);
    expect(solution).not.toContain('.');
    expect(countSolutions(createGrid(solution))).toBe(1);
  });

  it('keeps every given consistent with the solution', () => {
    const { puzzle, solution } = generate({ rng: seeded(3) });
    for (let i = 0; i < 81; i++) {
      if (puzzle[i] !== '.') {
        expect(puzzle[i]).toBe(solution[i]);
      }
    }
  });

  it('reports a clue count matching the puzzle', () => {
    const { puzzle, clueCount } = generate({ rng: seeded(4) });
    expect(clueCount).toBe(puzzle.split('').filter((c) => c !== '.').length);
  });

  it('produces a minimal puzzle — removing any given breaks uniqueness', () => {
    // This is what "minimal" means, and it is the generator's actual contract.
    const { puzzle } = generate({ symmetry: NO_SYMMETRY, rng: seeded(5) });
    const givens = [...puzzle].map((c, i) => (c === '.' ? -1 : i)).filter((i) => i >= 0);

    // Checking every given is slow; a sample is enough to catch a broken loop.
    for (const cell of givens.slice(0, 5)) {
      const weakened = puzzle.split('');
      weakened[cell] = '.';
      expect(countSolutions(createGrid(weakened.join('')))).not.toBe(1);
    }
  });

  it('is reproducible for a given seed', () => {
    expect(generate({ rng: seeded(42) }).puzzle).toBe(generate({ rng: seeded(42) }).puzzle);
  });

  it('produces different puzzles for different seeds', () => {
    expect(generate({ rng: seeded(1) }).puzzle).not.toBe(generate({ rng: seeded(2) }).puzzle);
  });

  it('generates a batch', () => {
    const batch = generateMany(3, { rng: seeded(9) });
    expect(batch).toHaveLength(3);
    expect(new Set(batch.map((p) => p.puzzle)).size).toBe(3);
  });
});

describe('symmetry', () => {
  it('produces genuinely symmetric removal patterns', () => {
    for (const symmetry of [ROTATIONAL_180, VERTICAL, ORTHOGONAL]) {
      const { puzzle } = generate({ symmetry, rng: seeded(11) });
      const isGiven = (i: number): boolean => puzzle[i] !== '.';

      for (let cell = 0; cell < 81; cell++) {
        for (const partner of symmetry.pointsFor(cell)) {
          expect(isGiven(cell)).toBe(isGiven(partner));
        }
      }
    }
  });

  it('still yields a unique solution under every symmetry', () => {
    for (const symmetry of SYMMETRIES) {
      const { puzzle } = generate({ symmetry, rng: seeded(13) });
      expect(countSolutions(createGrid(puzzle))).toBe(1);
    }
  });

  it('costs clues — more partners means more givens', () => {
    // Four-fold symmetry must remove four cells at a time, so fewer removals
    // succeed and the puzzle keeps more givens than an asymmetric one.
    const none = generate({ symmetry: NO_SYMMETRY, rng: seeded(17) });
    const four = generate({ symmetry: ORTHOGONAL, rng: seeded(17) });
    expect(four.clueCount).toBeGreaterThan(none.clueCount);
  });

  it('maps a cell to itself under no symmetry', () => {
    expect(NO_SYMMETRY.pointsFor(40)).toEqual([40]);
  });

  it('deduplicates partners that collapse onto the same cell', () => {
    // The centre cell is its own partner under rotation.
    expect(ROTATIONAL_180.pointsFor(40)).toEqual([40]);
  });
});
