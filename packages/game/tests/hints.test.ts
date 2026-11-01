import { describe, expect, it } from 'vitest';
import {
  undo,
  presentHint,
  pendingHintDecorations,
  hintProgress,
  applyHintAsMove,
  applyMove,
  createGame,
  errorCells,
  fillNotes,
  hintHighlights,
  isSolved,
  nextHint,
  toPlayerGrid,
} from '../src/index.js';
import type { GameState } from '../src/index.js';
import type { EliminationHint } from '@tsudoku/core';

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

describe('hints respect what the player has already worked out', () => {
  // A Pointing-rated corpus puzzle. Playing its singles leads to a Pointing
  // that eliminates 6 from two cells.
  const POINTING =
    '............42...9.7...38.4.852...9.19..5..48.4...836.5.38...2.7...34............';

  /** Play hinted placements until the next hint is an elimination. */
  function toFirstElimination(): { game: GameState; hint: EliminationHint } {
    let game = createGame(POINTING);
    for (let i = 0; i < 81; i++) {
      const hint = nextHint(game);
      if (hint === null) break;
      if (hint.type === 'elimination') return { game, hint };
      game = applyHintAsMove(game, hint);
    }
    throw new Error('fixture never reached an elimination');
  }

  const strike = (game: GameState, cell: number, digit: number): GameState =>
    applyMove(game, { kind: 'addNote', cell, digit, note: 'excluded' });

  it('does not offer an elimination the player has already struck', () => {
    const { game, hint } = toFirstElimination();
    expect(hint.eliminations.length).toBeGreaterThan(0);

    let played = game;
    for (const { cell, digit } of hint.eliminations) played = strike(played, cell, digit);

    const next = nextHint(played);
    expect(next).not.toBeNull();
    // Whatever comes next, none of it is work already done.
    if (next?.type === 'elimination') {
      for (const { cell, digit } of next.eliminations) {
        expect(played.notes[cell]!.excluded).not.toContain(digit);
      }
    }
    expect(JSON.stringify(next)).not.toBe(JSON.stringify(hint));
  });

  it('offers only what is left of a partly applied elimination', () => {
    const { game, hint } = toFirstElimination();
    expect(hint.eliminations.length).toBeGreaterThan(1);
    const [done, ...rest] = hint.eliminations;
    const next = nextHint(strike(game, done!.cell, done!.digit));
    expect(next?.type).toBe('elimination');
    if (next?.type === 'elimination') {
      expect(next.eliminations).not.toContainEqual(done);
      expect(next.eliminations).toEqual(expect.arrayContaining(rest));
    }
  });

  it('treats a digit left out of a noted cell as ruled out', () => {
    const { game, hint } = toFirstElimination();
    // Auto-notes, then un-note the hint's eliminations instead of striking.
    let played = fillNotes(game);
    for (const { cell, digit } of hint.eliminations) {
      played = applyMove(played, { kind: 'removeNote', cell, digit, note: 'included' });
    }
    expect(JSON.stringify(nextHint(played))).not.toBe(JSON.stringify(hint));
  });

  it('ignores a mistaken strike of the real answer', () => {
    const { game, hint } = toFirstElimination();
    // Strike the answer in every empty cell: all wrong, so none may count.
    let played = game;
    for (let cell = 0; cell < 81; cell++) {
      if (played.entries[cell] === null) {
        played = strike(played, cell, Number(played.solution[cell]));
      }
    }
    expect(JSON.stringify(nextHint(played))).toBe(JSON.stringify(hint));
  });

  it('passes on only eliminations that are true', () => {
    const { game } = toFirstElimination();
    const grid = toPlayerGrid(fillNotes(game));
    for (let cell = 0; cell < 81; cell++) {
      if (game.entries[cell] !== null) continue;
      const answer = Number(game.solution[cell]);
      expect(grid.getCellByIndex(cell).candidateList).toContain(answer);
    }
  });
});

describe('hint progress', () => {
  const POINTING =
    '............42...9.7...38.4.852...9.19..5..48.4...836.5.38...2.7...34............';

  function toFirstElimination(): { game: GameState; hint: EliminationHint } {
    let game = createGame(POINTING);
    for (let i = 0; i < 81; i++) {
      const hint = nextHint(game);
      if (hint === null) break;
      if (hint.type === 'elimination') return { game, hint };
      game = applyHintAsMove(game, hint);
    }
    throw new Error('fixture never reached an elimination');
  }

  const strike = (game: GameState, cell: number, digit: number): GameState =>
    applyMove(game, { kind: 'addNote', cell, digit, note: 'excluded' });

  it('counts each elimination as the player makes it, and undo takes it back', () => {
    const { game, hint } = toFirstElimination();
    expect(hintProgress(game, hint)).toEqual({ done: 0, total: 2, complete: false });

    const [first, second] = hint.eliminations;
    if (first === undefined || second === undefined) throw new Error('fixture');
    const one = strike(game, first.cell, first.digit);
    expect(hintProgress(one, hint)).toEqual({ done: 1, total: 2, complete: false });

    const both = strike(one, second.cell, second.digit);
    expect(hintProgress(both, hint).complete).toBe(true);
    expect(hintProgress(undo(both), hint).done).toBe(1);
  });

  it('counts un-noting a candidate the same as striking it', () => {
    const { game, hint } = toFirstElimination();
    let played = fillNotes(game);
    for (const { cell, digit } of hint.eliminations) {
      played = applyMove(played, { kind: 'removeNote', cell, digit, note: 'included' });
    }
    expect(hintProgress(played, hint).complete).toBe(true);
  });

  it('leaves only the steps still to do on the board', () => {
    const { game, hint } = toFirstElimination();
    const { decorations } = presentHint(hint, toPlayerGrid(game));
    const [first] = hint.eliminations;
    if (first === undefined) throw new Error('fixture');
    const pending = pendingHintDecorations(
      strike(game, first.cell, first.digit),
      hint,
      decorations,
    );

    const eliminated = pending.filter((d) => d.role === 'eliminated');
    expect(eliminated).toHaveLength(hint.eliminations.length - 1);
    expect(
      eliminated.some(
        (d) =>
          d.target.kind === 'note' &&
          d.target.cell === first.cell &&
          d.target.digit === first.digit,
      ),
    ).toBe(false);
    // The pattern stays until the hint is finished.
    expect(pending.filter((d) => d.role === 'supporting')).toEqual(
      decorations.filter((d) => d.role === 'supporting'),
    );
  });

  it('completes a placement hint once its cell is filled', () => {
    const game = createGame(EASY);
    const hint = nextHint(game);
    if (hint === null || hint.type !== 'direct') throw new Error('fixture');
    expect(hintProgress(game, hint)).toEqual({ done: 0, total: 1, complete: false });
    const placed = applyHintAsMove(game, hint);
    expect(hintProgress(placed, hint).complete).toBe(true);
    expect(
      pendingHintDecorations(placed, hint, presentHint(hint, toPlayerGrid(game)).decorations),
    ).toEqual([]);
  });
});
