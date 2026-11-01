import { describe, expect, it } from 'vitest';
import { applyMove, createGame, markedCandidates, placeWithAutoSolve, undo } from '../src/index.js';
import type { GameState } from '../src/index.js';

const SOLVED = '534678912672195348198342567859761423426853791713924856961537284287419635345286179';

/** The solution with some cells blanked — a near-finished board. */
function withBlanks(cells: readonly number[]): GameState {
  return createGame([...SOLVED].map((d, i) => (cells.includes(i) ? '0' : d)).join(''));
}

// Blanks: R1C1 (5) and R1C2 (3) in box 1, R1C9 (2) in box 3, R9C1 (3) in
// box 7, R9C9 (9) in box 9. R1C1 starts with two candidates, 3 and 5; every
// other blank is already a naked single.
const BLANKS = [0, 1, 8, 72, 80];

describe('placeWithAutoSolve', () => {
  it('fills singles in the placed cell’s box, and nowhere else, at "box" scope', () => {
    const { state, autoFilled } = placeWithAutoSolve(withBlanks(BLANKS), 1, 3, 'box');
    expect(autoFilled).toEqual([0]);
    expect(state.entries[0]).toBe(5);
    expect([8, 72, 80].map((c) => state.entries[c])).toEqual([null, null, null]);
  });

  it('reaches the placed cell’s row and column too at "lines" scope', () => {
    const { state, autoFilled } = placeWithAutoSolve(withBlanks(BLANKS), 1, 3, 'lines');
    expect([...autoFilled].sort((a, b) => a - b)).toEqual([0, 8]);
    expect(state.entries[8]).toBe(2);
    expect([72, 80].map((c) => state.entries[c])).toEqual([null, null]);
  });

  it('chains — one fill uncovers the next — at "board" scope', () => {
    // R1C1 is not a single until R1C2 is filled: the chain has to reach it.
    expect(markedCandidates(withBlanks(BLANKS), 0)).toEqual([3, 5]);
    const { state, autoFilled } = placeWithAutoSolve(withBlanks(BLANKS), 80, 9, 'board');
    expect(autoFilled).toContain(0);
    expect(state.entries.every((v, i) => v === Number(SOLVED[i]))).toBe(true);
  });

  it('is one undo step: the placement and everything it filled', () => {
    const start = withBlanks(BLANKS);
    const { state } = placeWithAutoSolve(start, 1, 3, 'lines');
    expect(state.history).toHaveLength(1);
    expect(undo(state).entries).toEqual(start.entries);
  });

  it('does nothing when the placement itself is refused', () => {
    const start = withBlanks(BLANKS);
    // R2C1 is a given.
    expect(placeWithAutoSolve(start, 9, 6, 'board')).toEqual({ state: start, autoFilled: [] });
  });
});

describe('auto-solve acts on the player’s marks, not the solution', () => {
  // Adds R1C3 (4) to the blanks: a second placement inside box 1.
  const blanks = [...BLANKS, 2];

  it('fills what a wrong strike implies, then stops at the contradiction', () => {
    // Striking 5 from R1C1 is a mistake: 5 is its answer. Its marks now say 3.
    let game = withBlanks(blanks);
    game = applyMove(game, { kind: 'addNote', cell: 0, digit: 5, note: 'excluded' });
    expect(markedCandidates(game, 0)).toEqual([3]);

    const { state, autoFilled } = placeWithAutoSolve(game, 2, 4, 'box');
    // The bad mark gives a bad fill...
    expect(state.entries[0]).toBe(3);
    // ...which leaves R1C2 with no candidates at all: left empty, not guessed.
    expect(markedCandidates(state, 1)).toEqual([]);
    expect(state.entries[1]).toBeNull();
    expect(autoFilled).toEqual([0]);
  });

  it('treats a noted cell’s notes as its candidates', () => {
    let game = withBlanks(blanks);
    game = applyMove(game, { kind: 'addNote', cell: 0, digit: 3, note: 'included' });
    expect(markedCandidates(game, 0)).toEqual([3]);
    expect(placeWithAutoSolve(game, 2, 4, 'box').state.entries[0]).toBe(3);
  });

  it('leaves a cell with no candidates empty rather than guessing', () => {
    let game = withBlanks(blanks);
    game = applyMove(game, { kind: 'addNote', cell: 0, digit: 5, note: 'excluded' });
    // Placing R1C2 = 3 takes R1C1's last marked candidate.
    const { state, autoFilled } = placeWithAutoSolve(game, 1, 3, 'box');
    expect(markedCandidates(state, 0)).toEqual([]);
    expect(state.entries[0]).toBeNull();
    expect(autoFilled).not.toContain(0);
  });
});
