import { describe, expect, it } from 'vitest';
import {
  applyMove,
  applyToSelection,
  boardView,
  cellView,
  clearDecorations,
  createGame,
  digitCounts,
  fillNotes,
  hintDecorations,
  nextHint,
  remainingCount,
  selectCell,
  setDecorations,
  setSelection,
  toggleCellSelection,
  undo,
} from '../src/index.js';
import type { Decoration } from '../src/index.js';

const EASY = '530070000600195000098000060800060003400803001700020006060000280000419005000080079';
const BLANK = 2;

describe('excluded notes', () => {
  it('tracks included and excluded independently', () => {
    let game = createGame(EASY);
    game = applyMove(game, { kind: 'addNote', cell: BLANK, digit: 4, note: 'included' });
    game = applyMove(game, { kind: 'addNote', cell: BLANK, digit: 9, note: 'excluded' });

    expect(game.notes[BLANK]!.included).toEqual([4]);
    expect(game.notes[BLANK]!.excluded).toEqual([9]);
  });

  it('lets a digit be in both sets — a contradiction the player wrote down', () => {
    let game = createGame(EASY);
    game = applyMove(game, { kind: 'addNote', cell: BLANK, digit: 4, note: 'included' });
    game = applyMove(game, { kind: 'addNote', cell: BLANK, digit: 4, note: 'excluded' });

    // The model does not silently resolve this; the UI should surface it.
    expect(game.notes[BLANK]!.included).toEqual([4]);
    expect(game.notes[BLANK]!.excluded).toEqual([4]);
  });

  it('toggles a note off', () => {
    let game = createGame(EASY);
    game = applyMove(game, { kind: 'toggleNote', cell: BLANK, digit: 4, note: 'included' });
    expect(game.notes[BLANK]!.included).toEqual([4]);
    game = applyMove(game, { kind: 'toggleNote', cell: BLANK, digit: 4, note: 'included' });
    expect(game.notes[BLANK]!.included).toEqual([]);
  });

  it('clears both sets at once', () => {
    let game = createGame(EASY);
    game = applyMove(game, { kind: 'addNote', cell: BLANK, digit: 4, note: 'included' });
    game = applyMove(game, { kind: 'addNote', cell: BLANK, digit: 9, note: 'excluded' });
    game = applyMove(game, { kind: 'clearNotes', cell: BLANK });

    expect(game.notes[BLANK]!.included).toEqual([]);
    expect(game.notes[BLANK]!.excluded).toEqual([]);
  });

  it('survives undo', () => {
    let game = createGame(EASY);
    game = applyMove(game, { kind: 'addNote', cell: BLANK, digit: 4, note: 'excluded' });
    game = applyMove(game, { kind: 'addNote', cell: BLANK, digit: 7, note: 'excluded' });
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
    game = applyToSelection(game, (cell) => ({
      kind: 'addNote',
      cell,
      digit: 4,
      note: 'included',
    }));

    expect(game.notes[2]!.included).toEqual([4]);
    expect(game.notes[3]!.included).toEqual([4]);
    expect(game.notes[5]!.included).toEqual([4]);
    // One history entry per cell, so undo steps back one cell at a time.
    expect(game.history).toHaveLength(3);
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
    expect(game.notes[2]!.included).toEqual([4]);
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
    expect(before.notes.filter((n) => n.included.length > 0)).toHaveLength(0);

    const after = fillNotes(before);
    const filled = after.notes.filter((n) => n.included.length > 0);
    expect(filled.length).toBe(remainingCount(before));
  });

  it('never omits the digit that actually belongs there', () => {
    // Auto-notes come from the engine, so they are always a superset of truth.
    const game = fillNotes(createGame(EASY));
    for (let i = 0; i < 81; i++) {
      const notes = game.notes[i]!.included;
      if (notes.length > 0) {
        expect(notes).toContain(Number(game.solution[i]));
      }
    }
  });

  it('is undoable one cell at a time', () => {
    const game = fillNotes(createGame(EASY));
    const filled = game.notes.filter((n) => n.included.length > 0).length;
    const stepped = undo(game);
    expect(stepped.notes.filter((n) => n.included.length > 0).length).toBe(filled - 1);
  });

  it('only fills the selection when one exists', () => {
    let game = setSelection(createGame(EASY), [2, 3]);
    game = fillNotes(game, game.selected);
    expect(game.notes.filter((n) => n.included.length > 0)).toHaveLength(2);
  });

  it('leaves givens and filled cells alone', () => {
    const game = fillNotes(createGame(EASY));
    expect(game.notes[0]!.included).toHaveLength(0); // a given
  });

  it('preserves excluded notes', () => {
    let game = applyMove(createGame(EASY), {
      kind: 'addNote',
      cell: 2,
      digit: 9,
      note: 'excluded',
    });
    game = fillNotes(game, [2]);
    expect(game.notes[2]!.excluded).toEqual([9]);
    expect(game.notes[2]!.included.length).toBeGreaterThan(0);
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

    const notingBefore = game.notes.filter((n) => n.included.includes(digit)).length;
    expect(notingBefore).toBeGreaterThan(1);

    game = applyMove(game, { kind: 'setValue', cell, digit });

    // No peer should still be carrying an impossible auto note.
    expect(boardView(game).filter((v) => v.staleNotes.length > 0)).toHaveLength(0);
  });

  it('leaves other digits in peer notes alone', () => {
    let game = fillNotes(createGame(EASY));
    const { cell, digit } = firstEmpty(game);
    const peer = game.notes.findIndex(
      (n, i) => i !== cell && n.included.includes(digit) && n.included.length > 1,
    );
    const otherDigits = game.notes[peer]!.included.filter((d) => d !== digit);

    game = applyMove(game, { kind: 'setValue', cell, digit });

    for (const d of otherDigits) {
      expect(game.notes[peer]!.included).toContain(d);
    }
  });

  it('keeps a hand-written note and shows it stale instead', () => {
    // The distinction that matters: the app tidies its own bookkeeping, but
    // does not quietly correct the player's reasoning.
    let game = createGame(EASY);
    game = applyMove(game, { kind: 'addNote', cell: 2, digit: 4, note: 'included' });

    const rowPeer = [0, 1, 3, 4, 5, 6, 7, 8].find((i) => i !== 2 && game.entries[i] === null)!;
    game = applyMove(game, { kind: 'setValue', cell: rowPeer, digit: 4 });

    expect(game.notes[2]!.included).toContain(4);
    expect(cellView(game, 2).staleNotes).toContain(4);
  });

  it('treats a hand-touched auto note as the player own', () => {
    let game = fillNotes(createGame(EASY));
    const { cell, digit } = firstEmpty(game);
    const peer = game.notes.findIndex((n, i) => i !== cell && n.included.includes(digit));

    // Toggling it off and on again makes it a deliberate note.
    game = applyMove(game, { kind: 'toggleNote', cell: peer, digit, note: 'included' });
    game = applyMove(game, { kind: 'toggleNote', cell: peer, digit, note: 'included' });
    expect(game.notes[peer]!.auto).not.toContain(digit);

    game = applyMove(game, { kind: 'setValue', cell, digit });
    expect(game.notes[peer]!.included).toContain(digit);
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
    game = applyMove(game, { kind: 'addNote', cell: 2, digit: 7, note: 'included' });
    expect(game.notes[2]!.auto).not.toContain(7);

    game = fillNotes(game, [3]);
    expect(game.notes[3]!.auto).toEqual(game.notes[3]!.included);
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
