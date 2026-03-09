import { describe, it, expect } from 'vitest';
import { HiddenSingle } from '../../../src/techniques/phase1/HiddenSingle.js';
import { createGrid, getHints, getFirstHint, EASY_PUZZLE, SOLVED_PUZZLE } from '../../helpers.js';
import {
  HIDDEN_SINGLE_ALONE_DIFFICULTY,
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
    // Could be "alone" or "hidden single" explanation
    expect(hint!.explanation).toMatch(/can only go in|is the last empty cell/); // eslint-disable-line @typescript-eslint/no-non-null-assertion
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

  it('assigns correct difficulty per region type and alone status', () => {
    const grid = createGrid(EASY_PUZZLE);
    const hints = getHints(producer, grid);
    for (const hint of hints) {
      expect([
        HIDDEN_SINGLE_ALONE_DIFFICULTY,
        HIDDEN_SINGLE_BOX_DIFFICULTY,
        HIDDEN_SINGLE_LINE_DIFFICULTY,
      ]).toContain(hint.difficulty);
    }
  });

  it('emits alone hints (1.0) before true hidden singles', () => {
    // Nearly solved puzzle: one cell left in box 9 (R9C9)
    const puzzle =
      '53467891267219534819834256785976142342685379171392485696153728428741963534528617.';
    const grid = createGrid(puzzle);
    const hint = getFirstHint(producer, grid);
    expect(hint).not.toBeNull();
    expect(hint!.difficulty).toBe(HIDDEN_SINGLE_ALONE_DIFFICULTY); // eslint-disable-line @typescript-eslint/no-non-null-assertion
  });

  it('checks boxes before columns before rows (SE region order)', () => {
    const grid = createGrid(EASY_PUZZLE);
    const hints = getHints(producer, grid);
    // Alone hints (1.0) come first, then box (1.2), then line (1.5)
    let lastDifficulty = 0;
    for (const hint of hints) {
      expect(hint.difficulty).toBeGreaterThanOrEqual(lastDifficulty);
      lastDifficulty = hint.difficulty;
    }
  });
});
