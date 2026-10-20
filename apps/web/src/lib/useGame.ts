import { useCallback, useMemo, useReducer, useState } from 'react';
import type { Hint } from '@tsudoku/core';
import {
  applyMoves,
  boardView,
  canRedo,
  canUndo,
  clearDecorations,
  createGame,
  digitCounts,
  errorCells,
  fillNotes,
  hintDecorations,
  isSolved,
  nextHint,
  redo,
  remainingCount,
  resetGame,
  selectCell,
  setDecorations,
  setSelection,
  toggleCellSelection,
  toggleNoteOnSelection,
  undo,
} from '@tsudoku/game';
import type { GameState, Move, NoteKind } from '@tsudoku/game';

/**
 * The React binding for @tsudoku/game.
 *
 * Deliberately thin: it wires a reducer to React and derives view data. Every
 * decision about what a move *means* lives in @tsudoku/game, so React Native
 * can reuse all of it behind an identical hook.
 */

/** What digit entry does: place a value, or write a note, strike or scratch mark. */
export type InputMode = 'value' | 'note-included' | 'note-excluded' | 'note-scratch';

const NOTE_KIND: Record<Exclude<InputMode, 'value'>, NoteKind> = {
  'note-included': 'included',
  'note-excluded': 'excluded',
  'note-scratch': 'scratch',
};

type Action =
  | { type: 'newGame'; puzzle: string }
  | { type: 'select'; cell: number; additive: boolean; mode: InputMode }
  | { type: 'setSelection'; cells: readonly number[] }
  | { type: 'clearSelection' }
  | { type: 'digit'; digit: number; mode: InputMode }
  | { type: 'erase' }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'reset' }
  | { type: 'fillNotes'; all?: boolean }
  | { type: 'showHint'; hint: Hint }
  | { type: 'clearHint' };

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'newGame':
      return createGame(action.puzzle);

    // Value mode is single-select: you place one digit in one cell, so a
    // multi-selection has no meaning there and makes it far too easy to write
    // the same digit across a row by accident. Notes and strikes are the modes
    // where selecting a run is the whole point.
    case 'select':
      if (action.mode === 'value') {
        return selectCell(state, action.cell);
      }
      return action.additive
        ? toggleCellSelection(state, action.cell)
        : selectCell(state, action.cell);

    // Mode-agnostic on purpose. Only a drag dispatches this, and a drag always
    // means a multi-selection — App switches value mode to note mode in the
    // same update. Branching on the mode here was how a value-mode drag used
    // to collapse to a single cell: the action carried the mode from before
    // the switch.
    case 'setSelection':
      return setSelection(state, action.cells);

    case 'clearSelection':
      return selectCell(state, null);

    case 'digit': {
      if (state.selected.length === 0) return state;
      const cleared = clearDecorations(state);
      if (action.mode === 'value') {
        // Single cell by construction — value mode never builds a
        // multi-selection. Guarded anyway so a stale selection from another
        // mode cannot write a digit across several cells.
        const cell = state.selected[state.selected.length - 1];
        if (cell === undefined) return state;

        const placed = applyMoves(cleared, [{ kind: 'setValue', cell, digit: action.digit }]);
        // Nothing happened — the cell was locked or the move was rejected — so
        // leave the selection alone rather than clearing it for no reason.
        if (placed === cleared) return placed;

        // No refill here. Placing already removes the digit from every peer's
        // notes, and that is all a placement can change about the candidates.
        // Refilling the whole board after each placement used to resurrect
        // notes the player had deliberately removed.

        // Deselect after placing.
        //
        // Working through one digit means placing a 5, then looking for the
        // next 5. Keeping the cell selected leaves its peer highlighting on
        // top of the digit highlighting, which fights the scan. Clearing it
        // puts the board back to "here is where 5 can still go" — and the
        // digit stays focused, so that view survives the placement.
        return setSelection(placed, []);
      }
      // One press, one decision for the whole selection — see
      // toggleNoteOnSelection.
      return toggleNoteOnSelection(cleared, action.digit, NOTE_KIND[action.mode]);
    }

    case 'erase': {
      if (state.selected.length === 0) return state;
      // clearValue is a no-op on a placed cell — the game layer refuses it,
      // and undo is the way back from a placement. Still dispatched rather
      // than skipped, so a mixed selection erases the notes it can. One
      // action, so one undo restores everything it cleared.
      const moves = state.selected.flatMap((cell): Move[] => [
        { kind: 'clearValue', cell },
        { kind: 'clearNotes', cell },
      ]);
      return applyMoves(clearDecorations(state), moves);
    }

    case 'fillNotes':
      // Fill the selection if there is one, otherwise the whole board —
      // unless the caller asks for the whole board outright.
      return fillNotes(
        clearDecorations(state),
        !action.all && state.selected.length > 0 ? state.selected : undefined,
      );

    case 'undo':
      return undo(clearDecorations(state));
    case 'redo':
      return redo(clearDecorations(state));
    case 'reset':
      return resetGame(state);

    case 'showHint':
      return setDecorations(state, hintDecorations(action.hint));
    case 'clearHint':
      return clearDecorations(state);
  }
}

export function useGame(initialPuzzle: string) {
  const [state, dispatch] = useReducer(reducer, initialPuzzle, createGame);
  const [mode, setMode] = useState<InputMode>('value');
  const [hint, setHint] = useState<Hint | null>(null);

  const cells = useMemo(() => boardView(state), [state]);
  const counts = useMemo(() => digitCounts(state), [state]);
  const errors = useMemo(() => errorCells(state), [state]);
  const solved = useMemo(() => isSolved(state), [state]);
  const remaining = useMemo(() => remainingCount(state), [state]);

  const requestHint = useCallback(() => {
    const found = nextHint(state);
    setHint(found);
    if (found) dispatch({ type: 'showHint', hint: found });
  }, [state]);

  const dismissHint = useCallback(() => {
    setHint(null);
    dispatch({ type: 'clearHint' });
  }, []);

  /**
   * Switch input mode.
   *
   * Note and strike share a selection: having marked a run as "could be 3",
   * striking 7 across the same run is the obvious next thought, and making the
   * player redraw it would be busywork.
   *
   * Value clears the selection instead of collapsing it to one cell. A run has
   * no meaning in value mode, and silently keeping one of its cells selected
   * means the next digit press lands somewhere the player did not choose —
   * which is worse than starting clean.
   */
  const changeMode = useCallback((next: InputMode) => {
    setMode(next);
    if (next === 'value') {
      dispatch({ type: 'clearSelection' });
    }
  }, []);

  const newGame = useCallback((puzzle: string) => {
    setHint(null);
    setMode('value');
    dispatch({ type: 'newGame', puzzle });
  }, []);

  return {
    state,
    cells,
    counts,
    errors,
    solved,
    remaining,
    mode,
    setMode: changeMode,
    hint,
    requestHint,
    dismissHint,
    newGame,
    canUndo: canUndo(state),
    canRedo: canRedo(state),
    dispatch,
  };
}
