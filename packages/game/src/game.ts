import { CELL_COUNT, SIZE, boxOf, colOf, createGrid, rowOf } from '@tsudoku/core';
import type { Grid } from '@tsudoku/core';
import { solutionString } from '@tsudoku/solver';
import { includedNotes } from './types.js';
import type {
  CellNotes,
  CellValue,
  CellView,
  Decoration,
  DecorationRole,
  GameState,
  HistoryEntry,
  Move,
  NoteKind,
} from './types.js';

/** Thrown when a puzzle cannot be turned into a playable game. */
export class InvalidPuzzleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidPuzzleError';
  }
}

/**
 * Every indexed access in this file is into a fixed 81-element structure
 * (`entries`, `notes`, `puzzle`, `solution`) with an index already bounds-
 * checked by the caller or by a `for` loop over CELL_COUNT. The non-null
 * assertions below are safe for that reason and are not repeated per line.
 */

const EMPTY_NOTES: CellNotes = { auto: [], manual: [], excluded: [], scratch: [] };

/**
 * Cells sharing a row, column or box with the given cell.
 *
 * Computed here rather than via `toGrid`, which would mean deriving a whole
 * Grid on every placement just to read a peer list that never changes.
 */
const PEERS: readonly (readonly number[])[] = (() => {
  const all: number[][] = [];
  for (let i = 0; i < CELL_COUNT; i++) {
    const row = rowOf(i);
    const col = colOf(i);
    const box = boxOf(row, col);
    const peers: number[] = [];
    for (let j = 0; j < CELL_COUNT; j++) {
      if (j === i) continue;
      if (rowOf(j) === row || colOf(j) === col || boxOf(rowOf(j), colOf(j)) === box) {
        peers.push(j);
      }
    }
    all.push(peers);
  }
  return all;
})();

function peerIndices(cell: number): readonly number[] {
  return PEERS[cell] ?? [];
}

function isBlank(ch: string): boolean {
  return ch === '.' || ch === '0';
}

/**
 * Whether a digit is already placed in this cell's row, column or box.
 *
 * Deliberately a check against *placed values only*, not against the engine's
 * candidates. A digit the engine has eliminated by a Pointing or X-Wing
 * argument is still something the player is entitled to write down — they have
 * not made that deduction yet, and blocking it would hand them the technique
 * for free. What this rules out is the thing no reasoning is needed for: you
 * cannot pencil a 3 into a row that already contains a 3.
 *
 * Note it also counts the player's own entries, wrong ones included. If they
 * have placed a 3 in this row, refusing another 3 keeps their board internally
 * consistent with what they believe — and undoing the 3 releases the
 * restriction again.
 */
export function isDigitPlacedInPeer(state: GameState, cell: number, digit: number): boolean {
  for (const peer of peerIndices(cell)) {
    if (state.entries[peer] === digit) return true;
  }
  return false;
}

/**
 * Digits that cannot sensibly be noted or struck in this cell.
 *
 * Exposed so the UI can show them as unavailable rather than letting a press
 * silently do nothing — a control that looks live and does nothing reads as a
 * bug.
 */
export function impossibleDigits(state: GameState, cell: number): readonly number[] {
  const out: number[] = [];
  for (let digit = 1; digit <= SIZE; digit++) {
    if (isDigitPlacedInPeer(state, cell, digit)) out.push(digit);
  }
  return out;
}

/**
 * Start a new game from an 81-character puzzle string.
 *
 * The solution is computed once here. It is invariant for the life of the game,
 * so it is never recomputed — that is what makes "is this entry wrong?" a
 * string lookup rather than a solve.
 *
 * @throws {InvalidPuzzleError} if the puzzle has no solution.
 */
export function createGame(puzzle: string): GameState {
  if (puzzle.length !== CELL_COUNT) {
    throw new InvalidPuzzleError(`Puzzle must be ${CELL_COUNT} characters, got ${puzzle.length}`);
  }

  const solution = solutionString(createGrid(puzzle));
  if (solution === null) {
    throw new InvalidPuzzleError('Puzzle has no solution');
  }

  return {
    puzzle,
    solution,
    ...blankBoard(puzzle),
    history: [],
    historyIndex: 0,
    selected: [],
    decorations: [],
  };
}

/** Entries and notes as they are at the start of a game. */
function blankBoard(puzzle: string): Pick<GameState, 'entries' | 'notes'> {
  const entries: CellValue[] = [];
  const notes: CellNotes[] = [];
  for (let i = 0; i < CELL_COUNT; i++) {
    const ch = puzzle[i]!;
    entries.push(isBlank(ch) ? null : Number(ch));
    notes.push(EMPTY_NOTES);
  }
  return { entries, notes };
}

/** Whether a cell is one of the original givens and therefore not editable. */
export function isGiven(state: GameState, cell: number): boolean {
  return !isBlank(state.puzzle[cell]!);
}

/**
 * Whether a cell's value is committed — a given, or a digit the player placed.
 *
 * Both are closed to further edits; undo is the way back from a placement. See
 * `CellLock` for why placements commit.
 */
export function isLocked(state: GameState, cell: number): boolean {
  return isGiven(state, cell) || state.entries[cell] !== null;
}

function sorted(digits: Iterable<number>): readonly number[] {
  return [...new Set(digits)].sort((a, b) => a - b);
}

/** Whether `digit` currently carries the given kind of mark in a cell. */
function hasMark(notes: CellNotes, kind: NoteKind, digit: number): boolean {
  switch (kind) {
    case 'included':
      return notes.auto.includes(digit) || notes.manual.includes(digit);
    case 'excluded':
      return notes.excluded.includes(digit);
    case 'scratch':
      return notes.scratch.includes(digit);
  }
}

/**
 * Give one digit a kind of mark, or take it away.
 *
 * Deliberately takes one digit rather than a whole replacement set. An earlier
 * version passed the new included list and treated every digit in it as
 * manual, so toggling one note off silently took ownership of every *other*
 * note in the cell.
 *
 * Notes and strikes are one layer — a digit is noted, struck, or neither — so
 * marking one kind takes the digit out of the other (see CellNotes). Scratch is
 * its own layer and never disturbs them.
 */
function withNoteDigit(
  notes: CellNotes,
  kind: NoteKind,
  digit: number,
  present: boolean,
): CellNotes {
  const without = (digits: readonly number[]): readonly number[] =>
    digits.filter((d) => d !== digit);

  if (kind === 'scratch') {
    return {
      ...notes,
      scratch: present ? sorted([...notes.scratch, digit]) : without(notes.scratch),
    };
  }

  // Either way the digit leaves the candidate layer first; then, if being
  // marked, it lands in exactly one set.
  const cleared: CellNotes = {
    auto: without(notes.auto),
    manual: without(notes.manual),
    excluded: without(notes.excluded),
    scratch: notes.scratch,
  };
  if (!present) {
    // Removing a note leaves a strike alone, and vice versa.
    return kind === 'included'
      ? { ...cleared, excluded: notes.excluded }
      : { ...cleared, auto: notes.auto, manual: notes.manual };
  }
  return kind === 'included'
    ? { ...cleared, manual: sorted([...cleared.manual, digit]) }
    : { ...cleared, excluded: sorted([...cleared.excluded, digit]) };
}

/**
 * Apply a single move without touching history.
 *
 * Kept separate from `applyMove` so history replay can reuse it — replaying is
 * just folding this over the move list.
 */
function reduce(state: GameState, move: Move): GameState {
  // Givens are immutable. Silently ignoring is right here: the UI should not
  // offer the action, and a thrown error would turn a misclick into a crash.
  if (isGiven(state, move.cell)) {
    return state;
  }

  // A placed value is committed — it cannot be overwritten or erased, and undo
  // is the way back. Only the value-changing moves are blocked; notes on a
  // filled cell are already a no-op below, and clearNotes stays available so a
  // player can tidy up around a placement.
  if (
    (move.kind === 'setValue' || move.kind === 'clearValue') &&
    state.entries[move.cell] !== null
  ) {
    return state;
  }

  switch (move.kind) {
    case 'setValue': {
      const entries = [...state.entries];
      entries[move.cell] = move.digit;
      const notes = [...state.notes];
      // Entering a value clears that cell's notes — they described an unknown.
      notes[move.cell] = EMPTY_NOTES;

      // Placing a digit makes it impossible in every peer, so a note for it
      // there is now simply wrong and goes — whoever wrote it. The candidate
      // layer is canonical (see CellNotes), so it must not carry a candidate a
      // placed digit rules out. Strikes are left, being already true, and so
      // is scratch, which is the player's to manage.
      for (const peer of peerIndices(move.cell)) {
        const peerNotes = notes[peer]!;
        if (!peerNotes.auto.includes(move.digit) && !peerNotes.manual.includes(move.digit)) {
          continue;
        }
        notes[peer] = {
          ...peerNotes,
          auto: peerNotes.auto.filter((d) => d !== move.digit),
          manual: peerNotes.manual.filter((d) => d !== move.digit),
        };
      }

      return { ...state, entries, notes };
    }
    case 'clearValue': {
      if (state.entries[move.cell] === null) return state;
      const entries = [...state.entries];
      entries[move.cell] = null;
      return { ...state, entries };
    }
    case 'addNote':
    case 'toggleNote': {
      // A note on a filled cell is meaningless.
      if (state.entries[move.cell] !== null) return state;
      // Nor can a digit already placed in this row, column or box be a
      // candidate here. Refusing the move keeps the player from recording
      // something they can see is false — see isDigitPlacedInPeer for why this
      // checks placed values rather than the engine's candidates.
      //
      // Removing such a note is still allowed: one may already exist from
      // before the peer was filled, and the player must be able to tidy up.
      const cellNotes = state.notes[move.cell]!;
      const present = hasMark(cellNotes, move.note, move.digit);
      if (isDigitPlacedInPeer(state, move.cell, move.digit)) {
        if (!present || move.kind === 'addNote') return state;
      }

      if (present) {
        if (move.kind === 'addNote') return state;
        // toggleNote on an existing digit removes it.
        const notes = [...state.notes];
        notes[move.cell] = withNoteDigit(cellNotes, move.note, move.digit, false);
        return { ...state, notes };
      }

      const notes = [...state.notes];
      notes[move.cell] = withNoteDigit(cellNotes, move.note, move.digit, true);
      return { ...state, notes };
    }
    case 'removeNote': {
      const cellNotes = state.notes[move.cell]!;
      if (!hasMark(cellNotes, move.note, move.digit)) return state;
      const notes = [...state.notes];
      notes[move.cell] = withNoteDigit(cellNotes, move.note, move.digit, false);
      return { ...state, notes };
    }
    case 'setNotes': {
      if (state.entries[move.cell] !== null) return state;
      const cellNotes = state.notes[move.cell]!;
      // Engine-derived, so they land in `auto`. Digits the player noted or
      // struck are skipped: a strike is a decision Auto-notes must not undo,
      // and skipping both keeps the sets disjoint.
      const auto = sorted(
        move.digits.filter((d) => !cellNotes.manual.includes(d) && !cellNotes.excluded.includes(d)),
      );
      // Unchanged is a no-op, so pressing Auto-notes twice leaves no empty
      // undo step behind.
      if (auto.join() === cellNotes.auto.join()) return state;
      const notes = [...state.notes];
      notes[move.cell] = { ...cellNotes, auto };
      return { ...state, notes };
    }
    case 'clearNotes': {
      const cellNotes = state.notes[move.cell]!;
      if (
        cellNotes.auto.length === 0 &&
        cellNotes.manual.length === 0 &&
        cellNotes.excluded.length === 0 &&
        cellNotes.scratch.length === 0
      ) {
        return state;
      }
      const notes = [...state.notes];
      notes[move.cell] = EMPTY_NOTES;
      return { ...state, notes };
    }
  }
}

/**
 * Apply several moves as **one** player action — one history entry, so one
 * undo takes all of them back.
 *
 * Moves that change nothing are dropped, and if none changes anything the
 * action leaves no history entry at all. Moves made after an undo truncate the
 * redo tail, which is the behaviour every editor has trained people to expect.
 */
export function applyMoves(state: GameState, moves: readonly Move[]): GameState {
  let current = state;
  const applied: Move[] = [];
  for (const move of moves) {
    if (move.cell < 0 || move.cell >= CELL_COUNT) continue;
    if ('digit' in move && (move.digit < 1 || move.digit > SIZE)) continue;
    const next = reduce(current, move);
    if (next !== current) {
      applied.push(move);
      current = next;
    }
  }
  if (applied.length === 0) return state;

  const entry: HistoryEntry = applied;
  const history = [...state.history.slice(0, state.historyIndex), entry];
  return { ...current, history, historyIndex: history.length };
}

/** Apply one move as its own player action. */
export function applyMove(state: GameState, move: Move): GameState {
  return applyMoves(state, [move]);
}

/** Apply the same kind of move to every selected cell, as one action. */
export function applyToSelection(state: GameState, build: (cell: number) => Move): GameState {
  return applyMoves(state, state.selected.map(build));
}

/**
 * Press a digit in a note mode: mark it across the whole selection, or clear
 * it from the whole selection — one decision, one undo step.
 *
 * If every selected cell that can take the mark already has it, the press
 * clears it from all of them; otherwise it marks all of them. Toggling cell by
 * cell instead would add the digit to some cells and remove it from others in
 * a single press, which is how a selection got "mixed up".
 *
 * Filled and given cells are ignored, and so is a cell where the digit is
 * already placed in a peer, since it cannot be marked there.
 */
export function toggleNoteOnSelection(state: GameState, digit: number, kind: NoteKind): GameState {
  const open = state.selected.filter(
    (cell) => state.entries[cell] === null && !isGiven(state, cell),
  );
  const marked = (cell: number): boolean => hasMark(state.notes[cell] ?? EMPTY_NOTES, kind, digit);
  const markable = open.filter((cell) => marked(cell) || !isDigitPlacedInPeer(state, cell, digit));
  if (markable.length === 0) return state;

  const clearing = markable.every(marked);
  return applyMoves(
    state,
    markable.map(
      (cell): Move => ({ kind: clearing ? 'removeNote' : 'addNote', cell, digit, note: kind }),
    ),
  );
}

/**
 * Fill every empty cell's notes with the engine's real candidates — one
 * action, so one undo removes the whole fill.
 *
 * This is the "auto-notes" / "fill pencil marks" button every Sudoku app has.
 * The engine already knows the answer — a cell's `candidateList` is exactly the
 * set of digits not ruled out by a peer — so this is a read, not a computation.
 *
 * It re-adds a candidate the player had un-noted (pressing it is asking for
 * exactly that) but never one they struck, and leaves notes they wrote and
 * scratch marks as they are.
 */
export function fillNotes(state: GameState, cells?: readonly number[]): GameState {
  const grid = toGrid(state);
  const targets = cells ?? Array.from({ length: CELL_COUNT }, (_, i) => i);

  const moves: Move[] = [];
  for (const cell of targets) {
    if (state.entries[cell] !== null) continue;
    if (isGiven(state, cell)) continue;
    const digits = grid.getCellByIndex(cell).candidateList;
    if (digits.length === 0) continue;
    moves.push({ kind: 'setNotes', cell, digits });
  }
  return applyMoves(state, moves);
}

/** Whether there is anything to undo. */
export function canUndo(state: GameState): boolean {
  return state.historyIndex > 0;
}

/** Whether there is anything to redo. */
export function canRedo(state: GameState): boolean {
  return state.historyIndex < state.history.length;
}

/**
 * Step back one player action.
 *
 * Implemented as replay-from-givens rather than by storing snapshots: the state
 * to rebuild is 81 cells, so replaying is microseconds, and it keeps history a
 * plain serializable list of moves.
 */
export function undo(state: GameState): GameState {
  if (!canUndo(state)) return state;
  return replay(state, state.historyIndex - 1);
}

/** Step forward one player action. */
export function redo(state: GameState): GameState {
  if (!canRedo(state)) return state;
  return replay(state, state.historyIndex + 1);
}

/** Rebuild state by replaying the first `count` moves from the givens. */
function replay(state: GameState, count: number): GameState {
  let current: GameState = { ...state, ...blankBoard(state.puzzle) };
  for (let i = 0; i < count; i++) {
    for (const move of state.history[i]!) {
      current = reduce(current, move);
    }
  }
  return {
    ...current,
    history: state.history,
    historyIndex: count,
    selected: state.selected,
    decorations: state.decorations,
  };
}

/** Clear all progress, keeping the puzzle. History is discarded. */
export function resetGame(state: GameState): GameState {
  return {
    ...state,
    ...blankBoard(state.puzzle),
    history: [],
    historyIndex: 0,
    decorations: [],
  };
}

/** Replace the selection with a single cell, or clear it with null. */
export function selectCell(state: GameState, cell: number | null): GameState {
  if (cell === null) return { ...state, selected: [] };
  if (cell < 0 || cell >= CELL_COUNT) return state;
  return { ...state, selected: [cell] };
}

/** Add a cell to the selection, or remove it if already selected. */
export function toggleCellSelection(state: GameState, cell: number): GameState {
  if (cell < 0 || cell >= CELL_COUNT) return state;
  const selected = state.selected.includes(cell)
    ? state.selected.filter((c) => c !== cell)
    : [...state.selected, cell];
  return { ...state, selected };
}

/** Replace the whole selection. */
export function setSelection(state: GameState, cells: readonly number[]): GameState {
  const valid = cells.filter((c) => c >= 0 && c < CELL_COUNT);
  return { ...state, selected: valid };
}

/** Replace all decorations. Decorations are presentation, so this is not a move. */
export function setDecorations(state: GameState, decorations: readonly Decoration[]): GameState {
  return { ...state, decorations };
}

/** Remove all decorations. */
export function clearDecorations(state: GameState): GameState {
  if (state.decorations.length === 0) return state;
  return { ...state, decorations: [] };
}

/** The current board as an 81-character string, for deriving a `Grid`. */
export function toPuzzleString(state: GameState): string {
  let out = '';
  for (let i = 0; i < CELL_COUNT; i++) {
    const v = state.entries[i]!;
    out += v === null ? '.' : String(v);
  }
  return out;
}

/**
 * Derive a `Grid` for the current board.
 *
 * Call this when the engine is needed (hints, candidate display) and let it go
 * — never store the result in state. See the note at the top of types.ts.
 */
export function toGrid(state: GameState): Grid {
  return createGrid(toPuzzleString(state));
}

/** Whether every cell is filled and matches the solution. */
export function isSolved(state: GameState): boolean {
  for (let i = 0; i < CELL_COUNT; i++) {
    const v = state.entries[i];
    if (v === null || String(v) !== state.solution[i]) {
      return false;
    }
  }
  return true;
}

/** Cells whose entered value disagrees with the solution. */
export function errorCells(state: GameState): readonly number[] {
  const out: number[] = [];
  for (let i = 0; i < CELL_COUNT; i++) {
    const v = state.entries[i];
    if (v !== null && String(v) !== state.solution[i]) {
      out.push(i);
    }
  }
  return out;
}

/** How many cells are still empty. */
export function remainingCount(state: GameState): number {
  let n = 0;
  for (let i = 0; i < CELL_COUNT; i++) {
    if (state.entries[i] === null) n += 1;
  }
  return n;
}

/**
 * How many of each digit are already placed.
 *
 * Lets the UI dim a digit once all nine are on the board — the "all of these
 * have been solved" styling.
 */
export function digitCounts(state: GameState): Readonly<Record<number, number>> {
  const counts: Record<number, number> = {};
  for (let d = 1; d <= SIZE; d++) counts[d] = 0;
  for (let i = 0; i < CELL_COUNT; i++) {
    const v = state.entries[i];
    // `v != null` excludes undefined as well, which noUncheckedIndexedAccess
    // makes possible on an indexed read even though the array is always full.
    if (v != null) counts[v] = (counts[v] ?? 0) + 1;
  }
  return counts;
}

/**
 * Everything the UI needs to render one cell.
 *
 * `staleNotes` is where "notes are not candidates" earns its keep: a note the
 * board has since ruled out is exactly the teaching moment a tutor wants to
 * point at.
 *
 * Pass a `grid` when rendering many cells at once — deriving it is the
 * expensive part, and the caller can derive it once for the whole board.
 */
export function cellView(state: GameState, index: number, grid?: Grid): CellView {
  const value = state.entries[index]!;
  const notes = state.notes[index]!;
  const isError = value !== null && String(value) !== state.solution[index];

  const included = includedNotes(notes);
  let staleNotes: readonly number[] = [];
  if (value === null && included.length > 0) {
    const derived = grid ?? toGrid(state);
    const cell = derived.getCellByIndex(index);
    staleNotes = included.filter((d) => !cell.candidateList.includes(d));
  }

  const roles: DecorationRole[] = [];
  const noteRoles: Record<number, DecorationRole[]> = {};
  for (const decoration of state.decorations) {
    const { target } = decoration;
    if (target.kind === 'cell' && target.cell === index) {
      roles.push(decoration.role);
    } else if (target.kind === 'note' && target.cell === index) {
      (noteRoles[target.digit] ??= []).push(decoration.role);
    }
  }

  return {
    index,
    value,
    lock: isGiven(state, index) ? 'given' : value !== null ? 'placed' : 'editable',
    notes,
    isError,
    staleNotes,
    includedNotes: included,
    isSelected: state.selected.includes(index),
    roles,
    noteRoles,
  };
}

/** Render data for the whole board, deriving the `Grid` once. */
export function boardView(state: GameState): readonly CellView[] {
  const grid = toGrid(state);
  const views: CellView[] = [];
  for (let i = 0; i < CELL_COUNT; i++) {
    views.push(cellView(state, i, grid));
  }
  return views;
}
