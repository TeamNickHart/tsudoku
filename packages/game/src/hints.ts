import { CELL_COUNT, SIZE, Solver, removeCandidates } from '@tsudoku/core';
import type { Grid, Hint } from '@tsudoku/core';
import { applyMove, toGrid } from './game.js';
import { includedNotes } from './types.js';
import type { Decoration, GameState } from './types.js';

/**
 * The board as the player has worked it out: placed values, plus the
 * candidates they have *correctly* ruled out.
 *
 * `toGrid` derives candidates from values alone, so a solver run on it knows
 * nothing of the player's strikes. That made hints repeat work already done —
 * a Pointing the player had applied by striking its eliminations was offered
 * again, and anything that only appears *after* those eliminations stayed
 * hidden behind it.
 *
 * What counts as ruled out follows the candidate layer's rule (see CellNotes):
 * a struck digit, and — in a cell where the player has noted candidates — any
 * digit not among them. Only eliminations of digits that are *not* the cell's
 * answer are passed on. Those are true facts, so the solver's reasoning stays
 * sound; a mistaken strike of the real answer is simply ignored rather than
 * sending the hint down a false line.
 */
export function toPlayerGrid(state: GameState): Grid {
  const eliminations: { cell: number; digit: number }[] = [];
  for (let cell = 0; cell < CELL_COUNT; cell++) {
    const notes = state.notes[cell];
    if (state.entries[cell] !== null || notes === undefined) continue;
    const answer = Number(state.solution[cell]);
    const noted = includedNotes(notes);
    for (let digit = 1; digit <= SIZE; digit++) {
      if (digit === answer) continue;
      const struck = notes.excluded.includes(digit);
      const leftOut = noted.length > 0 && !noted.includes(digit);
      if (struck || leftOut) eliminations.push({ cell, digit });
    }
  }
  return removeCandidates(toGrid(state), eliminations);
}

/**
 * Ask the engine what to do next on the current board.
 *
 * Returns null when no implemented technique applies — which means either the
 * board is solved, or it needs a technique beyond the current phase. The UI
 * should distinguish those; `isSolved` answers the first.
 *
 * Note this reads the *player's* board, not the original puzzle: their entries
 * (including wrong ones — check `errorCells` if that matters) and the
 * candidates they have correctly ruled out (see `toPlayerGrid`), so it never
 * offers a step they have already taken.
 */
export function nextHint(state: GameState): Hint | null {
  return new Solver().getNextHint(toPlayerGrid(state));
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
