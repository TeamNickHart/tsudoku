// @tsudoku/game — framework-free game state.
//
// This package must never import React (or any UI framework). It is what makes
// the web and React Native apps two renderings of one game rather than two
// implementations of it.

export type {
  CellLock,
  CellNotes,
  CellValue,
  CellView,
  Decoration,
  DecorationRole,
  DecorationTarget,
  GameState,
  Move,
  NoteKind,
} from './types.js';

export {
  InvalidPuzzleError,
  applyMove,
  applyToSelection,
  boardView,
  canRedo,
  canUndo,
  cellView,
  clearDecorations,
  createGame,
  digitCounts,
  errorCells,
  fillNotes,
  isGiven,
  isSolved,
  redo,
  remainingCount,
  resetGame,
  selectCell,
  setDecorations,
  setSelection,
  toGrid,
  toggleCellSelection,
  toPuzzleString,
  undo,
} from './game.js';

export { applyHintAsMove, hintDecorations, hintHighlights, nextHint } from './hints.js';
