import { Solver } from '@tsudoku/core';
import type { Hint } from '@tsudoku/core';
import { applyMove, toGrid } from './game.js';
import type { Decoration, GameState } from './types.js';

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

/**
 * Translate a hint into decorations.
 *
 * This is the seam that makes hints, tutorials and player highlighting one
 * mechanism: a tutorial step emits the same `Decoration[]` shape, so the UI
 * needs no special case for "this highlight came from a hint".
 */
export function hintDecorations(hint: Hint): readonly Decoration[] {
  const out: Decoration[] = [];

  if (hint.type === 'direct') {
    out.push({
      target: { kind: 'cell', cell: hint.cell },
      role: 'primary',
      note: hint.explanation,
    });
  } else {
    for (const elimination of hint.eliminations) {
      out.push({
        target: { kind: 'note', cell: elimination.cell, digit: elimination.digit },
        role: 'eliminated',
        note: hint.explanation,
      });
    }
  }

  const primaryCell = hint.type === 'direct' ? hint.cell : -1;
  for (const cell of hint.involvedCells) {
    if (cell !== primaryCell) {
      out.push({ target: { kind: 'cell', cell }, role: 'supporting' });
    }
  }

  return out;
}
