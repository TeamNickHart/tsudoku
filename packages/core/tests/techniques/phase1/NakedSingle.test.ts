import { describe, it, expect } from 'vitest';
import { NakedSingle } from '../../../src/techniques/phase1/NakedSingle.js';
import { createGrid, getHints, getFirstHint, EASY_PUZZLE, SOLVED_PUZZLE } from '../../helpers.js';
import { applyHint } from '../../../src/models/GridImpl.js';
import { NAKED_SINGLE_DIFFICULTY } from '../../../src/types/Technique.js';

describe('NakedSingle', () => {
  const producer = new NakedSingle();

  it('detects naked single when one candidate remains', () => {
    const grid = createGrid(EASY_PUZZLE);
    const hints = getHints(producer, grid);
    expect(hints.length).toBeGreaterThan(0);

    for (const hint of hints) {
      expect(hint.type).toBe('direct');
      expect(hint.technique).toBe('NakedSingle');
      if (hint.type === 'direct') {
        expect(hint.digit).toBeGreaterThanOrEqual(1);
        expect(hint.digit).toBeLessThanOrEqual(9);
      }
    }
  });

  it('does not fire when no cells have exactly one candidate', () => {
    const grid = createGrid(SOLVED_PUZZLE);
    const hints = getHints(producer, grid);
    expect(hints).toHaveLength(0);
  });

  it('produces correct DirectHint with cell and digit', () => {
    const grid = createGrid(EASY_PUZZLE);
    const hint = getFirstHint(producer, grid);
    expect(hint).not.toBeNull();
    expect(hint!.type).toBe('direct'); // eslint-disable-line @typescript-eslint/no-non-null-assertion
    if (hint?.type === 'direct') {
      const cell = grid.getCellByIndex(hint.cell);
      expect(cell.candidateCount).toBe(1);
      expect(cell.candidateList).toContain(hint.digit);
    }
  });

  it('produces correct explanation string', () => {
    const grid = createGrid(EASY_PUZZLE);
    const hint = getFirstHint(producer, grid);
    expect(hint).not.toBeNull();
    expect(hint!.explanation).toMatch(/has only one remaining candidate/); // eslint-disable-line @typescript-eslint/no-non-null-assertion
  });

  it('short-circuits after first hint with stop signal', () => {
    const grid = createGrid(EASY_PUZZLE);
    let callCount = 0;
    producer.getHints(grid, () => {
      callCount++;
      return 'stop';
    });
    expect(callCount).toBe(1);
  });

  it('applying a naked single hint places the digit', () => {
    const grid = createGrid(EASY_PUZZLE);
    const hint = getFirstHint(producer, grid);
    expect(hint).not.toBeNull();
    if (hint?.type === 'direct') {
      const newGrid = applyHint(grid, hint);
      const cell = newGrid.getCellByIndex(hint.cell);
      expect(cell.value).toBe(hint.digit);
    }
  });

  it('always uses difficulty 2.3 (SE has no sub-ratings for NakedSingle)', () => {
    const grid = createGrid(EASY_PUZZLE);
    const hints = getHints(producer, grid);
    for (const hint of hints) {
      expect(hint.difficulty).toBe(NAKED_SINGLE_DIFFICULTY);
    }
  });
});
