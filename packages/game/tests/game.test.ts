import { describe, expect, it } from 'vitest';
import {
  InvalidPuzzleError,
  applyMove,
  canRedo,
  canUndo,
  cellView,
  createGame,
  errorCells,
  isGiven,
  isSolved,
  redo,
  remainingCount,
  resetGame,
  selectCell,
  toPuzzleString,
  undo,
} from '../src/index.js';

const EASY = '530070000600195000098000060800060003400803001700020006060000280000419005000080079';
const SOLVED = '534678912672195348198342567859761423426853791713924856961537284287419635345286179';

/** First blank cell in EASY — index 2 (r1c3). */
const BLANK = 2;

describe('createGame', () => {
  it('computes the solution once, up front', () => {
    const game = createGame(EASY);
    expect(game.solution).toBe(SOLVED);
  });

  it('seeds entries from the givens', () => {
    const game = createGame(EASY);
    expect(game.entries[0]).toBe(5);
    expect(game.entries[BLANK]).toBeNull();
    expect(remainingCount(game)).toBe(EASY.split('').filter((c) => c === '0').length);
  });

  it('starts with empty marks and history', () => {
    const game = createGame(EASY);
    expect(game.notes.every((n) => n.included.length === 0 && n.excluded.length === 0)).toBe(true);
    expect(game.history).toHaveLength(0);
    expect(canUndo(game)).toBe(false);
    expect(canRedo(game)).toBe(false);
  });

  it('rejects a puzzle of the wrong length', () => {
    expect(() => createGame('123')).toThrow(InvalidPuzzleError);
  });

  it('rejects an unsolvable puzzle', () => {
    expect(() => createGame(`55${'.'.repeat(79)}`)).toThrow(InvalidPuzzleError);
  });
});

describe('entering values', () => {
  it('sets a value in an editable cell', () => {
    const game = applyMove(createGame(EASY), { kind: 'setValue', cell: BLANK, digit: 4 });
    expect(game.entries[BLANK]).toBe(4);
  });

  it('refuses to modify a given', () => {
    const game = createGame(EASY);
    const after = applyMove(game, { kind: 'setValue', cell: 0, digit: 9 });
    expect(after).toBe(game); // unchanged, same reference
    expect(after.entries[0]).toBe(5);
  });

  it('clears a value', () => {
    let game = createGame(EASY);
    game = applyMove(game, { kind: 'setValue', cell: BLANK, digit: 4 });
    game = applyMove(game, { kind: 'clearValue', cell: BLANK });
    expect(game.entries[BLANK]).toBeNull();
  });

  it('ignores out-of-range cells and digits', () => {
    const game = createGame(EASY);
    expect(applyMove(game, { kind: 'setValue', cell: 99, digit: 4 })).toBe(game);
    expect(applyMove(game, { kind: 'setValue', cell: BLANK, digit: 0 })).toBe(game);
    expect(applyMove(game, { kind: 'setValue', cell: BLANK, digit: 10 })).toBe(game);
  });

  it('does not record a no-op move in history', () => {
    const game = createGame(EASY);
    const after = applyMove(game, { kind: 'clearValue', cell: 0 }); // a given
    expect(after.history).toHaveLength(0);
  });
});

describe('notes', () => {
  it('adds notes and keeps them sorted', () => {
    let game = createGame(EASY);
    game = applyMove(game, { kind: 'addNote', cell: BLANK, digit: 7, note: 'included' });
    game = applyMove(game, { kind: 'addNote', cell: BLANK, digit: 2, note: 'included' });
    game = applyMove(game, { kind: 'addNote', cell: BLANK, digit: 4, note: 'included' });
    expect(game.notes[BLANK]!.included).toEqual([2, 4, 7]);
  });

  it('ignores a duplicate note', () => {
    let game = createGame(EASY);
    game = applyMove(game, { kind: 'addNote', cell: BLANK, digit: 7, note: 'included' });
    const before = game;
    game = applyMove(game, { kind: 'addNote', cell: BLANK, digit: 7, note: 'included' });
    expect(game).toBe(before);
  });

  it('removes a note', () => {
    let game = createGame(EASY);
    game = applyMove(game, { kind: 'addNote', cell: BLANK, digit: 7, note: 'included' });
    game = applyMove(game, { kind: 'removeNote', cell: BLANK, digit: 7, note: 'included' });
    expect(game.notes[BLANK]!.included).toEqual([]);
  });

  it('clears notes when a value is entered', () => {
    let game = createGame(EASY);
    game = applyMove(game, { kind: 'addNote', cell: BLANK, digit: 7, note: 'included' });
    game = applyMove(game, { kind: 'setValue', cell: BLANK, digit: 4 });
    expect(game.notes[BLANK]!.included).toEqual([]);
  });

  it('refuses to note a filled cell', () => {
    let game = createGame(EASY);
    game = applyMove(game, { kind: 'setValue', cell: BLANK, digit: 4 });
    const before = game;
    game = applyMove(game, { kind: 'addNote', cell: BLANK, digit: 7, note: 'included' });
    expect(game).toBe(before);
  });

  it('allows notes the engine disagrees with', () => {
    // The whole point of marks being separate from candidates: a player can
    // pencil in something impossible, and the app should let them.
    let game = createGame(EASY);
    game = applyMove(game, { kind: 'addNote', cell: BLANK, digit: 5, note: 'included' }); // 5 is in r1c1
    expect(game.notes[BLANK]!.included).toEqual([5]);
    expect(cellView(game, BLANK).staleNotes).toEqual([5]);
  });
});

describe('history', () => {
  it('undoes and redoes a value', () => {
    let game = createGame(EASY);
    game = applyMove(game, { kind: 'setValue', cell: BLANK, digit: 4 });
    expect(canUndo(game)).toBe(true);

    game = undo(game);
    expect(game.entries[BLANK]).toBeNull();
    expect(canRedo(game)).toBe(true);

    game = redo(game);
    expect(game.entries[BLANK]).toBe(4);
  });

  it('replays a long sequence correctly', () => {
    let game = createGame(EASY);
    const blanks = [2, 3, 5, 6, 7, 8];
    for (const cell of blanks) {
      game = applyMove(game, { kind: 'setValue', cell, digit: 1 });
    }
    expect(game.history).toHaveLength(blanks.length);

    for (let i = 0; i < blanks.length; i++) {
      game = undo(game);
    }
    expect(canUndo(game)).toBe(false);
    expect(toPuzzleString(game)).toBe(EASY.replace(/0/g, '.'));
  });

  it('truncates the redo tail when a new move follows an undo', () => {
    let game = createGame(EASY);
    game = applyMove(game, { kind: 'setValue', cell: 2, digit: 4 });
    game = applyMove(game, { kind: 'setValue', cell: 3, digit: 6 });
    game = undo(game);
    expect(canRedo(game)).toBe(true);

    game = applyMove(game, { kind: 'setValue', cell: 3, digit: 8 });
    expect(canRedo(game)).toBe(false);
    expect(game.history).toHaveLength(2);
    expect(game.entries[3]).toBe(8);
  });

  it('restores notes through undo', () => {
    let game = createGame(EASY);
    game = applyMove(game, { kind: 'addNote', cell: BLANK, digit: 4, note: 'included' });
    game = applyMove(game, { kind: 'addNote', cell: BLANK, digit: 7, note: 'included' });
    game = undo(game);
    expect(game.notes[BLANK]!.included).toEqual([4]);
  });

  it('does nothing when there is nothing to undo or redo', () => {
    const game = createGame(EASY);
    expect(undo(game)).toBe(game);
    expect(redo(game)).toBe(game);
  });
});

describe('progress', () => {
  it('detects errors against the solution', () => {
    let game = createGame(EASY);
    expect(errorCells(game)).toHaveLength(0);

    // SOLVED[2] is '4', so 9 is wrong.
    game = applyMove(game, { kind: 'setValue', cell: BLANK, digit: 9 });
    expect(errorCells(game)).toEqual([BLANK]);
    expect(cellView(game, BLANK).isError).toBe(true);
  });

  it('recognises a completed puzzle', () => {
    let game = createGame(EASY);
    expect(isSolved(game)).toBe(false);

    for (let i = 0; i < 81; i++) {
      if (!isGiven(game, i)) {
        game = applyMove(game, { kind: 'setValue', cell: i, digit: Number(SOLVED[i]) });
      }
    }
    expect(isSolved(game)).toBe(true);
    expect(remainingCount(game)).toBe(0);
    expect(errorCells(game)).toHaveLength(0);
  });

  it('resets to the givens', () => {
    let game = createGame(EASY);
    game = applyMove(game, { kind: 'setValue', cell: BLANK, digit: 4 });
    game = applyMove(game, { kind: 'addNote', cell: 3, digit: 7, note: 'included' });
    game = resetGame(game);

    expect(game.entries[BLANK]).toBeNull();
    expect(game.notes[3]!.included).toEqual([]);
    expect(game.history).toHaveLength(0);
    expect(canUndo(game)).toBe(false);
  });
});

describe('selection', () => {
  it('selects and clears', () => {
    let game = createGame(EASY);
    game = selectCell(game, 40);
    expect(game.selected).toEqual([40]);
    game = selectCell(game, null);
    expect(game.selected).toEqual([]);
  });

  it('ignores an out-of-range selection', () => {
    const game = createGame(EASY);
    expect(selectCell(game, 81)).toBe(game);
  });
});

describe('serialization', () => {
  it('survives a JSON round trip', () => {
    let game = createGame(EASY);
    game = applyMove(game, { kind: 'setValue', cell: BLANK, digit: 4 });
    game = applyMove(game, { kind: 'addNote', cell: 3, digit: 7, note: 'included' });
    game = selectCell(game, 40);

    const restored = JSON.parse(JSON.stringify(game)) as typeof game;

    expect(restored).toEqual(game);
    expect(isSolved(restored)).toBe(false);
    expect(errorCells(restored)).toHaveLength(0);
    expect(undo(restored).entries[3]).toBeNull();
  });

  it('stays small enough to persist comfortably', () => {
    const game = createGame(EASY);
    // A Grid serializes to ~40KB; game state must not.
    expect(JSON.stringify(game).length).toBeLessThan(4000);
  });
});
