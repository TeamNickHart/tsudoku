import { describe, expect, it } from 'vitest';
import { PUZZLES } from '@/data/corpus';
import { DIFFICULTY_BANDS, puzzlesInBand, randomPuzzleInBand, solvedInBand } from './difficulty';

/** Index into a fixture that must exist; a missing one is a broken test. */
function nth<T>(items: readonly T[], index: number): T {
  const item = items.at(index);
  if (item === undefined) throw new Error(`fixture has no item at ${index}`);
  return item;
}

const GENTLE = nth(DIFFICULTY_BANDS, 0).id;

describe('randomPuzzleInBand', () => {
  it('never serves a solved puzzle while unsolved ones remain', () => {
    const pool = puzzlesInBand(GENTLE);
    const keep = nth(pool, -1).puzzle;
    const solved = new Set(pool.map((p) => p.puzzle).filter((p) => p !== keep));
    for (let i = 0; i < 50; i++) {
      expect(randomPuzzleInBand(GENTLE, undefined, solved).puzzle).toBe(keep);
    }
  });

  it('allows repeats once the whole band is solved, still avoiding the current one', () => {
    const pool = puzzlesInBand(GENTLE);
    const solved = new Set(pool.map((p) => p.puzzle));
    const current = nth(pool, 0).puzzle;
    for (let i = 0; i < 50; i++) {
      const picked = randomPuzzleInBand(GENTLE, current, solved).puzzle;
      expect(picked).not.toBe(current);
      expect(solved.has(picked)).toBe(true);
    }
  });

  it('moves on even when the current puzzle is the last unsolved one', () => {
    const pool = puzzlesInBand(GENTLE);
    const current = nth(pool, 0).puzzle;
    const solved = new Set(pool.map((p) => p.puzzle).filter((p) => p !== current));
    // Handing back the board on screen would reset the player's progress on
    // it and look like the button did nothing.
    for (let i = 0; i < 50; i++) {
      expect(randomPuzzleInBand(GENTLE, current, solved).puzzle).not.toBe(current);
    }
  });
});

describe('solvedInBand', () => {
  it('counts only puzzles from that band', () => {
    const gentle = puzzlesInBand(GENTLE);
    const other = nth(
      PUZZLES.filter((p) => !gentle.includes(p)),
      0,
    );
    const solved = new Set([nth(gentle, 0).puzzle, nth(gentle, 1).puzzle, other.puzzle]);
    expect(solvedInBand(GENTLE, solved)).toBe(2);
  });
});

describe('the app corpus', () => {
  it('serves no nearly-solved boards', () => {
    const maxGivens = Math.max(
      ...PUZZLES.map((p) => [...p.puzzle].filter((c) => c !== '0' && c !== '.').length),
    );
    expect(maxGivens).toBeLessThanOrEqual(40);
  });
});
