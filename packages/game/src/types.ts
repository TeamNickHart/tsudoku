/**
 * Game state types.
 *
 * ## Design rules this file exists to enforce
 *
 * **1. Never store a `Grid`.** A `Grid` carries methods (`getRow`, `getPeers`,
 * …) so it does not survive `JSON.stringify`, and it serializes to ~40KB
 * because all 27 regions duplicate their cells. The same puzzle is 81
 * characters. State holds strings and derives the `Grid` on demand, which keeps
 * saves tiny, undo cheap, and lets state cross the React Native bridge or land
 * in `localStorage` / `AsyncStorage` with no special handling.
 *
 * **2. Pencil marks are not candidates.** The engine's `candidates` bitmask is
 * *truth* — what is actually still possible. A player's pencil marks are their
 * own notes, which may be incomplete or flat-out wrong, and that is the point:
 * a teaching app has to be able to show you that your marks disagree with
 * reality. They are separate fields and must stay that way.
 *
 * **3. Everything here is plain data.** No classes, no methods, no framework
 * imports. This package must never import React — that is what makes the
 * React Native port a re-render rather than a rewrite.
 *
 * On representation: marks use `number[]` rather than a bitmask deliberately.
 * The engine's bitmask is verified and stays; player marks are read constantly
 * in devtools while building UI, so legibility wins until there is a measured
 * reason to change. The arrays are kept sorted so equality checks are cheap.
 */

/** A digit 1..9, or null for an empty cell. */
export type CellValue = number | null;

/** Why a cell cannot be edited. */
export type CellLock = 'given' | 'editable';

/**
 * A single player action, stored so history can be replayed from the givens
 * rather than by snapshotting whole grids.
 */
export type Move =
  | { readonly kind: 'setValue'; readonly cell: number; readonly digit: number }
  | { readonly kind: 'clearValue'; readonly cell: number }
  | { readonly kind: 'addMark'; readonly cell: number; readonly digit: number }
  | { readonly kind: 'removeMark'; readonly cell: number; readonly digit: number }
  | { readonly kind: 'clearMarks'; readonly cell: number };

/**
 * The complete state of a game in progress.
 *
 * `puzzle` and `solution` are invariant for the life of the game — the solution
 * is computed once when the game is created and never recomputed.
 */
export interface GameState {
  /** The givens, as 81 chars of digits and '.'. Invariant. */
  readonly puzzle: string;

  /** The full solution, as 81 chars of digits. Invariant. */
  readonly solution: string;

  /**
   * Player-entered values, indexed by cell. `null` where empty.
   * Givens are mirrored here too, so this is the current board.
   */
  readonly entries: readonly CellValue[];

  /** Player pencil marks per cell, kept sorted ascending. */
  readonly marks: readonly (readonly number[])[];

  /** Every move made, oldest first. Truncated when a new move follows an undo. */
  readonly history: readonly Move[];

  /**
   * How many entries of `history` are currently applied. Undo decrements,
   * redo increments. Keeping the tail lets redo work without re-deriving it.
   */
  readonly historyIndex: number;

  /** Currently selected cell, or null. UI state, but it belongs to the game. */
  readonly selected: number | null;
}

/** A cell's status for rendering. Derived — never stored. */
export interface CellView {
  readonly index: number;
  readonly value: CellValue;
  readonly lock: CellLock;
  readonly marks: readonly number[];
  /** True when the entered value disagrees with the solution. */
  readonly isError: boolean;
  /** Marks that are no longer possible given the current board. */
  readonly staleMarks: readonly number[];
}
