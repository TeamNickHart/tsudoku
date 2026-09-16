import { describe, it, expect } from 'vitest';
import { DirectPointing } from '../../../src/techniques/phase1/DirectPointing.js';
import { createGrid, getHints, getFirstHint, SOLVED_PUZZLE } from '../../helpers.js';
import { TECHNIQUE_DIFFICULTY } from '../../../src/types/Technique.js';

describe('DirectPointing', () => {
  const producer = new DirectPointing();

  it('does not fire on a solved grid', () => {
    const grid = createGrid(SOLVED_PUZZLE);
    const hints = getHints(producer, grid);
    expect(hints).toHaveLength(0);
  });

  it('produces hints with correct technique and difficulty', () => {
    // Use a puzzle known to have pointing patterns
    const grid = createGrid(
      '000000000904607000076804100309701080008000300050308702007502610000403208000000000',
    );
    const hints = getHints(producer, grid);
    for (const hint of hints) {
      expect(hint.type).toBe('direct');
      expect(hint.technique).toBe('DirectPointing');
      expect(hint.difficulty).toBe(TECHNIQUE_DIFFICULTY.DirectPointing);
    }
  });

  it('short-circuits after first hint with stop signal', () => {
    const grid = createGrid(
      '000000000904607000076804100309701080008000300050308702007502610000403208000000000',
    );
    let callCount = 0;
    producer.getHints(grid, () => {
      callCount++;
      return 'stop';
    });
    expect(callCount).toBeLessThanOrEqual(1);
  });

  it('produces correct explanation string', () => {
    const grid = createGrid(
      '000000000904607000076804100309701080008000300050308702007502610000403208000000000',
    );
    const hint = getFirstHint(producer, grid);
    if (hint !== null) {
      expect(hint.explanation).toMatch(/Pointing/);
    }
  });
});
