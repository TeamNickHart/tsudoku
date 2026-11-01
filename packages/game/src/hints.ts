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
    if (state.entries[cell] !== null) continue;
    const answer = Number(state.solution[cell]);
    for (let digit = 1; digit <= SIZE; digit++) {
      if (digit !== answer && isRuledOut(state, cell, digit)) eliminations.push({ cell, digit });
    }
  }
  return removeCandidates(toGrid(state), eliminations);
}

/**
 * Whether the player has ruled `digit` out of an empty cell: struck it, or —
 * in a cell where they have noted candidates — left it out. The candidate
 * layer's own rule (see CellNotes).
 */
export function isRuledOut(state: GameState, cell: number, digit: number): boolean {
  const notes = state.notes[cell];
  if (notes === undefined) return false;
  if (notes.excluded.includes(digit)) return true;
  const noted = includedNotes(notes);
  return noted.length > 0 && !noted.includes(digit);
}

/** How far the player has got with what a hint proposes. */
export interface HintProgress {
  /** Steps the player has made. */
  readonly done: number;
  /** Steps the hint proposes: its eliminations, or its one placement. */
  readonly total: number;
  /** Every step made — the hint has nothing left to show. */
  readonly complete: boolean;
}

/**
 * Whether one step of a hint has been made. An elimination is made once the
 * player has ruled the digit out (or the cell has been filled, which settles
 * it either way); a placement once its cell is filled.
 */
function stepDone(state: GameState, cell: number, digit: number | null): boolean {
  if (state.entries[cell] !== null) return true;
  return digit !== null && isRuledOut(state, cell, digit);
}

/**
 * Track a hint against the board as the player acts on it. Derived from the
 * board every time, so undoing a step un-does its progress too.
 */
export function hintProgress(state: GameState, hint: Hint): HintProgress {
  const steps =
    hint.type === 'direct'
      ? [stepDone(state, hint.cell, null)]
      : hint.eliminations.map((e) => stepDone(state, e.cell, e.digit));
  const done = steps.filter(Boolean).length;
  return { done, total: steps.length, complete: done === steps.length };
}

/**
 * A hint's decorations with the steps already made taken out, so what is left
 * on the board is exactly what is left to do. The pattern stays: it is the
 * reason, and still worth seeing until the hint is finished.
 */
export function pendingHintDecorations(
  state: GameState,
  hint: Hint,
  decorations: readonly Decoration[],
): readonly Decoration[] {
  if (hint.type === 'direct') {
    return stepDone(state, hint.cell, null) ? [] : decorations;
  }
  return decorations.filter(
    (d) =>
      !(
        d.role === 'eliminated' &&
        d.target.kind === 'note' &&
        stepDone(state, d.target.cell, d.target.digit)
      ),
  );
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
