// @tsudoku/game — framework-free game state.
//
// This package must never import React (or any UI framework). It is what makes
// the web and React Native apps two renderings of one game rather than two
// implementations of it.

export type { CellValue, CellLock, CellView, GameState, Move } from './types.js';

export {
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
  toGrid,
  toPuzzleString,
  undo,
} from './game.js';

export { applyHintAsMove, hintHighlights, nextHint } from './hints.js';
