import { describe, expect, it } from 'vitest';
import { applyHint, createGrid } from '../../../src/models/GridImpl.js';
import { NakedSet } from '../../../src/techniques/phase2/NakedSet.js';
import { HiddenSet } from '../../../src/techniques/phase2/HiddenSet.js';
import { Fisherman } from '../../../src/techniques/phase2/Fisherman.js';
import { XYWing } from '../../../src/techniques/phase2/XYWing.js';
import { Solver } from '../../../src/solver/Solver.js';
import { hasCandidate } from '../../../src/candidates/bitmask.js';
import type { Grid } from '../../../src/types/Grid.js';
import type { Hint } from '../../../src/types/Hint.js';
import type { HintProducer } from '../../../src/types/HintProducer.js';

const SOLVED = '534678912672195348198342567859761423426853791713924856961537284287419635345286179';
const HARD = '000000000904607000076804100309701080008000300050308702007502610000403208000000000';

/** Advance a puzzle until `producer` fires, or give up. */
function findHint(producer: HintProducer, puzzle: string): { grid: Grid; hint: Hint } | null {
  let grid = createGrid(puzzle);
  const solver = new Solver();
  for (let step = 0; step < 60; step++) {
    let found: Hint | null = null;
    producer.getHints(grid, (h) => {
      found = h;
      return 'stop';
    });
    if (found !== null) return { grid, hint: found };
    const next = solver.getNextHint(grid);
    if (next === null) return null;
    grid = applyHint(grid, next);
  }
  return null;
}

const PRODUCERS: [string, HintProducer, number][] = [
  ['NakedPair', new NakedSet(2), 3.0],
  ['XWing', new Fisherman(2), 3.2],
  ['HiddenPair', new HiddenSet(2), 3.4],
  ['NakedTriplet', new NakedSet(3), 3.6],
  ['Swordfish', new Fisherman(3), 3.8],
  ['HiddenTriplet', new HiddenSet(3), 4.0],
  ['XYWing', new XYWing(false), 4.2],
  ['XYZWing', new XYWing(true), 4.4],
];

describe('Phase 2 producers', () => {
  it.each(PRODUCERS)('%s is registered at its SE rating', (name, producer, rating) => {
    expect(producer.technique).toBe(name);
    expect(producer.difficulty).toBe(rating);
  });

  it.each(PRODUCERS)('%s does not fire on a solved grid', (_name, producer) => {
    const hints: Hint[] = [];
    producer.getHints(createGrid(SOLVED), (h) => {
      hints.push(h);
    });
    expect(hints).toHaveLength(0);
  });

  it.each(PRODUCERS)('%s only ever emits eliminations', (_name, producer) => {
    const found = findHint(producer, HARD);
    if (found === null) return; // not every technique applies to every puzzle
    expect(found.hint.type).toBe('elimination');
  });

  it.each(PRODUCERS)('%s never emits an empty elimination set', (_name, producer) => {
    // SE's isWorth() check: a hint that removes nothing is not offered.
    const found = findHint(producer, HARD);
    if (found === null) return;
    if (found.hint.type === 'elimination') {
      expect(found.hint.eliminations.length).toBeGreaterThan(0);
    }
  });

  it.each(PRODUCERS)('%s eliminations actually take effect', (_name, producer) => {
    const found = findHint(producer, HARD);
    if (found === null) return;
    if (found.hint.type !== 'elimination') return;

    const target = found.hint.eliminations[0]!;
    expect(hasCandidate(found.grid.getCellByIndex(target.cell).candidates, target.digit)).toBe(
      true,
    );

    const after = applyHint(found.grid, found.hint);
    expect(hasCandidate(after.getCellByIndex(target.cell).candidates, target.digit)).toBe(false);
  });

  // Naked sets and fish eliminate *outside* the pattern; hidden sets eliminate
  // *inside* it. That is the defining difference between the two families, not
  // an inconsistency: a hidden set says "these cells hold only these digits",
  // so the eliminations are the other candidates in the set's own cells.
  const ELIMINATES_OUTSIDE = PRODUCERS.filter(([name]) => !name.startsWith('Hidden'));
  const ELIMINATES_INSIDE = PRODUCERS.filter(([name]) => name.startsWith('Hidden'));

  it.each(ELIMINATES_OUTSIDE)('%s eliminates outside its pattern cells', (_name, producer) => {
    const found = findHint(producer, HARD);
    if (found === null) return;
    if (found.hint.type !== 'elimination') return;

    const involved = new Set(found.hint.involvedCells);
    for (const elimination of found.hint.eliminations) {
      expect(involved.has(elimination.cell)).toBe(false);
    }
  });

  it.each(ELIMINATES_INSIDE)('%s eliminates inside its pattern cells', (_name, producer) => {
    const found = findHint(producer, HARD);
    if (found === null) return;
    if (found.hint.type !== 'elimination') return;

    const involved = new Set(found.hint.involvedCells);
    for (const elimination of found.hint.eliminations) {
      expect(involved.has(elimination.cell)).toBe(true);
    }
  });

  it.each(ELIMINATES_INSIDE)('%s never removes a digit of its own set', (_name, producer) => {
    // The set's digits are exactly what those cells keep.
    const found = findHint(producer, HARD);
    if (found === null) return;
    if (found.hint.type !== 'elimination') return;

    for (const elimination of found.hint.eliminations) {
      const kept = found.hint.involvedCandidates.get(elimination.cell) ?? [];
      expect(kept).not.toContain(elimination.digit);
    }
  });

  it.each(PRODUCERS)('%s short-circuits on stop', (_name, producer) => {
    const found = findHint(producer, HARD);
    if (found === null) return;
    let count = 0;
    producer.getHints(found.grid, () => {
      count += 1;
      return 'stop';
    });
    expect(count).toBe(1);
  });
});

describe('Fisherman sizes', () => {
  it('names each size as its own technique', () => {
    expect(new Fisherman(2).technique).toBe('XWing');
    expect(new Fisherman(3).technique).toBe('Swordfish');
    expect(new Fisherman(4).technique).toBe('Jellyfish');
  });
});

describe('XYWing vs XYZWing', () => {
  it('distinguishes the two by pivot size', () => {
    expect(new XYWing(false).technique).toBe('XYWing');
    expect(new XYWing(true).technique).toBe('XYZWing');
    expect(new XYWing(true).difficulty).toBeGreaterThan(new XYWing(false).difficulty);
  });
});
