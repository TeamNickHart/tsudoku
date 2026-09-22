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
 * **2. Notes are not candidates.** The engine's `candidates` bitmask is
 * *truth* — what is actually still possible. A player's notes are their own
 * reasoning, which may be incomplete or flat-out wrong, and that is the point:
 * a teaching app has to be able to show you where your notes disagree with
 * reality. They are separate fields and must stay that way.
 *
 * **3. Decorations describe meaning, not appearance.** A decoration says
 * "this cell is the subject of a hint" or "this note was eliminated", never
 * "this cell is #ff0000". The UI decides what each role looks like, which is
 * what lets web and React Native share one model and lets themes work at all.
 *
 * **4. Everything here is plain data.** No classes, no methods, no framework
 * imports. This package must never import React — that is what makes the
 * React Native port a re-render rather than a rewrite.
 *
 * On representation: notes use `number[]` rather than a bitmask deliberately.
 * The engine's bitmask is verified and stays; player notes are read constantly
 * in devtools while building UI, so legibility wins until there is a measured
 * reason to change. The arrays are kept sorted so equality checks are cheap.
 */

/** A digit 1..9, or null for an empty cell. */
export type CellValue = number | null;

/**
 * Why a cell cannot be edited.
 *
 * - `given` — part of the puzzle. Never editable.
 * - `placed` — the player entered a value here. Committed: it cannot be
 *   overwritten or erased, and undo is the way back.
 * - `editable` — empty, and open to a value or notes.
 *
 * Placing a digit being a *commitment* is a teaching decision, not a technical
 * one. A board you can freely overwrite invites guess-and-check, which is the
 * opposite of what this app is for; making a placement cost something means
 * thinking before placing. Undo remains the escape hatch, and it deliberately
 * rewinds the moves made since — that is the cost of a wrong guess, and it is
 * the same cost a person pays on paper.
 *
 * Note this applies whether the entry was right or wrong. Unlocking only wrong
 * entries would tell the player their digit was wrong the moment the cell
 * stayed editable, turning the lock into an answer checker.
 */
export type CellLock = 'given' | 'placed' | 'editable';

/**
 * A player's annotations on one cell.
 *
 * `included` and `excluded` are independent on purpose. A player may pencil in
 * "could be 3 or 7" while separately crossing out "definitely not 1". A digit
 * appearing in both is a contradiction the player has written down, and the UI
 * should show it rather than silently resolving it — being able to see your own
 * mistake is the teaching mechanic.
 */
/**
 * A player's annotations on one cell.
 *
 * Three **disjoint** sets. There is deliberately no subset relationship
 * between them: an earlier version made `auto` a subset of the included
 * notes, which meant every mutation had to filter one array to keep it
 * consistent with another — an invariant the type could not enforce.
 *
 * - `auto` — derived by Auto-notes from the engine's candidates. The app
 *   maintains these: placing a digit silently removes it from the auto notes
 *   of every peer, because that is bookkeeping the app produced.
 * - `manual` — written by the player. The app never removes these. When a
 *   placement makes one impossible it is shown *stale* instead, because
 *   noticing that your own reasoning has been overtaken is the teaching
 *   moment.
 * - `excluded` — strikes. Always the player's, by definition: nothing
 *   generates them automatically today.
 *
 * `manual` wins if a digit would land in both: auto-fill skips digits the
 * player has already noted, and noting a digit by hand removes it from `auto`.
 */
export interface CellNotes {
  /** Engine-derived possibilities, maintained by the app. Sorted ascending. */
  readonly auto: readonly number[];
  /** Possibilities the player wrote. Never auto-removed. Sorted ascending. */
  readonly manual: readonly number[];
  /** Digits the player has ruled out. Sorted ascending. Rendered struck-through. */
  readonly excluded: readonly number[];
}

/** Every digit noted as possible in a cell, from either source, sorted. */
export function includedNotes(notes: CellNotes): readonly number[] {
  return [...new Set([...notes.auto, ...notes.manual])].sort((a, b) => a - b);
}

/** Which note set a note action targets. */
export type NoteKind = 'included' | 'excluded';

/**
 * A single player action, stored so history can be replayed from the givens
 * rather than by snapshotting whole grids.
 */
export type Move =
  | { readonly kind: 'setValue'; readonly cell: number; readonly digit: number }
  | { readonly kind: 'clearValue'; readonly cell: number }
  | {
      readonly kind: 'addNote';
      readonly cell: number;
      readonly digit: number;
      readonly note: NoteKind;
    }
  | {
      readonly kind: 'removeNote';
      readonly cell: number;
      readonly digit: number;
      readonly note: NoteKind;
    }
  | {
      readonly kind: 'toggleNote';
      readonly cell: number;
      readonly digit: number;
      readonly note: NoteKind;
    }
  | { readonly kind: 'clearNotes'; readonly cell: number }
  /**
   * Replace a cell's included notes with the engine's actual candidates.
   *
   * Carries the digits rather than computing them, so that replaying history
   * reproduces exactly what the player saw — deriving them at replay time
   * would use a different board state and give a different answer.
   */
  | {
      readonly kind: 'setNotes';
      readonly cell: number;
      readonly digits: readonly number[];
    };

/**
 * What a decoration points at: a whole cell, or one digit within a cell's
 * note grid.
 */
export type DecorationTarget =
  | { readonly kind: 'cell'; readonly cell: number }
  | { readonly kind: 'note'; readonly cell: number; readonly digit: number };

/**
 * Why something is decorated — semantic, never visual.
 *
 * The UI maps these to colors, weights, strikethroughs and outlines. Keeping
 * them semantic means a tutorial, a hint, the error checker and a player's own
 * highlighting all drive the same mechanism, and a theme can restyle every one
 * of them without touching game logic.
 */
export type DecorationRole =
  /** The cell or note a hint is about to act on. */
  | 'primary'
  /** Cells or notes that explain why the primary conclusion holds. */
  | 'supporting'
  /** A note this technique rules out. Typically drawn struck-through. */
  | 'eliminated'
  /** A conflict: an entry that disagrees with the solution. */
  | 'error'
  /** A note that disagrees with the engine's candidates. */
  | 'stale'
  /** Player-driven highlighting. The index distinguishes colors. */
  | 'highlight-1'
  | 'highlight-2'
  | 'highlight-3';

/** One piece of presentation meaning attached to a target. */
export interface Decoration {
  readonly target: DecorationTarget;
  readonly role: DecorationRole;
  /** Optional text for a tooltip or tutorial caption. */
  readonly note?: string;
}

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

  /** Player annotations per cell. */
  readonly notes: readonly CellNotes[];

  /** Every move made, oldest first. Truncated when a new move follows an undo. */
  readonly history: readonly Move[];

  /**
   * How many entries of `history` are currently applied. Undo decrements,
   * redo increments. Keeping the tail lets redo work without re-deriving it.
   */
  readonly historyIndex: number;

  /**
   * Currently selected cells, in selection order.
   *
   * An array rather than a single index because annotating several cells at
   * once is core to how people actually take notes. Single selection is just
   * the one-element case.
   */
  readonly selected: readonly number[];

  /**
   * Active decorations. Not part of history — decorations are presentation,
   * and undoing a move should not undo a tutorial's highlighting.
   */
  readonly decorations: readonly Decoration[];
}

/** Everything the UI needs to render one cell. Derived — never stored. */
export interface CellView {
  readonly index: number;
  readonly value: CellValue;
  readonly lock: CellLock;
  readonly notes: CellNotes;
  /** True when the entered value disagrees with the solution. */
  readonly isError: boolean;
  /** Included notes that are no longer possible given the current board. */
  readonly staleNotes: readonly number[];
  /** Every digit noted as possible, from either source. Sorted. */
  readonly includedNotes: readonly number[];
  /** True when this cell is in the current selection. */
  readonly isSelected: boolean;
  /** Roles decorating the cell as a whole. */
  readonly roles: readonly DecorationRole[];
  /** Roles decorating individual digits, keyed by digit. */
  readonly noteRoles: Readonly<Record<number, readonly DecorationRole[]>>;
}
