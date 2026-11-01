import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  applyMoves,
  boardView,
  canRedo,
  canRestoreSavePoint,
  canUndo,
  clearDecorations,
  clearSavePoint,
  createGame,
  deadEndCells,
  digitCounts,
  errorCells,
  fillNotes,
  isSolvable,
  isSolved,
  hintProgress,
  nextHint,
  pendingHintDecorations,
  placeWithAutoSolve,
  presentHint,
  redo,
  remainingCount,
  resetGame,
  restoreSavePoint,
  selectCell,
  setDecorations,
  setSavePoint,
  setSelection,
  toggleCellSelection,
  toPlayerGrid,
  toggleNoteOnSelection,
  undo,
  undoUntilSolvable,
} from '@tsudoku/game';
import type { Hint } from '@tsudoku/core';
import type { AutoSolveScope, GameState, HintPresentation, Move, NoteKind } from '@tsudoku/game';

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
  /** `autoSolve` is how far a value placement auto-solves, or null when off. */
  | { type: 'digit'; digit: number; mode: InputMode; autoSolve: AutoSolveScope | null }
  | { type: 'erase' }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'setSavePoint' }
  | { type: 'restoreSavePoint' }
  | { type: 'clearSavePoint' }
  | { type: 'undoUntilSolvable' }
  | { type: 'reset' }
  | { type: 'fillNotes'; all?: boolean }
  | { type: 'showHint' };

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
    //
    // Filled cells are left out: a run is selected to be annotated, and a
    // filled cell takes no notes, so selecting it only adds noise.
    case 'setSelection':
      return setSelection(
        state,
        action.cells.filter((cell) => state.entries[cell] === null),
      );

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

        const placed =
          action.autoSolve === null
            ? applyMoves(cleared, [{ kind: 'setValue', cell, digit: action.digit }])
            : placeWithAutoSolve(cleared, cell, action.digit, action.autoSolve).state;
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
    case 'setSavePoint':
      return setSavePoint(state);
    case 'restoreSavePoint':
      return restoreSavePoint(clearDecorations(state));
    case 'clearSavePoint':
      return clearSavePoint(state);
    case 'undoUntilSolvable':
      return undoUntilSolvable(clearDecorations(state));
    case 'reset':
      return resetGame(state);

    // A lingering selection (and its peer shading) competes with the hint's
    // colours, so showing a hint clears it.
    case 'showHint':
      return setSelection(state, []);
  }
}

/** How long the note after "Undo until solvable" stays up. */
const RECOVERY_NOTE_MS = 3000;

/** How long auto-filled cells are pointed out after a placement. */
const AUTO_FILL_FLASH_MS = 1000;

/** How long a finished hint stays up, showing "Done", before it dismisses. */
const HINT_DONE_MS = 1200;

export function useGame(initialPuzzle: string) {
  const [state, dispatch] = useReducer(reducer, initialPuzzle, createGame);
  const [mode, setMode] = useState<InputMode>('value');
  /**
   * The hint being shown, if any — sticky until the player dismisses it or has
   * made every change it proposes.
   *
   * Its decorations are derived from the board on every render rather than
   * stored in game state: moves used to clear stored decorations, so the
   * highlights vanished the moment the player started acting on the hint.
   * Deriving them also lets each step drop off the board as it is made.
   */
  const [active, setActive] = useState<{ hint: Hint; presentation: HintPresentation } | null>(null);
  const progress = useMemo(
    () => (active === null ? null : hintProgress(state, active.hint)),
    [state, active],
  );

  const cells = useMemo(() => {
    if (active === null) return boardView(state);
    const pending = pendingHintDecorations(state, active.hint, active.presentation.decorations);
    return boardView(setDecorations(state, pending));
  }, [state, active]);
  const counts = useMemo(() => digitCounts(state), [state]);
  const errors = useMemo(() => errorCells(state), [state]);
  const solved = useMemo(() => isSolved(state), [state]);
  const remaining = useMemo(() => remainingCount(state), [state]);

  const requestHint = useCallback(() => {
    // Asking again while a hint is showing brings that hint back into focus
    // rather than finding a new one: a fresh search could land on a different
    // hint and abandon the one the player is half-way through.
    if (active === null) {
      const found = nextHint(state);
      // Presented against the same grid the hint was found on: the player's,
      // with their correct eliminations applied.
      setActive(
        found === null
          ? null
          : { hint: found, presentation: presentHint(found, toPlayerGrid(state)) },
      );
      if (found === null) return;
    }
    dispatch({ type: 'showHint' });
  }, [state, active]);

  const dismissHint = useCallback(() => {
    setActive(null);
  }, []);

  // Cells the latest placement filled by auto-solve, so the board can point
  // them out for a moment rather than have digits appear unexplained. Only a
  // *new* action counts — not undo or redo, which replay entries the player
  // has already seen. Those keep the same history array; a new action always
  // makes a new one (its length can stay the same when it replaces a redo
  // tail, so length is not the signal). The extra placements in the newest
  // entry are the fills.
  const [autoFilled, setAutoFilled] = useState<readonly number[]>([]);
  const seenHistory = useRef(state.history);
  useEffect(() => {
    const isNew = state.history !== seenHistory.current;
    seenHistory.current = state.history;
    const entry = state.history[state.historyIndex - 1];
    if (!isNew || entry === undefined || state.historyIndex !== state.history.length) return;
    const fills = entry.slice(1).flatMap((move) => (move.kind === 'setValue' ? [move.cell] : []));
    if (fills.length === 0) return;
    setAutoFilled(fills);
    const timer = setTimeout(() => setAutoFilled([]), AUTO_FILL_FLASH_MS);
    return () => clearTimeout(timer);
  }, [state.history, state.historyIndex]);

  /**
   * Recovering from a mistake: step back to the last solvable board.
   *
   * Asking is deliberate, so the answer may say whether there was a mistake
   * at all — "nothing to undo" — which the board otherwise never reveals.
   */
  const [recoveryNote, setRecoveryNote] = useState<string | null>(null);
  const recover = useCallback(() => {
    if (isSolvable(state)) {
      setRecoveryNote('No mistakes found — nothing to undo.');
      return;
    }
    const steps = state.historyIndex - undoUntilSolvable(state).historyIndex;
    dispatch({ type: 'undoUntilSolvable' });
    setRecoveryNote(
      `Undid ${steps} ${steps === 1 ? 'step' : 'steps'} back to the last solvable board.`,
    );
  }, [state]);
  useEffect(() => {
    if (recoveryNote === null) return;
    const timer = setTimeout(() => setRecoveryNote(null), RECOVERY_NOTE_MS);
    return () => clearTimeout(timer);
  }, [recoveryNote]);

  /**
   * An empty cell with no possible value left: the mistake is now plain to
   * see, so the app offers to recover. "Not now" keeps the offer away until
   * the board is fixed and then breaks again, rather than asking after every
   * move.
   */
  const deadEnd = useMemo(() => deadEndCells(state).length > 0, [state]);
  const [deadEndDeclined, setDeadEndDeclined] = useState(false);
  useEffect(() => {
    if (!deadEnd) setDeadEndDeclined(false);
  }, [deadEnd]);
  const declineRecovery = useCallback(() => setDeadEndDeclined(true), []);

  // Once every proposed change is made the hint has done its job: show it as
  // done for a beat, then leave hint mode. Undoing the last step inside that
  // beat cancels the dismissal, because progress is derived from the board.
  const complete = progress?.complete ?? false;
  useEffect(() => {
    if (!complete) return;
    const timer = setTimeout(() => setActive(null), HINT_DONE_MS);
    return () => clearTimeout(timer);
  }, [complete]);

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
    setActive(null);
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
    autoFilled,
    recover,
    recoveryNote,
    offerRecovery: deadEnd && !deadEndDeclined,
    declineRecovery,
    hint: active?.presentation ?? null,
    hintProgress: progress,
    requestHint,
    dismissHint,
    newGame,
    canUndo: canUndo(state),
    canRedo: canRedo(state),
    hasSavePoint: state.savePoint !== null,
    canRestoreSavePoint: canRestoreSavePoint(state),
    dispatch,
  };
}
