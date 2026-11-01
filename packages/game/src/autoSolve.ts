import { CELL_COUNT, SIZE, boxOf, colOf, rowOf } from '@tsudoku/core';
import { applyMoves, isDigitPlacedInPeer, isGiven } from './game.js';
import { isRuledOut } from './hints.js';
import type { GameState, Move } from './types.js';

/**
 * Auto-solving naked singles after a placement.
 *
 * **It acts on the player's marks, and nothing else.** A cell's candidates are
 * the digits not placed in its row, column or box, not struck, and — where the
 * cell has notes — noted. When that leaves exactly one digit, it is placed.
 * There is no peek at the solution and no further solving logic: good marks
 * give good fills, bad marks give bad ones and eventually a cell with no
 * candidates at all, which is left empty for the player to notice and undo.
 *
 * That is deliberately unlike hints, which pass on only *correct*
 * eliminations (see `toPlayerGrid`): a hint teaches, so it must be right; this
 * carries out what the player has written.
 *
 * **Scope** limits how far a placement reaches, so the feature stays a
 * convenience rather than playing the game:
 * - `box` — singles in the box of the cell just placed
 * - `lines` — that box plus the placed cell's row and column
 * - `board` — anywhere
 * Fills chain — one fill can uncover the next — but only within that scope,
 * which is fixed by the player's placement, not by each fill.
 */
export type AutoSolveScope = 'box' | 'lines' | 'board';

/** A cell's candidates according to the player's marks alone. */
export function markedCandidates(state: GameState, cell: number): readonly number[] {
  if (state.entries[cell] !== null) return [];
  const digits: number[] = [];
  for (let digit = 1; digit <= SIZE; digit++) {
    if (isDigitPlacedInPeer(state, cell, digit)) continue;
    if (isRuledOut(state, cell, digit)) continue;
    digits.push(digit);
  }
  return digits;
}

/** The cells a placement at `origin` may auto-solve, in board order. */
function scopeCells(origin: number, scope: AutoSolveScope): readonly number[] {
  const row = rowOf(origin);
  const col = colOf(origin);
  const box = boxOf(row, col);
  const cells: number[] = [];
  for (let i = 0; i < CELL_COUNT; i++) {
    const inBox = boxOf(rowOf(i), colOf(i)) === box;
    const inLines = rowOf(i) === row || colOf(i) === col;
    if (scope === 'board' || inBox || (scope === 'lines' && inLines)) cells.push(i);
  }
  return cells;
}

/**
 * Place a digit, then fill every naked single the placement reaches — as
 * **one** player action, so a single undo takes back the placement and all
 * it filled.
 *
 * Returns the new state and the cells that were filled automatically, in the
 * order they were filled (for the UI to point them out). If the placement
 * itself is refused, nothing happens.
 */
export function placeWithAutoSolve(
  state: GameState,
  cell: number,
  digit: number,
  scope: AutoSolveScope,
): { readonly state: GameState; readonly autoFilled: readonly number[] } {
  const placement: Move = { kind: 'setValue', cell, digit };
  let board = applyMoves(state, [placement]);
  if (board === state) return { state, autoFilled: [] };

  const moves: Move[] = [placement];
  const autoFilled: number[] = [];
  const reach = scopeCells(cell, scope);
  // One fill at a time, re-reading the board after each, because a fill
  // removes its digit from its peers' notes and can create — or destroy —
  // the next single. Bounded: every pass fills a cell.
  for (;;) {
    const next = reach.find(
      (c) =>
        board.entries[c] === null && !isGiven(board, c) && markedCandidates(board, c).length === 1,
    );
    if (next === undefined) break;
    const [only] = markedCandidates(board, next);
    if (only === undefined) break;
    const move: Move = { kind: 'setValue', cell: next, digit: only };
    board = applyMoves(board, [move]);
    moves.push(move);
    autoFilled.push(next);
  }

  // Replayed from the original state as one entry; the reducer is
  // deterministic, so this reproduces `board` exactly.
  return { state: applyMoves(state, moves), autoFilled };
}
