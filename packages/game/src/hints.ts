import { Solver } from '@tsudoku/core';
import type { Hint } from '@tsudoku/core';
import { applyMove } from './game.js';
import { toGrid } from './game.js';
import type { GameState } from './types.js';

/**
 * Ask the engine what to do next on the current board.
 *
 * Returns null when no implemented technique applies — which means either the
 * board is solved, or it needs a technique beyond the current phase. The UI
 * should distinguish those; `isSolved` answers the first.
 *
 * Note this reads the *player's* board, not the original puzzle, so it responds
 * to entries they have made — including wrong ones. A hint on a board with an
 * error may be nonsense; check `errorCells` first if that matters.
 */
export function nextHint(state: GameState): Hint | null {
  return new Solver().getNextHint(toGrid(state));
}

/**
 * Apply a hint's placement as a player move, so it lands in history and can be
 * undone like anything else.
 *
 * Only direct hints place a digit. Elimination hints remove candidates, which
 * has no effect on player state — the UI should present those as guidance
 * ("digit 4 can't go here") rather than as an action.
 */
export function applyHintAsMove(state: GameState, hint: Hint): GameState {
  if (hint.type !== 'direct') {
    return state;
  }
  return applyMove(state, { kind: 'setValue', cell: hint.cell, digit: hint.digit });
}

/** Cells a hint wants the UI to highlight. */
export function hintHighlights(hint: Hint): readonly number[] {
  return hint.involvedCells;
}
