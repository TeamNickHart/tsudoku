import { describe, expect, it } from 'vitest';
import {
  setSavePoint,
  restoreSavePoint,
  resetGame,
  redo,
  clearSavePoint,
  canRestoreSavePoint,
  applyMove,
  applyToSelection,
  boardView,
  cellView,
  clearDecorations,
  createGame,
  digitCounts,
  fillNotes,
  includedNotes,
  hintDecorations,
  nextHint,
  remainingCount,
  selectCell,
  setDecorations,
  setSelection,
  toggleCellSelection,
  toggleNoteOnSelection,
  undo,
} from '../src/index.js';
import type { Decoration } from '../src/index.js';

const EASY = '530070000600195000098000060800060003400803001700020006060000280000419005000080079';
const BLANK = 2;

describe('excluded notes', () => {
  it('tracks included and excluded independently', () => {
    let game = createGame(EASY);
    game = applyMove(game, { kind: 'addNote', cell: BLANK, digit: 4, note: 'included' });
    game = applyMove(game, { kind: 'addNote', cell: BLANK, digit: 2, note: 'excluded' });

    expect(includedNotes(game.notes[BLANK]!)).toEqual([4]);
    expect(game.notes[BLANK]!.excluded).toEqual([2]);
  });

  it('keeps note and strike exclusive — switching type replaces the mark', () => {
    let game = createGame(EASY);
    game = applyMove(game, { kind: 'addNote', cell: BLANK, digit: 4, note: 'included' });
    game = applyMove(game, { kind: 'addNote', cell: BLANK, digit: 4, note: 'excluded' });
    expect(includedNotes(game.notes[BLANK]!)).toEqual([]);
    expect(game.notes[BLANK]!.excluded).toEqual([4]);

    game = applyMove(game, { kind: 'addNote', cell: BLANK, digit: 4, note: 'included' });
    expect(includedNotes(game.notes[BLANK]!)).toEqual([4]);
    expect(game.notes[BLANK]!.excluded).toEqual([]);
  });

  it('clears a mark when the same type is repeated, without resurrecting a note', () => {
    let game = fillNotes(createGame(EASY));
    const digit = game.notes[BLANK]!.auto[0]!;
    const strike = { kind: 'toggleNote', cell: BLANK, digit, note: 'excluded' } as const;
    game = applyMove(game, strike);
    expect(game.notes[BLANK]!.excluded).toEqual([digit]);

    // Strike → strike again → unmarked. The auto note it replaced is gone.
    game = applyMove(game, strike);
    expect(game.notes[BLANK]!.excluded).toEqual([]);
    expect(includedNotes(game.notes[BLANK]!)).not.toContain(digit);
  });

  it('keeps scratch marks independent of notes and strikes', () => {
    let game = createGame(EASY);
    game = applyMove(game, { kind: 'addNote', cell: BLANK, digit: 4, note: 'included' });
    game = applyMove(game, { kind: 'addNote', cell: BLANK, digit: 2, note: 'excluded' });
    game = applyMove(game, { kind: 'addNote', cell: BLANK, digit: 4, note: 'scratch' });
    game = applyMove(game, { kind: 'addNote', cell: BLANK, digit: 2, note: 'scratch' });
    expect(game.notes[BLANK]!.scratch).toEqual([2, 4]);
    expect(includedNotes(game.notes[BLANK]!)).toEqual([4]);
    expect(game.notes[BLANK]!.excluded).toEqual([2]);

    game = applyMove(game, { kind: 'toggleNote', cell: BLANK, digit: 4, note: 'scratch' });
    expect(game.notes[BLANK]!.scratch).toEqual([2]);
    expect(includedNotes(game.notes[BLANK]!)).toEqual([4]);
  });

  it('leaves scratch alone when Auto-notes runs', () => {
    let game = applyMove(createGame(EASY), {
      kind: 'addNote',
      cell: BLANK,
      digit: 4,
      note: 'scratch',
    });
    game = fillNotes(game);
    expect(game.notes[BLANK]!.scratch).toEqual([4]);
  });

  it('toggles a note off', () => {
    let game = createGame(EASY);
    game = applyMove(game, { kind: 'toggleNote', cell: BLANK, digit: 4, note: 'included' });
    expect(includedNotes(game.notes[BLANK]!)).toEqual([4]);
    game = applyMove(game, { kind: 'toggleNote', cell: BLANK, digit: 4, note: 'included' });
    expect(includedNotes(game.notes[BLANK]!)).toEqual([]);
  });

  it('clears both sets at once', () => {
    let game = createGame(EASY);
    game = applyMove(game, { kind: 'addNote', cell: BLANK, digit: 4, note: 'included' });
    game = applyMove(game, { kind: 'addNote', cell: BLANK, digit: 2, note: 'excluded' });
    game = applyMove(game, { kind: 'clearNotes', cell: BLANK });

    expect(includedNotes(game.notes[BLANK]!)).toEqual([]);
    expect(game.notes[BLANK]!.excluded).toEqual([]);
  });

  it('survives undo', () => {
    let game = createGame(EASY);
    game = applyMove(game, { kind: 'addNote', cell: BLANK, digit: 4, note: 'excluded' });
    game = applyMove(game, { kind: 'addNote', cell: BLANK, digit: 1, note: 'excluded' });
    game = undo(game);
    expect(game.notes[BLANK]!.excluded).toEqual([4]);
  });
});

describe('multi-select', () => {
  it('toggles cells in and out of the selection', () => {
    let game = createGame(EASY);
    game = toggleCellSelection(game, 2);
    game = toggleCellSelection(game, 3);
    expect(game.selected).toEqual([2, 3]);

    game = toggleCellSelection(game, 2);
    expect(game.selected).toEqual([3]);
  });

  it('replaces the whole selection', () => {
    let game = createGame(EASY);
    game = setSelection(game, [2, 3, 5]);
    expect(game.selected).toEqual([2, 3, 5]);
  });

  it('drops out-of-range cells', () => {
    let game = createGame(EASY);
    game = setSelection(game, [2, 999, 5]);
    expect(game.selected).toEqual([2, 5]);
  });

  it('selectCell collapses to a single cell', () => {
    let game = createGame(EASY);
    game = setSelection(game, [2, 3, 5]);
    game = selectCell(game, 7);
    expect(game.selected).toEqual([7]);
  });

  it('applies a note to every selected cell', () => {
    let game = createGame(EASY);
    game = setSelection(game, [2, 3, 5]);
    // 2 is the only digit no peer of any of these three cells holds, so it is
    // the only one this can note across all of them.
    game = applyToSelection(game, (cell) => ({
      kind: 'addNote',
      cell,
      digit: 2,
      note: 'included',
    }));

    expect(includedNotes(game.notes[2]!)).toEqual([2]);
    expect(includedNotes(game.notes[3]!)).toEqual([2]);
    expect(includedNotes(game.notes[5]!)).toEqual([2]);
    // One action, one history entry: undo takes back the whole selection.
    expect(game.history).toHaveLength(1);
    expect(undo(game).notes.every((n) => includedNotes(n).length === 0)).toBe(true);
  });

  it('decides add-or-clear once for the whole selection', () => {
    let game = createGame(EASY);
    game = setSelection(game, [2, 3, 5]);
    game = applyMove(game, { kind: 'addNote', cell: 3, digit: 2, note: 'included' });

    // Some have it, some do not: the press adds it everywhere...
    game = toggleNoteOnSelection(game, 2, 'included');
    for (const cell of [2, 3, 5]) expect(includedNotes(game.notes[cell]!)).toEqual([2]);

    // ...and once all have it, the press clears it everywhere, in one step.
    const before = game.history.length;
    game = toggleNoteOnSelection(game, 2, 'included');
    for (const cell of [2, 3, 5]) expect(includedNotes(game.notes[cell]!)).toEqual([]);
    expect(game.history.length).toBe(before + 1);
  });

  it('ignores cells that cannot take the mark when deciding', () => {
    let game = createGame(EASY);
    // Cell 0 is a given; in cell 2, 5 is already placed in the row.
    game = setSelection(game, [0, 2, 3]);
    game = toggleNoteOnSelection(game, 5, 'excluded');
    expect(game.notes[2]!.excluded).toEqual([]);
    expect(game.notes[3]!.excluded).toEqual([]);
    game = setSelection(game, [2, 3]);
    game = toggleNoteOnSelection(game, 2, 'excluded');
    expect(game.notes[2]!.excluded).toEqual([2]);
    expect(game.notes[3]!.excluded).toEqual([2]);
  });

  it('skips givens when applying to a selection', () => {
    let game = createGame(EASY);
    game = setSelection(game, [0, 2]); // 0 is a given
    game = applyToSelection(game, (cell) => ({
      kind: 'addNote',
      cell,
      digit: 4,
      note: 'included',
    }));
    expect(game.history).toHaveLength(1);
    expect(includedNotes(game.notes[2]!)).toEqual([4]);
  });

  it('reports selection in the cell view', () => {
    let game = createGame(EASY);
    game = setSelection(game, [2, 3]);
    expect(cellView(game, 2).isSelected).toBe(true);
    expect(cellView(game, 4).isSelected).toBe(false);
  });
});

describe('decorations', () => {
  it('attaches roles to a cell', () => {
    const decorations: Decoration[] = [
      { target: { kind: 'cell', cell: 2 }, role: 'primary', note: 'because' },
    ];
    const game = setDecorations(createGame(EASY), decorations);
    expect(cellView(game, 2).roles).toEqual(['primary']);
    expect(cellView(game, 3).roles).toEqual([]);
  });

  it('attaches roles to individual notes', () => {
    const decorations: Decoration[] = [
      { target: { kind: 'note', cell: 2, digit: 7 }, role: 'eliminated' },
    ];
    const game = setDecorations(createGame(EASY), decorations);
    expect(cellView(game, 2).noteRoles[7]).toEqual(['eliminated']);
    expect(cellView(game, 2).noteRoles[4]).toBeUndefined();
  });

  it('is not part of history — undo does not clear a tutorial', () => {
    let game = createGame(EASY);
    game = applyMove(game, { kind: 'setValue', cell: BLANK, digit: 4 });
    game = setDecorations(game, [{ target: { kind: 'cell', cell: 5 }, role: 'primary' }]);
    game = undo(game);
    expect(game.decorations).toHaveLength(1);
  });

  it('clears', () => {
    let game = setDecorations(createGame(EASY), [
      { target: { kind: 'cell', cell: 2 }, role: 'primary' },
    ]);
    game = clearDecorations(game);
    expect(game.decorations).toEqual([]);
  });

  it('builds decorations from a hint', () => {
    const game = createGame(EASY);
    const hint = nextHint(game)!;
    const decorations = hintDecorations(hint);

    expect(decorations.length).toBeGreaterThan(0);
    const primary = decorations.filter((d) => d.role === 'primary');
    expect(primary).toHaveLength(1);
    expect(primary[0]!.note).toBe(hint.explanation);
  });
});

describe('digitCounts', () => {
  it('counts placed digits', () => {
    const game = createGame(EASY);
    const counts = digitCounts(game);
    const placed = EASY.split('').filter((c) => c === '5').length;
    expect(counts[5]).toBe(placed);
  });

  it('reaches 9 for a completed digit', () => {
    let game = createGame(EASY);
    for (let i = 0; i < 81; i++) {
      if (game.entries[i] === null && game.solution[i] === '5') {
        game = applyMove(game, { kind: 'setValue', cell: i, digit: 5 });
      }
    }
    expect(digitCounts(game)[5]).toBe(9);
  });
});

describe('boardView', () => {
  it('returns a view per cell', () => {
    const views = boardView(createGame(EASY));
    expect(views).toHaveLength(81);
    expect(views[0]!.lock).toBe('given');
    expect(views[BLANK]!.lock).toBe('editable');
  });
});

describe('fillNotes (auto-notes)', () => {
  it('fills every empty cell with the engine candidates', () => {
    const before = createGame(EASY);
    expect(before.notes.filter((n) => includedNotes(n).length > 0)).toHaveLength(0);

    const after = fillNotes(before);
    const filled = after.notes.filter((n) => includedNotes(n).length > 0);
    expect(filled.length).toBe(remainingCount(before));
  });

  it('never omits the digit that actually belongs there', () => {
    // Auto-notes come from the engine, so they are always a superset of truth.
    const game = fillNotes(createGame(EASY));
    for (let i = 0; i < 81; i++) {
      const notes = includedNotes(game.notes[i]!);
      if (notes.length > 0) {
        expect(notes).toContain(Number(game.solution[i]));
      }
    }
  });

  it('leaves no history entry when nothing would change', () => {
    const game = fillNotes(createGame(EASY));
    expect(fillNotes(game)).toBe(game);
  });

  it('is undone in one step', () => {
    const game = fillNotes(createGame(EASY));
    expect(game.history).toHaveLength(1);
    expect(undo(game).notes.every((n) => includedNotes(n).length === 0)).toBe(true);
  });

  it('re-adds a note the player removed, but not one they struck', () => {
    let game = fillNotes(createGame(EASY));
    const [removed, struck] = game.notes[BLANK]!.auto;
    if (removed === undefined || struck === undefined) throw new Error('fixture');
    game = applyMove(game, { kind: 'toggleNote', cell: BLANK, digit: removed, note: 'included' });
    game = applyMove(game, { kind: 'toggleNote', cell: BLANK, digit: struck, note: 'excluded' });
    expect(includedNotes(game.notes[BLANK]!)).not.toContain(removed);

    game = fillNotes(game);
    expect(includedNotes(game.notes[BLANK]!)).toContain(removed);
    expect(includedNotes(game.notes[BLANK]!)).not.toContain(struck);
    expect(game.notes[BLANK]!.excluded).toContain(struck);
  });

  it('only fills the selection when one exists', () => {
    let game = setSelection(createGame(EASY), [2, 3]);
    game = fillNotes(game, game.selected);
    expect(game.notes.filter((n) => includedNotes(n).length > 0)).toHaveLength(2);
  });

  it('leaves givens and filled cells alone', () => {
    const game = fillNotes(createGame(EASY));
    expect(includedNotes(game.notes[0]!)).toHaveLength(0); // a given
  });

  it('preserves excluded notes', () => {
    let game = applyMove(createGame(EASY), {
      kind: 'addNote',
      cell: 2,
      digit: 2,
      note: 'excluded',
    });
    game = fillNotes(game, [2]);
    expect(game.notes[2]!.excluded).toEqual([2]);
    expect(includedNotes(game.notes[2]!).length).toBeGreaterThan(0);
  });
});

describe('auto-clearing notes on placement', () => {
  /** The first empty cell, and the digit that truly belongs there. */
  function firstEmpty(game: ReturnType<typeof createGame>): { cell: number; digit: number } {
    const cell = game.entries.findIndex((v) => v === null);
    return { cell, digit: Number(game.solution[cell]) };
  }

  it('silently removes the placed digit from auto notes in peers', () => {
    let game = fillNotes(createGame(EASY));
    const { cell, digit } = firstEmpty(game);

    const notingBefore = game.notes.filter((n) => includedNotes(n).includes(digit)).length;
    expect(notingBefore).toBeGreaterThan(1);

    game = applyMove(game, { kind: 'setValue', cell, digit });

    // No peer should still be carrying an impossible auto note.
    expect(boardView(game).filter((v) => v.staleNotes.length > 0)).toHaveLength(0);
  });

  it('leaves other digits in peer notes alone', () => {
    let game = fillNotes(createGame(EASY));
    const { cell, digit } = firstEmpty(game);
    const peer = game.notes.findIndex(
      (n, i) => i !== cell && includedNotes(n).includes(digit) && includedNotes(n).length > 1,
    );
    const otherDigits = includedNotes(game.notes[peer]!).filter((d) => d !== digit);

    game = applyMove(game, { kind: 'setValue', cell, digit });

    for (const d of otherDigits) {
      expect(includedNotes(game.notes[peer]!)).toContain(d);
    }
  });

  it('removes hand-written notes for the placed digit from peers too', () => {
    // The candidate layer is canonical, so it must not keep a candidate that a
    // placed digit now rules out — whoever wrote it.
    let game = createGame(EASY);
    game = applyMove(game, { kind: 'addNote', cell: 2, digit: 4, note: 'included' });

    const rowPeer = [0, 1, 3, 4, 5, 6, 7, 8].find((i) => game.entries[i] === null);
    if (rowPeer === undefined) throw new Error('fixture');
    game = applyMove(game, { kind: 'setValue', cell: rowPeer, digit: 4 });

    expect(includedNotes(game.notes[2]!)).not.toContain(4);
  });

  it('leaves strikes and scratch in peers alone', () => {
    let game = createGame(EASY);
    game = applyMove(game, { kind: 'addNote', cell: 2, digit: 4, note: 'excluded' });
    // R1C7: no 4 in its row, column or box, so it can take the mark.
    game = applyMove(game, { kind: 'addNote', cell: 6, digit: 4, note: 'scratch' });
    expect(game.notes[6]!.scratch).toEqual([4]);

    game = applyMove(game, { kind: 'setValue', cell: 5, digit: 4 });

    expect(game.notes[2]!.excluded).toEqual([4]);
    expect(game.notes[6]!.scratch).toEqual([4]);
  });

  it('restores cleared notes on undo', () => {
    const game = fillNotes(createGame(EASY));
    const { cell, digit } = firstEmpty(game);
    const before = JSON.stringify(game.notes);

    const placed = applyMove(game, { kind: 'setValue', cell, digit });
    expect(JSON.stringify(placed.notes)).not.toBe(before);

    expect(JSON.stringify(undo(placed).notes)).toBe(before);
  });

  it('marks auto-filled notes as auto and hand-written ones as not', () => {
    let game = createGame(EASY);
    game = applyMove(game, { kind: 'addNote', cell: 2, digit: 1, note: 'included' });
    expect(game.notes[2]!.auto).not.toContain(7);

    game = fillNotes(game, [3]);
    expect(game.notes[3]!.auto).toEqual(includedNotes(game.notes[3]!));
  });

  it('leaves strikes alone', () => {
    // A strike is a deliberate annotation; a placement makes it redundant
    // rather than wrong, so it stays.
    let game = createGame(EASY);
    game = applyMove(game, { kind: 'addNote', cell: 2, digit: 4, note: 'excluded' });
    const rowPeer = [0, 1, 3, 4, 5, 6, 7, 8].find((i) => i !== 2 && game.entries[i] === null)!;
    game = applyMove(game, { kind: 'setValue', cell: rowPeer, digit: 4 });

    expect(game.notes[2]!.excluded).toContain(4);
  });
});

describe('note sets stay disjoint', () => {
  it('toggling one note off does not take ownership of the others', () => {
    // Regression: withNote used to receive the whole replacement set and treat
    // every digit in it as manual, so removing one note silently promoted
    // every other note in that cell out of `auto`.
    let game = fillNotes(createGame(EASY));
    const cell = game.notes.findIndex((n) => n.auto.length > 2);
    const before = game.notes[cell]!.auto;
    const target = before[0]!;

    game = applyMove(game, { kind: 'toggleNote', cell, digit: target, note: 'included' });

    expect(game.notes[cell]!.auto).toEqual(before.filter((d) => d !== target));
    expect(game.notes[cell]!.manual).toEqual([]);
  });

  it('never holds the same digit in auto and manual', () => {
    let game = fillNotes(createGame(EASY));
    const cell = game.notes.findIndex((n) => n.auto.length > 0);
    const digit = game.notes[cell]!.auto[0]!;

    // Writing it by hand moves it out of auto rather than duplicating it.
    game = applyMove(game, { kind: 'toggleNote', cell, digit, note: 'included' });
    game = applyMove(game, { kind: 'toggleNote', cell, digit, note: 'included' });

    expect(game.notes[cell]!.manual).toContain(digit);
    expect(game.notes[cell]!.auto).not.toContain(digit);
  });

  it('auto-fill skips digits the player already noted', () => {
    let game = createGame(EASY);
    game = applyMove(game, { kind: 'addNote', cell: 2, digit: 4, note: 'included' });
    game = fillNotes(game, [2]);

    expect(game.notes[2]!.manual).toContain(4);
    expect(game.notes[2]!.auto).not.toContain(4);
    // And it still appears once in the combined view.
    expect(includedNotes(game.notes[2]!).filter((d) => d === 4)).toHaveLength(1);
  });

  it('includedNotes merges both sources without duplicates', () => {
    let game = fillNotes(createGame(EASY));
    const cell = game.notes.findIndex((n) => n.auto.length > 1);
    const extra = [1, 2, 3, 4, 5, 6, 7, 8, 9].find((d) => !game.notes[cell]!.auto.includes(d))!;
    game = applyMove(game, { kind: 'addNote', cell, digit: extra, note: 'included' });

    const merged = includedNotes(game.notes[cell]!);
    expect(new Set(merged).size).toBe(merged.length);
    expect(merged).toEqual([...merged].sort((a, b) => a - b));
  });
});

describe('save point', () => {
  /** Values and every kind of mark — what "exactly as it was" means. */
  function board(game: ReturnType<typeof createGame>): string {
    return JSON.stringify({ entries: game.entries, notes: game.notes });
  }

  /** A game with a value, a note, a strike and a scratch mark on it. */
  function marked(): ReturnType<typeof createGame> {
    let game = fillNotes(createGame(EASY));
    game = applyMove(game, { kind: 'setValue', cell: 2, digit: 4 });
    game = applyMove(game, { kind: 'addNote', cell: 3, digit: 2, note: 'included' });
    game = applyMove(game, { kind: 'addNote', cell: 5, digit: 2, note: 'excluded' });
    game = applyMove(game, { kind: 'addNote', cell: 6, digit: 2, note: 'scratch' });
    return game;
  }

  it('restores values and every kind of mark exactly', () => {
    let game = setSavePoint(marked());
    const saved = board(game);

    game = applyMove(game, { kind: 'setValue', cell: 3, digit: 2 });
    game = applyMove(game, { kind: 'addNote', cell: 6, digit: 2, note: 'scratch' });
    game = applyMove(game, { kind: 'addNote', cell: 7, digit: 1, note: 'excluded' });
    game = fillNotes(game);
    expect(board(game)).not.toBe(saved);

    game = restoreSavePoint(game);
    expect(board(game)).toBe(saved);
  });

  it('keeps the save point after returning, so another attempt can start there', () => {
    let game = setSavePoint(marked());
    const point = game.savePoint;
    game = applyMove(game, { kind: 'setValue', cell: 3, digit: 2 });
    game = restoreSavePoint(game);
    expect(game.savePoint).toBe(point);

    game = applyMove(game, { kind: 'setValue', cell: 3, digit: 9 });
    expect(game.savePoint).toBe(point);
    expect(board(restoreSavePoint(game))).toBe(board(setSavePoint(marked())));
  });

  it('lets redo bring the abandoned attempt back', () => {
    let game = setSavePoint(marked());
    game = applyMove(game, { kind: 'setValue', cell: 3, digit: 2 });
    const attempt = board(game);
    game = redo(restoreSavePoint(game));
    expect(board(game)).toBe(attempt);
  });

  it('does nothing without a save point, or when already there', () => {
    const game = marked();
    expect(restoreSavePoint(game)).toBe(game);
    expect(canRestoreSavePoint(game)).toBe(false);
    const saved = setSavePoint(game);
    expect(canRestoreSavePoint(saved)).toBe(false);
    expect(restoreSavePoint(saved)).toBe(saved);
  });

  it('is forgotten when cleared, or on reset', () => {
    let game = setSavePoint(marked());
    game = applyMove(game, { kind: 'setValue', cell: 3, digit: 2 });
    expect(canRestoreSavePoint(game)).toBe(true);
    expect(clearSavePoint(game).savePoint).toBeNull();
    expect(resetGame(game).savePoint).toBeNull();
  });

  it('is dropped when a new action replaces the history it pointed into', () => {
    let game = setSavePoint(marked());
    game = undo(undo(game));
    expect(game.savePoint).not.toBeNull();
    // Undoing past the save point is fine on its own...
    game = applyMove(game, { kind: 'setValue', cell: 7, digit: 1 });
    // ...but acting from there discards the moves it needed.
    expect(game.savePoint).toBeNull();
  });
});
