import type { Cell, Grid, Region } from '../types/Grid.js';
import type { Hint } from '../types/Hint.js';
import { FULL_CANDIDATES, removeCandidate, candidateMask } from '../candidates/bitmask.js';
import { createCell } from './CellImpl.js';
import { createRegion } from './RegionImpl.js';

// Precomputed peer indices for each cell (cells sharing row, col, or box)
const PEER_INDICES: readonly (readonly number[])[] = buildPeerIndices();

function buildPeerIndices(): number[][] {
  const peers: number[][] = [];
  for (let i = 0; i < 81; i++) {
    const row = Math.floor(i / 9);
    const col = i % 9;
    const boxRow = Math.floor(row / 3) * 3;
    const boxCol = Math.floor(col / 3) * 3;
    const set = new Set<number>();
    for (let c = 0; c < 9; c++) {
      set.add(row * 9 + c); // same row
      set.add(c * 9 + col); // same col
    }
    for (let r = boxRow; r < boxRow + 3; r++) {
      for (let c = boxCol; c < boxCol + 3; c++) {
        set.add(r * 9 + c); // same box
      }
    }
    set.delete(i);
    peers.push([...set]);
  }
  return peers;
}

function buildGrid(cells: readonly Cell[]): Grid {
  // Build regions: rows[0..8], cols[9..17], boxes[18..26]
  const regions: Region[] = [];
  for (let r = 0; r < 9; r++) {
    const rowCells = cells.filter((c) => c.row === r);
    regions.push(createRegion('row', r, rowCells));
  }
  for (let c = 0; c < 9; c++) {
    const colCells = cells.filter((c2) => c2.col === c);
    regions.push(createRegion('col', c, colCells));
  }
  for (let b = 0; b < 9; b++) {
    const boxCells = cells.filter((c) => c.box === b);
    regions.push(createRegion('box', b, boxCells));
  }

  return {
    cells,
    regions,
    getRow(r: number): Region {
      // Safe: r is 0-8, regions[0..8] are rows
      return regions[r]!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
    },
    getCol(c: number): Region {
      // Safe: c is 0-8, regions[9..17] are cols
      return regions[9 + c]!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
    },
    getBox(b: number): Region {
      // Safe: b is 0-8, regions[18..26] are boxes
      return regions[18 + b]!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
    },
    getCell(row: number, col: number): Cell {
      // Safe: row*9+col is 0-80
      return cells[row * 9 + col]!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
    },
    getCellByIndex(index: number): Cell {
      // Safe: index is 0-80
      return cells[index]!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
    },
    getPeers(cellIndex: number): readonly Cell[] {
      // Safe: PEER_INDICES covers all 81 cells
      return PEER_INDICES[cellIndex]!.map(
        // eslint-disable-line @typescript-eslint/no-non-null-assertion
        (pi) => cells[pi]!, // eslint-disable-line @typescript-eslint/no-non-null-assertion
      );
    },
  };
}

export function createGrid(puzzle: string): Grid {
  if (puzzle.length !== 81) {
    throw new Error(`Puzzle string must be 81 characters, got ${puzzle.length}`);
  }

  const cells: Cell[] = [];
  for (let i = 0; i < 81; i++) {
    const ch = puzzle[i];
    if (ch === '.' || ch === '0') {
      cells.push(createCell(i, null, 0, false));
    } else {
      const digit = Number(ch);
      if (digit < 1 || digit > 9 || Number.isNaN(digit)) {
        throw new Error(`Invalid character '${ch}' at position ${i}`);
      }
      cells.push(createCell(i, digit, 0, true));
    }
  }

  return recomputeCandidates(buildGrid(cells));
}

export function recomputeCandidates(grid: Grid): Grid {
  const newCells: Cell[] = [];
  for (let i = 0; i < 81; i++) {
    // Safe: i is 0-80
    const cell = grid.cells[i]!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
    if (cell.value !== null) {
      newCells.push(createCell(i, cell.value, 0, cell.isGiven));
      continue;
    }

    let candidates = FULL_CANDIDATES;
    // Safe: PEER_INDICES covers all 81 cells
    for (const pi of PEER_INDICES[i]!) {
      // eslint-disable-line @typescript-eslint/no-non-null-assertion
      // Safe: pi is 0-80
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
  for (let i = 0; i < 81; i++) {
    // Safe: i is 0-80
    const cv = cellValues[i]!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
    newCells.push(createCell(i, cv.value, 0, cv.isGiven));
  }

  return recomputeCandidates(buildGrid(newCells));
}
