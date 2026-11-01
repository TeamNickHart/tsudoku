import { describe, expect, it } from 'vitest';
import {
  applyMove,
  createGame,
  deadEndCells,
  isDigitPlacedInPeer,
  isSolvable,
  placeWithAutoSolve,
  redo,
  undoUntilSolvable,
} from '../src/index.js';
import type { GameState } from '../src/index.js';

const EASY = '530070000600195000098000060800060003400803001700020006060000280000419005000080079';
const SOLVED = '534678912672195348198342567859761423426853791713924856961537284287419635345286179';

const empties = (game: GameState): number[] =>
  game.entries.flatMap((v, i) => (v === null ? [i] : []));

/** Place the correct digit in each of `cells`, one move each. */
function placeCorrect(game: GameState, cells: readonly number[]): GameState {
  return cells.reduce(
    (g, cell) => applyMove(g, { kind: 'setValue', cell, digit: Number(g.solution[cell]) }),
    game,
  );
}

describe('isSolvable', () => {
  it('holds on a fresh board and after correct moves', () => {
    const game = createGame(EASY);
    expect(isSolvable(game)).toBe(true);
    expect(isSolvable(placeCorrect(game, empties(game).slice(0, 5)))).toBe(true);
  });

  it('fails once a wrong value is placed', () => {
    const game = createGame(EASY);
    const [cell] = empties(game);
    if (cell === undefined) throw new Error('fixture');
    const wrong = (Number(game.solution[cell]) % 9) + 1;
    expect(isSolvable(applyMove(game, { kind: 'setValue', cell, digit: wrong }))).toBe(false);
  });

  it('fails once a cell’s answer is struck, or left out of its notes', () => {
    const game = createGame(EASY);
    const [cell] = empties(game);
    if (cell === undefined) throw new Error('fixture');
    const answer = Number(game.solution[cell]);
    expect(
      isSolvable(applyMove(game, { kind: 'addNote', cell, digit: answer, note: 'excluded' })),
    ).toBe(false);
    // A digit the cell can take but that is not its answer.
    const other = [1, 2, 3, 4, 5, 6, 7, 8, 9].find(
      (d) => d !== answer && !isDigitPlacedInPeer(game, cell, d),
    );
    if (other === undefined) throw new Error('fixture');
    expect(
      isSolvable(applyMove(game, { kind: 'addNote', cell, digit: other, note: 'included' })),
    ).toBe(false);
  });

  it('ignores scratch marks', () => {
    const game = createGame(EASY);
    const [cell] = empties(game);
    if (cell === undefined) throw new Error('fixture');
    const other = (Number(game.solution[cell]) % 9) + 1;
    expect(
      isSolvable(applyMove(game, { kind: 'addNote', cell, digit: other, note: 'scratch' })),
    ).toBe(true);
  });
});

describe('undoUntilSolvable', () => {
  it('steps back to just before the mistake, keeping the good moves before it', () => {
    const start = createGame(EASY);
    const [a, b, bad, c, d] = empties(start);
    if (d === undefined) throw new Error('fixture');
    let game = placeCorrect(start, [a!, b!]);
    const beforeMistake = game;
    game = applyMove(game, {
      kind: 'setValue',
      cell: bad!,
      digit: (Number(start.solution[bad!]) % 9) + 1,
    });
    game = placeCorrect(game, [c!, d]);

    const recovered = undoUntilSolvable(game);
    expect(recovered.historyIndex).toBe(2);
    expect(recovered.entries).toEqual(beforeMistake.entries);
    expect(isSolvable(recovered)).toBe(true);
  });

  it('is ordinary undo, so redo brings the steps back', () => {
    const start = createGame(EASY);
    const [cell] = empties(start);
    if (cell === undefined) throw new Error('fixture');
    const wrong = applyMove(start, {
      kind: 'setValue',
      cell,
      digit: (Number(start.solution[cell]) % 9) + 1,
    });
    expect(redo(undoUntilSolvable(wrong)).entries).toEqual(wrong.entries);
  });

  it('leaves a solvable board alone', () => {
    const game = placeCorrect(createGame(EASY), empties(createGame(EASY)).slice(0, 3));
    expect(undoUntilSolvable(game)).toBe(game);
  });
});

describe('a dead end', () => {
  // The auto-solve dead end: a near-solved board where a wrong strike in R1C1
  // leads auto-solve to a wrong fill, leaving R1C2 with no possible value.
  const BLANKS = [0, 1, 2, 8, 72, 80];
  const board = createGame([...SOLVED].map((d, i) => (BLANKS.includes(i) ? '0' : d)).join(''));

  it('is found, and recovering goes back to before the wrong strike', () => {
    let game = applyMove(board, { kind: 'addNote', cell: 0, digit: 5, note: 'excluded' });
    game = placeWithAutoSolve(game, 2, 4, 'box').state;
    // R1C2 has nothing left; so does R9C1, whose answer 3 the wrong fill
    // just took from column 1.
    expect(deadEndCells(game)).toEqual([1, 72]);
    expect(isSolvable(game)).toBe(false);

    const recovered = undoUntilSolvable(game);
    expect(recovered.historyIndex).toBe(0);
    expect(deadEndCells(recovered)).toEqual([]);
  });

  it('is never reported on a solvable board', () => {
    expect(deadEndCells(placeCorrect(board, [2, 1]))).toEqual([]);
  });
});
