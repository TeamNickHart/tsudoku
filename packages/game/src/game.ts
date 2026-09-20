import { CELL_COUNT, SIZE, createGrid } from '@tsudoku/core';
import type { Grid } from '@tsudoku/core';
import { solutionString } from '@tsudoku/solver';
import type { CellValue, CellView, GameState, Move } from './types.js';

/** Thrown when a puzzle cannot be turned into a playable game. */
export class InvalidPuzzleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidPuzzleError';
  }
}

/**
 * Every indexed access in this file is into a fixed 81-element structure
 * (`entries`, `marks`, `puzzle`, `solution`) with an index already bounds-
 * checked by the caller or by a `for` loop over CELL_COUNT. The non-null
 * assertions below are safe for that reason and are not repeated per line.
 */

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

  const entries: CellValue[] = [];
  const marks: number[][] = [];
  for (let i = 0; i < CELL_COUNT; i++) {
    const ch = puzzle[i]!;
    entries.push(isBlank(ch) ? null : Number(ch));
    marks.push([]);
  }

  return {
    puzzle,
    solution,
    entries,
    marks,
    history: [],
    historyIndex: 0,
    selected: null,
  };
}

/** Whether a cell is one of the original givens and therefore not editable. */
export function isGiven(state: GameState, cell: number): boolean {
  return !isBlank(state.puzzle[cell]!);
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

  switch (move.kind) {
    case 'setValue': {
      const entries = [...state.entries];
      entries[move.cell] = move.digit;
      // Entering a value clears that cell's marks — they described an unknown.
      const marks = [...state.marks];
      marks[move.cell] = [];
      return { ...state, entries, marks };
    }
    case 'clearValue': {
      const entries = [...state.entries];
      entries[move.cell] = null;
      return { ...state, entries };
    }
    case 'addMark': {
      // A mark on a filled cell is meaningless.
      if (state.entries[move.cell] !== null) return state;
      const existing = state.marks[move.cell]!;
      if (existing.includes(move.digit)) return state;
      const marks = [...state.marks];
      marks[move.cell] = [...existing, move.digit].sort((a, b) => a - b);
      return { ...state, marks };
    }
    case 'removeMark': {
      const existing = state.marks[move.cell]!;
      if (!existing.includes(move.digit)) return state;
      const marks = [...state.marks];
      marks[move.cell] = existing.filter((d) => d !== move.digit);
      return { ...state, marks };
    }
    case 'clearMarks': {
      if (state.marks[move.cell]!.length === 0) return state;
      const marks = [...state.marks];
      marks[move.cell] = [];
      return { ...state, marks };
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
  const fresh = blankFrom(state);
  let current = fresh;
  for (let i = 0; i < count; i++) {
    current = reduce(current, state.history[i]!);
  }
  return {
    ...current,
    history: state.history,
    historyIndex: count,
    selected: state.selected,
  };
}

/** A game reset to its givens, keeping puzzle/solution/history references. */
function blankFrom(state: GameState): GameState {
  const entries: CellValue[] = [];
  const marks: number[][] = [];
  for (let i = 0; i < CELL_COUNT; i++) {
    const ch = state.puzzle[i]!;
    entries.push(isBlank(ch) ? null : Number(ch));
    marks.push([]);
  }
  return { ...state, entries, marks };
}

/** Clear all progress, keeping the puzzle. History is discarded. */
export function resetGame(state: GameState): GameState {
  return { ...blankFrom(state), history: [], historyIndex: 0 };
}

/** Select a cell, or pass null to clear the selection. */
export function selectCell(state: GameState, cell: number | null): GameState {
  if (cell !== null && (cell < 0 || cell >= CELL_COUNT)) return state;
  return { ...state, selected: cell };
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
 * Everything the UI needs to render one cell.
 *
 * `staleMarks` is where "pencil marks are not candidates" earns its keep: a
 * mark the board has since ruled out is exactly the teaching moment a tutor
 * wants to point at.
 */
export function cellView(state: GameState, index: number): CellView {
  const value = state.entries[index]!;
  const marks = state.marks[index]!;
  const isError = value !== null && String(value) !== state.solution[index];

  let staleMarks: readonly number[] = [];
  if (value === null && marks.length > 0) {
    const grid = toGrid(state);
    const cell = grid.getCellByIndex(index);
    staleMarks = marks.filter((d) => !cell.candidateList.includes(d));
  }

  return {
    index,
    value,
    lock: isGiven(state, index) ? 'given' : 'editable',
    marks,
    isError,
    staleMarks,
  };
}
