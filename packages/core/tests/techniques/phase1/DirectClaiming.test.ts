import { describe, it, expect } from 'vitest';
import { DirectClaiming } from '../../../src/techniques/phase1/DirectClaiming.js';
import { createGrid, getHints, getFirstHint, SOLVED_PUZZLE } from '../../helpers.js';
import { TECHNIQUE_DIFFICULTY } from '../../../src/types/Technique.js';

describe('DirectClaiming', () => {
  const producer = new DirectClaiming();

  it('does not fire on a solved grid', () => {
    const grid = createGrid(SOLVED_PUZZLE);
    const hints = getHints(producer, grid);
    expect(hints).toHaveLength(0);
  });

  it('produces hints with correct technique and difficulty', () => {
    const grid = createGrid(
      '000921003009000060000000500080403006007000800500706040003000000020000700800195000',
    );
    const hints = getHints(producer, grid);
    for (const hint of hints) {
      expect(hint.type).toBe('direct');
      expect(hint.technique).toBe('DirectClaiming');
      expect(hint.difficulty).toBe(TECHNIQUE_DIFFICULTY.DirectClaiming);
    }
  });

  it('short-circuits after first hint with stop signal', () => {
    const grid = createGrid(
      '000921003009000060000000500080403006007000800500706040003000000020000700800195000',
    );
    let callCount = 0;
    producer.getHints(grid, () => {
      callCount++;
      return 'stop';
    });
    expect(callCount).toBeLessThanOrEqual(1);
  });

  it('produces correct explanation string when found', () => {
    const grid = createGrid(
      '000921003009000060000000500080403006007000800500706040003000000020000700800195000',
    );
    const hint = getFirstHint(producer, grid);
    if (hint !== null) {
      expect(hint.explanation).toMatch(/Claiming/);
    }
  });
});
