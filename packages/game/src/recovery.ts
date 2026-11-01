import { CELL_COUNT } from '@tsudoku/core';
import { markedCandidates } from './autoSolve.js';
import { undo } from './game.js';
import { isRuledOut } from './hints.js';
import type { GameState } from './types.js';

/**
 * Recovering from a mistake.
 *
 * The player is free to go down a wrong path — auto-solve follows their marks,
 * and wrong values need not show — so the app needs a way back that does not
 * mean replaying the whole game by hand. These are the only places that read
 * the solution on the player's behalf, and only when asked.
 */

/**
 * Whether the board can still be solved from here: every placed value is
 * correct, and no empty cell has its answer ruled out by the player's marks
 * (struck, or left out of the cell's notes). Scratch marks do not count.
 *
 * Marks count as well as values because a wrong strike is a mistake waiting
 * to happen: undoing only the wrong values would leave it in place, and
 * auto-solve would make the same wrong fill again.
 */
export function isSolvable(state: GameState): boolean {
  for (let cell = 0; cell < CELL_COUNT; cell++) {
    const answer = Number(state.solution[cell]);
    const value = state.entries[cell];
    if (value !== null) {
      if (value !== answer) return false;
    } else if (isRuledOut(state, cell, answer)) {
      return false;
    }
  }
  return true;
}

/**
 * Empty cells the player's marks leave with no possible value at all — the
 * point where a mistake has become plain to see on the board.
 */
export function deadEndCells(state: GameState): readonly number[] {
  const cells: number[] = [];
  for (let cell = 0; cell < CELL_COUNT; cell++) {
    if (state.entries[cell] === null && markedCandidates(state, cell).length === 0) {
      cells.push(cell);
    }
  }
  return cells;
}

/**
 * Step back through history to the most recent point where the board was
 * still solvable. Uses ordinary undo, so redo can bring the steps back.
 * Returns the state unchanged if it is solvable already. Always terminates:
 * the start of the game, before any move, is solvable.
 */
export function undoUntilSolvable(state: GameState): GameState {
  let current = state;
  while (!isSolvable(current) && current.historyIndex > 0) {
    current = undo(current);
  }
  return current;
}
