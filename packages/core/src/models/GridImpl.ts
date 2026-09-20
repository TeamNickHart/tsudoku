import type { Cell, Grid, Region } from '../types/Grid.js';
import type { Hint } from '../types/Hint.js';
import { FULL_CANDIDATES, removeCandidate, candidateMask } from '../candidates/bitmask.js';
import { createCell } from './CellImpl.js';
import { createRegion } from './RegionImpl.js';
import {
  BOX_HEIGHT,
  BOX_OFFSET,
  BOX_WIDTH,
  CELL_COUNT,
  COL_OFFSET,
  SIZE,
  colOf,
  indexOf,
  rowOf,
} from './board.js';

// Precomputed peer indices for each cell (cells sharing row, col, or box)
const PEER_INDICES: readonly (readonly number[])[] = buildPeerIndices();

function buildPeerIndices(): number[][] {
  const peers: number[][] = [];
  for (let i = 0; i < CELL_COUNT; i++) {
    const row = rowOf(i);
    const col = colOf(i);
    const boxRow = Math.floor(row / BOX_HEIGHT) * BOX_HEIGHT;
    const boxCol = Math.floor(col / BOX_WIDTH) * BOX_WIDTH;
    const set = new Set<number>();
    for (let c = 0; c < SIZE; c++) {
      set.add(indexOf(row, c)); // same row
      set.add(indexOf(c, col)); // same col
    }
    for (let r = boxRow; r < boxRow + BOX_HEIGHT; r++) {
      for (let c = boxCol; c < boxCol + BOX_WIDTH; c++) {
        set.add(indexOf(r, c)); // same box
      }
    }
    set.delete(i);
    peers.push([...set]);
  }
  return peers;
}

function buildGrid(cells: readonly Cell[]): Grid {
  // Build regions in layout order: rows, then columns, then boxes.
  const regions: Region[] = [];
  for (let r = 0; r < SIZE; r++) {
    const rowCells = cells.filter((c) => c.row === r);
    regions.push(createRegion('row', r, rowCells));
  }
  for (let c = 0; c < SIZE; c++) {
    const colCells = cells.filter((c2) => c2.col === c);
    regions.push(createRegion('col', c, colCells));
  }
  for (let b = 0; b < SIZE; b++) {
    const boxCells = cells.filter((c) => c.box === b);
    regions.push(createRegion('box', b, boxCells));
  }

  return {
    cells,
    regions,
    getRow(r: number): Region {
      // Safe: r is 0..SIZE-1, and the row regions occupy that leading range
      return regions[r]!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
    },
    getCol(c: number): Region {
      // Safe: c is 0..SIZE-1, offset into the column group
      return regions[COL_OFFSET + c]!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
    },
    getBox(b: number): Region {
      // Safe: b is 0..SIZE-1, offset into the box group
      return regions[BOX_OFFSET + b]!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
    },
    getCell(row: number, col: number): Cell {
      // Safe: indexOf(row, col) is 0..CELL_COUNT-1
      return cells[indexOf(row, col)]!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
    },
    getCellByIndex(index: number): Cell {
      // Safe: index is 0..CELL_COUNT-1
      return cells[index]!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
    },
    getPeers(cellIndex: number): readonly Cell[] {
      // Safe: PEER_INDICES covers every cell
      return PEER_INDICES[cellIndex]!.map(
        // eslint-disable-line @typescript-eslint/no-non-null-assertion
        (pi) => cells[pi]!, // eslint-disable-line @typescript-eslint/no-non-null-assertion
      );
    },
  };
}

export function createGrid(puzzle: string): Grid {
  if (puzzle.length !== CELL_COUNT) {
    throw new Error(`Puzzle string must be ${CELL_COUNT} characters, got ${puzzle.length}`);
  }

  const cells: Cell[] = [];
  for (let i = 0; i < CELL_COUNT; i++) {
    const ch = puzzle[i];
    if (ch === '.' || ch === '0') {
      cells.push(createCell(i, null, 0, false));
    } else {
      const digit = Number(ch);
      if (digit < 1 || digit > SIZE || Number.isNaN(digit)) {
        throw new Error(`Invalid character '${ch}' at position ${i}`);
      }
      cells.push(createCell(i, digit, 0, true));
    }
  }

  return recomputeCandidates(buildGrid(cells));
}

export function recomputeCandidates(grid: Grid): Grid {
  const newCells: Cell[] = [];
  for (let i = 0; i < CELL_COUNT; i++) {
    // Safe: i is 0..CELL_COUNT-1
    const cell = grid.cells[i]!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
    if (cell.value !== null) {
      newCells.push(createCell(i, cell.value, 0, cell.isGiven));
      continue;
    }

    let candidates = FULL_CANDIDATES;
    // Safe: PEER_INDICES covers every cell
    for (const pi of PEER_INDICES[i]!) {
      // eslint-disable-line @typescript-eslint/no-non-null-assertion
      // Safe: pi is a valid cell index
      const peer = grid.cells[pi]!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
      if (peer.value !== null) {
        candidates = removeCandidate(candidates, peer.value);
      }
    }
    newCells.push(createCell(i, null, candidates, false));
  }

  return buildGrid(newCells);
}

/**
 * Apply a hint, returning a new grid.
 *
 * ## Why this does not just call `recomputeCandidates`
 *
 * `recomputeCandidates` derives candidates from *values* — a digit is a
 * candidate unless a peer already holds it. That is correct for a placement,
 * but it is exactly wrong for an elimination: an elimination is a candidate
 * that **logic** ruled out while arithmetic would happily put it back.
 *
 * So the grid has to be able to carry explicit candidates. This builds the new
 * cells directly, preserving each unsolved cell's existing candidate mask,
 * applying the hint's change, and then cancelling the placed digit from peers
 * the way SE's `setValueAndCancel` does.
 *
 * SE ref: Grid.setValueAndCancel / Solver.cancelPotentialValues
 */
export function applyHint(grid: Grid, hint: Hint): Grid {
  // Start from the current state, candidates included.
  const values: (number | null)[] = [];
  const candidates: number[] = [];
  const givens: boolean[] = [];
  for (let i = 0; i < CELL_COUNT; i++) {
    // Safe: i is 0..CELL_COUNT-1
    const cell = grid.cells[i]!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
    values.push(cell.value);
    candidates.push(cell.candidates);
    givens.push(cell.isGiven);
  }

  if (hint.type === 'direct') {
    values[hint.cell] = hint.digit;
    candidates[hint.cell] = 0;
    // Cancel the placed digit from every peer, as SE does on placement.
    // Safe: hint.cell is a valid index from the technique
    for (const pi of PEER_INDICES[hint.cell]!) {
      // eslint-disable-line @typescript-eslint/no-non-null-assertion
      // Safe: pi is a valid cell index
      candidates[pi] = removeCandidate(candidates[pi]!, hint.digit); // eslint-disable-line @typescript-eslint/no-non-null-assertion
    }
  } else {
    for (const elim of hint.eliminations) {
      // Only unsolved cells have candidates to remove.
      if (values[elim.cell] === null) {
        // Safe: elim.cell is a valid index from the technique
        candidates[elim.cell] = candidates[elim.cell]! & ~candidateMask(elim.digit); // eslint-disable-line @typescript-eslint/no-non-null-assertion
      }
    }
  }

  const newCells: Cell[] = [];
  for (let i = 0; i < CELL_COUNT; i++) {
    // Safe: i is 0..CELL_COUNT-1
    newCells.push(createCell(i, values[i]!, values[i] === null ? candidates[i]! : 0, givens[i]!)); // eslint-disable-line @typescript-eslint/no-non-null-assertion
  }

  return buildGrid(newCells);
}
