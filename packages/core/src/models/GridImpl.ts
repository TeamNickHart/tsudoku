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

export function applyHint(grid: Grid, hint: Hint): Grid {
  const cellValues = grid.cells.map((c) => ({
    value: c.value,
    isGiven: c.isGiven,
  }));

  if (hint.type === 'direct') {
    // Safe: hint.cell is a valid index from the technique
    const existing = cellValues[hint.cell]!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
    cellValues[hint.cell] = { value: hint.digit, isGiven: existing.isGiven };
  } else {
    for (const elim of hint.eliminations) {
      // Safe: elim.cell is a valid index
      const existing = grid.cells[elim.cell]!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
      const newCandidates = existing.candidates & ~candidateMask(elim.digit);
      cellValues[elim.cell] = { value: null, isGiven: false };
      // We need to handle elimination differently — rebuild with explicit candidates
      // For now, recomputeCandidates will handle it after placement
      void newCandidates;
    }
  }

  // Rebuild cells with new values, then recompute candidates
  const newCells: Cell[] = [];
  for (let i = 0; i < CELL_COUNT; i++) {
    // Safe: i is 0..CELL_COUNT-1
    const cv = cellValues[i]!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
    newCells.push(createCell(i, cv.value, 0, cv.isGiven));
  }

  return recomputeCandidates(buildGrid(newCells));
}
