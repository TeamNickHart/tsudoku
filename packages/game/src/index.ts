// @tsudoku/game — framework-free game state.
//
// This package must never import React (or any UI framework). It is what makes
// the web and React Native apps two renderings of one game rather than two
// implementations of it.

export { includedNotes } from './types.js';

export type {
  CellLock,
  CellNotes,
  CellValue,
  CellView,
  Decoration,
  DecorationRole,
  DecorationTarget,
  GameState,
  HistoryEntry,
  Move,
  NoteKind,
} from './types.js';

export {
  InvalidPuzzleError,
  applyMove,
  applyMoves,
  applyToSelection,
  boardView,
  canRedo,
  canRestoreSavePoint,
  canUndo,
  cellView,
  clearDecorations,
  clearSavePoint,
  createGame,
  digitCounts,
  errorCells,
  fillNotes,
  impossibleDigits,
  isDigitPlacedInPeer,
  isGiven,
  isLocked,
  isSolved,
  redo,
  remainingCount,
  resetGame,
  restoreSavePoint,
  selectCell,
  setDecorations,
  setSavePoint,
  setSelection,
  toGrid,
  toggleCellSelection,
  toggleNoteOnSelection,
  toPuzzleString,
  undo,
} from './game.js';

export { applyHintAsMove, hintDecorations, hintHighlights, nextHint } from './hints.js';

export { explain, explainOrSummarise, explainHiddenSingle, hasLesson } from './tutor/index.js';
export type { Lesson, LessonStep } from './tutor/index.js';
