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
  | { type: 'select'; cell: number; additive: boolean }
  | { type: 'setSelection'; cells: readonly number[] }
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

    case 'select':
      return action.additive
        ? toggleCellSelection(state, action.cell)
        : selectCell(state, action.cell);

    case 'setSelection':
      return setSelection(state, action.cells);

    case 'clearSelection':
      return selectCell(state, null);

    case 'digit': {
      if (state.selected.length === 0) return state;
      const cleared = clearDecorations(state);
      if (action.mode === 'value') {
        // Entering a value is single-cell by nature; apply to each selected.
        return applyToSelection(cleared, (cell) => ({
          kind: 'setValue',
          cell,
          digit: action.digit,
        }));
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
    setMode,
    hint,
    requestHint,
    dismissHint,
    newGame,
    canUndo: canUndo(state),
    canRedo: canRedo(state),
    dispatch,
  };
}
