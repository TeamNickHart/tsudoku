import { useCallback, useMemo, useReducer, useState } from 'react';
import type { Hint } from '@tsudoku/core';
import {
  applyMove,
  applyToSelection,
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
  undo,
} from '@tsudoku/game';
import type { GameState, NoteKind } from '@tsudoku/game';

/**
 * The React binding for @tsudoku/game.
 *
 * Deliberately thin: it wires a reducer to React and derives view data. Every
 * decision about what a move *means* lives in @tsudoku/game, so React Native
 * can reuse all of it behind an identical hook.
 */

/** What digit entry does: place a value, or write a note. */
export type InputMode = 'value' | 'note-included' | 'note-excluded';

type Action =
  | { type: 'newGame'; puzzle: string }
  | { type: 'select'; cell: number; additive: boolean; mode: InputMode }
  | { type: 'setSelection'; cells: readonly number[]; mode: InputMode }
  | { type: 'clearSelection' }
  | { type: 'digit'; digit: number; mode: InputMode }
  | { type: 'erase' }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'reset' }
  | { type: 'fillNotes' }
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

    case 'setSelection':
      if (action.mode === 'value') {
        // A drag in value mode selects only where it ended.
        const last = action.cells[action.cells.length - 1];
        return last === undefined ? state : selectCell(state, last);
      }
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
        return applyMove(cleared, { kind: 'setValue', cell, digit: action.digit });
      }
      const note: NoteKind = action.mode === 'note-included' ? 'included' : 'excluded';
      return applyToSelection(cleared, (cell) => ({
        kind: 'toggleNote',
        cell,
        digit: action.digit,
        note,
      }));
    }

    case 'erase': {
      if (state.selected.length === 0) return state;
      let next = clearDecorations(state);
      for (const cell of next.selected) {
        next = applyMove(next, { kind: 'clearValue', cell });
        next = applyMove(next, { kind: 'clearNotes', cell });
      }
      return next;
    }

    case 'fillNotes':
      // Fill the selection if there is one, otherwise the whole board.
      return fillNotes(
        clearDecorations(state),
        state.selected.length > 0 ? state.selected : undefined,
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
   * Switch input mode, collapsing a multi-selection when entering value mode.
   *
   * Without this, selecting a run in note mode and then switching to value
   * would leave a selection that value mode cannot meaningfully act on.
   */
  const changeMode = useCallback(
    (next: InputMode) => {
      setMode(next);
      if (next === 'value' && state.selected.length > 1) {
        const last = state.selected[state.selected.length - 1]!;
        dispatch({ type: 'select', cell: last, additive: false, mode: next });
      }
    },
    [state.selected],
  );

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
