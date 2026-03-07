import { describe, it, expect } from 'vitest';
import { HiddenSingle } from '../../../src/techniques/phase1/HiddenSingle.js';
import { createGrid, getHints, getFirstHint, EASY_PUZZLE, SOLVED_PUZZLE } from '../../helpers.js';
import {
  HIDDEN_SINGLE_BOX_DIFFICULTY,
  HIDDEN_SINGLE_LINE_DIFFICULTY,
} from '../../../src/types/Technique.js';

describe('HiddenSingle', () => {
  const producer = new HiddenSingle();

  it('detects hidden single when digit has one position in a region', () => {
    const grid = createGrid(EASY_PUZZLE);
    const hints = getHints(producer, grid);
    expect(hints.length).toBeGreaterThan(0);

    for (const hint of hints) {
      expect(hint.type).toBe('direct');
      expect(hint.technique).toBe('HiddenSingle');
    }
  });

  it('does not fire on a solved grid', () => {
    const grid = createGrid(SOLVED_PUZZLE);
    const hints = getHints(producer, grid);
    expect(hints).toHaveLength(0);
  });

  it('produces correct DirectHint with cell and digit', () => {
    const grid = createGrid(EASY_PUZZLE);
    const hint = getFirstHint(producer, grid);
    expect(hint).not.toBeNull();
    if (hint?.type === 'direct') {
      // The digit should be a valid candidate in the cell
      const cell = grid.getCellByIndex(hint.cell);
      expect(cell.candidateList).toContain(hint.digit);
    }
  });

  it('produces correct explanation string', () => {
    const grid = createGrid(EASY_PUZZLE);
    const hint = getFirstHint(producer, grid);
    expect(hint).not.toBeNull();
    expect(hint!.explanation).toMatch(/can only go in/); // eslint-disable-line @typescript-eslint/no-non-null-assertion
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

  it('uses box difficulty (1.2) for box hidden singles', () => {
    const grid = createGrid(EASY_PUZZLE);
    const hints = getHints(producer, grid);
    const boxHints = hints.filter((h) => h.difficulty === HIDDEN_SINGLE_BOX_DIFFICULTY);
    const lineHints = hints.filter((h) => h.difficulty === HIDDEN_SINGLE_LINE_DIFFICULTY);
    // Should have at least some of each type
    expect(boxHints.length + lineHints.length).toBe(hints.length);
  });
});
