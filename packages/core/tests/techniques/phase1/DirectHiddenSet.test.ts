import { describe, it, expect } from 'vitest';
import { DirectHiddenSet } from '../../../src/techniques/phase1/DirectHiddenSet.js';
import { createGrid, getHints, SOLVED_PUZZLE } from '../../helpers.js';
import { TECHNIQUE_DIFFICULTY } from '../../../src/types/Technique.js';

describe('DirectHiddenPair', () => {
  const producer = new DirectHiddenSet(2);

  it('has correct technique name and difficulty', () => {
    expect(producer.technique).toBe('DirectHiddenPair');
    expect(producer.difficulty).toBe(TECHNIQUE_DIFFICULTY.DirectHiddenPair);
  });

  it('does not fire on a solved grid', () => {
    const grid = createGrid(SOLVED_PUZZLE);
    const hints = getHints(producer, grid);
    expect(hints).toHaveLength(0);
  });

  it('produces hints with correct technique', () => {
    // A puzzle that may contain direct hidden pairs
    const grid = createGrid(
      '000000000904607000076804100309701080008000300050308702007502610000403208000000000',
    );
    const hints = getHints(producer, grid);
    for (const hint of hints) {
      expect(hint.type).toBe('direct');
      expect(hint.technique).toBe('DirectHiddenPair');
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
});

describe('DirectHiddenTriplet', () => {
  const producer = new DirectHiddenSet(3);

  it('has correct technique name and difficulty', () => {
    expect(producer.technique).toBe('DirectHiddenTriplet');
    expect(producer.difficulty).toBe(TECHNIQUE_DIFFICULTY.DirectHiddenTriplet);
  });

  it('does not fire on a solved grid', () => {
    const grid = createGrid(SOLVED_PUZZLE);
    const hints = getHints(producer, grid);
    expect(hints).toHaveLength(0);
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
});
