import { CELL_COUNT, createGrid } from '@tsudoku/core';
import type { Grid } from '@tsudoku/core';
import { countSolutions, solveRandom } from '@tsudoku/solver';
import type { Rng } from '@tsudoku/solver';
import { NO_SYMMETRY } from './Symmetry.js';
import type { Symmetry } from './Symmetry.js';

/**
 * Puzzle generation — port of SE's `diuf/sudoku/generator/Generator.java`.
 *
 * The algorithm, which is simpler than it sounds:
 *
 * 1. Solve an **empty** grid with a randomised digit order. A random solution
 *    of an empty grid *is* a random completed board.
 * 2. Shuffle the 81 cell indexes.
 * 3. Walk that shuffled order, clearing each cell (and its symmetric
 *    partners). Keep a removal only if the puzzle still has exactly one
 *    solution; otherwise put the digits back and move on.
 * 4. Stop once a full pass removes nothing.
 *
 * The result is a *minimal* puzzle for that symmetry: no further cell can be
 * removed without admitting a second solution.
 *
 * SE ref: diuf/sudoku/generator/Generator.java
 */

export interface GenerateOptions {
  /** Cell-removal pattern. Defaults to none, which gives the fewest clues. */
  readonly symmetry?: Symmetry;
  /**
   * Randomness source. Defaults to `Math.random`.
   *
   * Pass a seeded generator for reproducible output — a corpus that changes
   * every run is painful to debug and impossible to diff.
   */
  readonly rng?: Rng;
}

/** A generated puzzle and the solution it was carved from. */
export interface GeneratedPuzzle {
  /** 81 chars, digits and '.' for blanks. */
  readonly puzzle: string;
  /** 81 chars, all digits. */
  readonly solution: string;
  /** How many cells hold a given. */
  readonly clueCount: number;
}

function toStringGrid(grid: Grid): string {
  let out = '';
  for (let i = 0; i < CELL_COUNT; i++) {
    // Safe: i is a valid cell index
    const value = grid.cells[i]!.value;
    out += value === null ? '.' : String(value);
  }
  return out;
}

/**
 * SE shuffles by swapping random pairs rather than a Fisher-Yates pass. Kept
 * as SE has it: the distribution is slightly less uniform, but this is a port,
 * and the difference has no bearing on puzzle validity.
 *
 * SE ref: Generator.generate — "Build running indexes" / "Shuffle"
 */
function shuffledIndexes(rng: Rng): number[] {
  const indexes = Array.from({ length: CELL_COUNT }, (_, i) => i);
  for (let i = 0; i < CELL_COUNT; i++) {
    const p1 = Math.floor(rng() * CELL_COUNT);
    const p2 = Math.floor(rng() * CELL_COUNT);
    const temp = indexes[p1]!;
    indexes[p1] = indexes[p2]!;
    indexes[p2] = temp;
  }
  return indexes;
}

/**
 * Generate a puzzle with exactly one solution.
 *
 * @throws {Error} if a random solution cannot be found, which should not
 *   happen for an empty grid and would indicate a solver bug.
 */
export function generate(options: GenerateOptions = {}): GeneratedPuzzle {
  const rng = options.rng ?? Math.random;
  const symmetry = options.symmetry ?? NO_SYMMETRY;

  // (1) A random solution of an empty grid is a random completed board.
  const solved = solveRandom(createGrid('.'.repeat(CELL_COUNT)), rng);
  if (solved === null) {
    throw new Error('Could not solve an empty grid — this indicates a solver bug');
  }
  const solution = toStringGrid(solved);

  // Work on a mutable char array; the Grid is re-derived only to count
  // solutions, which is the expensive step.
  const cells = solution.split('');

  // (2) SE walks a shuffled index list, starting from a random offset.
  const indexes = shuffledIndexes(rng);

  // (3) Remove cells while the solution stays unique.
  let index = Math.floor(rng() * CELL_COUNT);
  let isSuccess = true;
  while (isSuccess) {
    isSuccess = false;
    let countDown = CELL_COUNT;

    do {
      // Safe: index is kept in range by the modulo below
      const target = indexes[index]!;
      const points = symmetry.pointsFor(target);

      // Clear the cell and its symmetric partners, remembering what was there.
      const removed: { cell: number; digit: string }[] = [];
      for (const point of points) {
        if (cells[point] !== '.') {
          removed.push({ cell: point, digit: cells[point]! });
          cells[point] = '.';
        }
      }

      if (removed.length > 0) {
        if (countSolutions(createGrid(cells.join(''))) === 1) {
          // Still unique — the removal stands.
          isSuccess = true;
        } else {
          // Put them back and try the next cell.
          for (const { cell, digit } of removed) {
            cells[cell] = digit;
          }
        }
      }

      index = (index + 1) % CELL_COUNT;
      countDown -= 1;
    } while (!isSuccess && countDown > 0);
  }

  const puzzle = cells.join('');
  return {
    puzzle,
    solution,
    clueCount: puzzle.length - puzzle.split('.').length + 1,
  };
}

/**
 * Generate puzzles until `count` of them land within a clue-count range.
 *
 * Difficulty is deliberately *not* a parameter. SE rates a puzzle by solving
 * it with the full technique set, and TSudoku only implements through Phase 2
 * — so the honest workflow is to generate here and rate with the real SE CLI
 * via `tools/se-reference/intake.sh`, which is what the corpus pipeline
 * already does.
 */
export function generateMany(count: number, options: GenerateOptions = {}): GeneratedPuzzle[] {
  const out: GeneratedPuzzle[] = [];
  for (let i = 0; i < count; i++) {
    out.push(generate(options));
  }
  return out;
}
