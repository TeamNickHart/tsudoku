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

const EMPTY_NOTES: CellNotes = { auto: [], manual: [], excluded: [] };

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

/**
 * Add or remove a single digit from one of a cell's note sets.
 *
 * Deliberately takes one digit rather than a whole replacement set. An earlier
 * version passed the new included list and treated every digit in it as
 * manual, so toggling one note off silently took ownership of every *other*
 * note in the cell.
 *
 * Writing an included note by hand moves that digit into `manual` and out of
 * `auto`: the player has taken ownership, so the app stops maintaining it.
 * Removing one clears it from both, since it is gone either way.
 */
function withNoteDigit(
  notes: CellNotes,
  kind: NoteKind,
  digit: number,
  present: boolean,
): CellNotes {
  if (kind === 'excluded') {
    return {
      auto: notes.auto,
      manual: notes.manual,
      excluded: present
        ? sorted([...notes.excluded, digit])
        : notes.excluded.filter((d) => d !== digit),
    };
  }

  return {
    auto: notes.auto.filter((d) => d !== digit),
    manual: present ? sorted([...notes.manual, digit]) : notes.manual.filter((d) => d !== digit),
    excluded: notes.excluded,
  };
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

      // Placing a digit makes it impossible in every peer, so an *auto* note
      // for it there is now obsolete bookkeeping and goes quietly. A note the
      // player wrote by hand is deliberately left alone: it will show as stale,
      // which is the point — see the note on CellNotes.auto.
      for (const peer of peerIndices(move.cell)) {
        const peerNotes = notes[peer]!;
        if (!peerNotes.auto.includes(move.digit)) continue;
        notes[peer] = {
          auto: peerNotes.auto.filter((d) => d !== move.digit),
          manual: peerNotes.manual,
          excluded: peerNotes.excluded,
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
      const cellNotes = state.notes[move.cell]!;
      const current = move.note === 'included' ? includedNotes(cellNotes) : cellNotes.excluded;

      if (current.includes(move.digit)) {
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
      const current = move.note === 'included' ? includedNotes(cellNotes) : cellNotes.excluded;
      if (!current.includes(move.digit)) return state;
      const notes = [...state.notes];
      notes[move.cell] = withNoteDigit(cellNotes, move.note, move.digit, false);
      return { ...state, notes };
    }
    case 'setNotes': {
      if (state.entries[move.cell] !== null) return state;
      const cellNotes = state.notes[move.cell]!;
      const notes = [...state.notes];
      // Engine-derived, so they land in `auto`. Digits the player already noted
      // by hand are skipped — manual wins, and the sets stay disjoint.
      notes[move.cell] = {
        auto: sorted(move.digits.filter((d) => !cellNotes.manual.includes(d))),
        manual: cellNotes.manual,
        excluded: cellNotes.excluded,
      };
      return { ...state, notes };
    }
    case 'clearNotes': {
      const cellNotes = state.notes[move.cell]!;
      if (
        cellNotes.auto.length === 0 &&
        cellNotes.manual.length === 0 &&
        cellNotes.excluded.length === 0
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
 * Apply a move and record it in history.
 *
 * Moves made after an undo truncate the redo tail, which is the behaviour
 * every editor has trained people to expect.
 */
export function applyMove(state: GameState, move: Move): GameState {
  if (move.cell < 0 || move.cell >= CELL_COUNT) {
    return state;
  }
  if ('digit' in move && (move.digit < 1 || move.digit > SIZE)) {
    return state;
  }

  const next = reduce(state, move);
  // A move that changed nothing should not occupy a history slot.
  if (next === state) {
    return state;
  }

  const history = [...state.history.slice(0, state.historyIndex), move];
  return { ...next, history, historyIndex: history.length };
}

/** Apply the same kind of move to every selected cell. */
export function applyToSelection(state: GameState, build: (cell: number) => Move): GameState {
  let current = state;
  for (const cell of state.selected) {
    current = applyMove(current, build(cell));
  }
  return current;
}

/**
 * Fill every empty cell's included notes with the engine's real candidates.
 *
 * This is the "auto-notes" / "fill pencil marks" button every Sudoku app has.
 * The engine already knows the answer — a cell's `candidateList` is exactly the
 * set of digits not ruled out by a peer — so this is a read, not a computation.
 *
 * Note the result is *truth at this moment*: it reflects eliminations the
 * engine has applied. That is deliberately different from what the player might
 * have pencilled themselves, and comparing the two is the teaching moment
 * `staleNotes` exposes.
 *
 * Existing excluded notes are preserved; only included notes are replaced.
 */
export function fillNotes(state: GameState, cells?: readonly number[]): GameState {
  const grid = toGrid(state);
  const targets = cells ?? Array.from({ length: CELL_COUNT }, (_, i) => i);

  let current = state;
  for (const cell of targets) {
    if (current.entries[cell] !== null) continue;
    if (isGiven(current, cell)) continue;
    const digits = grid.getCellByIndex(cell).candidateList;
    if (digits.length === 0) continue;
    current = applyMove(current, { kind: 'setNotes', cell, digits });
  }
  return current;
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
 * Step back one move.
 *
 * Implemented as replay-from-givens rather than by storing snapshots: the state
 * to rebuild is 81 cells, so replaying is microseconds, and it keeps history a
 * plain serializable list of moves.
 */
export function undo(state: GameState): GameState {
  if (!canUndo(state)) return state;
  return replay(state, state.historyIndex - 1);
}

/** Step forward one move. */
export function redo(state: GameState): GameState {
  if (!canRedo(state)) return state;
  return replay(state, state.historyIndex + 1);
}

/** Rebuild state by replaying the first `count` moves from the givens. */
function replay(state: GameState, count: number): GameState {
  let current: GameState = { ...state, ...blankBoard(state.puzzle) };
  for (let i = 0; i < count; i++) {
    current = reduce(current, state.history[i]!);
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
