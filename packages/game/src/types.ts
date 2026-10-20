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
 * Two layers, deliberately separate:
 *
 * **Candidates** — what the player believes is still possible here. Each
 * digit is in exactly one state: unmarked, noted (`auto` or `manual`), or
 * struck (`excluded`). The three arrays are therefore **disjoint**, and the
 * rules below keep them so:
 *
 * - Noting a digit makes it `manual` (taking it out of `auto` and `excluded`).
 * - Striking a digit makes it `excluded` (taking it out of `auto`/`manual`).
 * - Repeating the same action on a digit clears it: note → note again is
 *   unmarked, strike → strike again is unmarked. Switching type replaces.
 * - Placing a value removes that digit from the noted candidates of every
 *   peer — `auto` and `manual` alike, since a candidate a peer now rules out
 *   is simply wrong. Strikes are left: they are already true.
 * - Auto-notes (`setNotes`) fills `auto` with the engine's candidates, minus
 *   anything the player has noted or struck. It will re-add a digit the player
 *   merely un-noted — that is what pressing it means — but never one they
 *   struck.
 *
 * This layer is canonical: anything that acts on "the player's candidates"
 * (auto-play, when it exists) reads it as noted-minus-struck.
 *
 * **Scratch** — working marks for trying an idea out, independent of the
 * candidates. Marking or clearing scratch never changes a candidate, and
 * nothing automatic ever touches it, except placing a value in the cell
 * itself, which clears everything there.
 *
 * `auto` and `manual` differ only in where a note came from: the UI draws
 * auto notes lighter, and nothing else treats them differently.
 */
export interface CellNotes {
  /** Noted by Auto-notes from the engine's candidates. Sorted ascending. */
  readonly auto: readonly number[];
  /** Noted by the player. Sorted ascending. */
  readonly manual: readonly number[];
  /** Struck by the player — ruled out. Sorted ascending. */
  readonly excluded: readonly number[];
  /** Scratch marks — working notes, independent of the candidates. Sorted. */
  readonly scratch: readonly number[];
}

/** Every digit noted as possible in a cell, from either source, sorted. */
export function includedNotes(notes: CellNotes): readonly number[] {
  return [...new Set([...notes.auto, ...notes.manual])].sort((a, b) => a - b);
}

/** Which kind of mark a note action targets: note, strike, or scratch. */
export type NoteKind = 'included' | 'excluded' | 'scratch';

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

/** One undoable player action: the moves it made, in order. Never empty. */
export type HistoryEntry = readonly Move[];

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

  /**
   * Every player action, oldest first, each as the moves it made. Truncated
   * when a new action follows an undo.
   *
   * Grouped because one action can touch many cells — a note across a
   * selection, Auto-notes across the board — and undo must take back exactly
   * what the player did, not one cell of it.
   */
  readonly history: readonly HistoryEntry[];

  /**
   * How many entries of `history` are currently applied. Undo decrements,
   * redo increments. Keeping the tail lets redo work without re-deriving it.
   */
  readonly historyIndex: number;

  /**
   * The save point: a `historyIndex` the player can return to, or `null`.
   *
   * An index rather than a snapshot because history replay is deterministic —
   * replaying the first `savePoint` entries rebuilds the board exactly as it
   * was, values and every kind of mark. It also keeps returning an ordinary
   * history move, so redo can bring the abandoned attempt back.
   */
  readonly savePoint: number | null;

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
