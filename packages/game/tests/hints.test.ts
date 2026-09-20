import { describe, expect, it } from 'vitest';
import {
  applyHintAsMove,
  applyMove,
  createGame,
  errorCells,
  hintHighlights,
  isSolved,
  nextHint,
} from '../src/index.js';

const EASY = '530070000600195000098000060800060003400803001700020006060000280000419005000080079';
const SOLVED = '534678912672195348198342567859761423426853791713924856961537284287419635345286179';

describe('nextHint', () => {
  it('offers a hint on a fresh puzzle', () => {
    const hint = nextHint(createGame(EASY));
    expect(hint).not.toBeNull();
    expect(hint!.explanation.length).toBeGreaterThan(0);
    expect(hint!.technique).toBeTruthy();
  });

  it('returns null once the puzzle is solved', () => {
    let game = createGame(EASY);
    for (let i = 0; i < 81; i++) {
      if (game.entries[i] === null) {
        game = applyMove(game, { kind: 'setValue', cell: i, digit: Number(SOLVED[i]) });
      }
    }
    expect(isSolved(game)).toBe(true);
    expect(nextHint(game)).toBeNull();
  });

  it('reads the player board, not the original puzzle', () => {
    const fresh = createGame(EASY);
    const first = nextHint(fresh)!;

    // Fill in the hinted cell; the next hint must differ.
    const advanced = applyHintAsMove(fresh, first);
    const second = nextHint(advanced);
    expect(second).not.toBeNull();
    if (second!.type === 'direct' && first.type === 'direct') {
      expect(second!.cell).not.toBe(first.cell);
    }
  });
});

describe('applyHintAsMove', () => {
  it('places the hinted digit and records history', () => {
    const game = createGame(EASY);
    const hint = nextHint(game)!;
    expect(hint.type).toBe('direct');

    const after = applyHintAsMove(game, hint);
    if (hint.type === 'direct') {
      expect(after.entries[hint.cell]).toBe(hint.digit);
    }
    expect(after.history).toHaveLength(1);
  });

  it('places a correct digit — hints never introduce errors', () => {
    let game = createGame(EASY);
    for (let i = 0; i < 20; i++) {
      const hint = nextHint(game);
      if (hint === null) break;
      game = applyHintAsMove(game, hint);
      expect(errorCells(game)).toHaveLength(0);
    }
  });

  it('solves the whole puzzle by following hints', () => {
    let game = createGame(EASY);
    for (let i = 0; i < 100 && !isSolved(game); i++) {
      const hint = nextHint(game);
      if (hint === null) break;
      game = applyHintAsMove(game, hint);
    }
    expect(isSolved(game)).toBe(true);
  });
});

describe('hintHighlights', () => {
  it('exposes the cells a hint involves', () => {
    const hint = nextHint(createGame(EASY))!;
    expect(Array.isArray(hintHighlights(hint))).toBe(true);
  });
});
