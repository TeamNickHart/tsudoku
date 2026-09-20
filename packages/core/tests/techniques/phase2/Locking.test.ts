import { describe, expect, it } from 'vitest';
import { applyHint, createGrid } from '../../../src/models/GridImpl.js';
import { Locking } from '../../../src/techniques/phase2/Locking.js';
import { hasCandidate } from '../../../src/candidates/bitmask.js';
import type { Hint } from '../../../src/types/Hint.js';

const POINTING =
  '530070000600195000098000060800060003400803001700020006060000280000419005000080079';
const CLAIMING =
  '000000000904607000076804100309701080008000300050308702007502610000403208000000000';
const SOLVED = '534678912672195348198342567859761423426853791713924856961537284287419635345286179';

function collect(producer: Locking, puzzle: string): Hint[] {
  const hints: Hint[] = [];
  producer.getHints(createGrid(puzzle), (h) => {
    hints.push(h);
  });
  return hints;
}

describe('Locking — Pointing', () => {
  const pointing = new Locking(true);

  it('is registered at SE 2.6', () => {
    expect(pointing.technique).toBe('Pointing');
    expect(pointing.difficulty).toBe(2.6);
  });

  it('detects pointing eliminations', () => {
    expect(collect(pointing, POINTING).length).toBeGreaterThan(0);
  });

  it('produces elimination hints, never placements', () => {
    for (const hint of collect(pointing, POINTING)) {
      expect(hint.type).toBe('elimination');
    }
  });

  it('never proposes an empty elimination set', () => {
    // SE's isWorth() check — a hint with nothing to remove is not offered.
    for (const hint of collect(pointing, POINTING)) {
      if (hint.type === 'elimination') {
        expect(hint.eliminations.length).toBeGreaterThan(0);
      }
    }
  });

  it('produces a human-readable explanation', () => {
    const hint = collect(pointing, POINTING)[0]!;
    expect(hint.explanation).toMatch(/Pointing: \d+ in box \d+ is confined to/);
  });

  it('short-circuits when the accumulator returns stop', () => {
    let count = 0;
    pointing.getHints(createGrid(POINTING), () => {
      count += 1;
      return 'stop';
    });
    expect(count).toBe(1);
  });

  it('does not fire on a solved grid', () => {
    expect(collect(pointing, SOLVED)).toHaveLength(0);
  });
});

describe('Locking — Claiming', () => {
  const claiming = new Locking(false);

  it('is registered at SE 2.8', () => {
    expect(claiming.technique).toBe('Claiming');
    expect(claiming.difficulty).toBe(2.8);
  });

  it('detects claiming eliminations', () => {
    const hints = collect(claiming, CLAIMING);
    expect(hints.length).toBeGreaterThan(0);
    expect(hints[0]!.explanation).toMatch(/Claiming: \d+ in (row|column) \d+ is confined to box/);
  });

  it('does not fire on a solved grid', () => {
    expect(collect(claiming, SOLVED)).toHaveLength(0);
  });
});

describe('Locking — soundness', () => {
  it('eliminations actually take effect on the grid', () => {
    // End-to-end check that applyHint now supports eliminations.
    const grid = createGrid(POINTING);
    const hints: Hint[] = [];
    new Locking(true).getHints(grid, (h) => {
      hints.push(h);
      return 'stop';
    });

    const hint = hints[0]!;
    if (hint.type !== 'elimination') throw new Error('expected an elimination hint');

    const target = hint.eliminations[0]!;
    expect(hasCandidate(grid.getCellByIndex(target.cell).candidates, target.digit)).toBe(true);

    const after = applyHint(grid, hint);
    expect(hasCandidate(after.getCellByIndex(target.cell).candidates, target.digit)).toBe(false);
  });

  it('only eliminates from cells outside the confining region', () => {
    for (const hint of collect(new Locking(true), POINTING)) {
      if (hint.type !== 'elimination') continue;
      const involved = new Set(hint.involvedCells);
      for (const elimination of hint.eliminations) {
        expect(involved.has(elimination.cell)).toBe(false);
      }
    }
  });
});
