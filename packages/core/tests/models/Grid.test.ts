import { describe, it, expect } from 'vitest';
import { createGrid, EASY_PUZZLE, SOLVED_PUZZLE } from '../helpers.js';

describe('Grid', () => {
  it('creates a grid from an 81-character puzzle string', () => {
    const grid = createGrid(EASY_PUZZLE);
    expect(grid.cells).toHaveLength(81);
    expect(grid.regions).toHaveLength(27); // 9 rows + 9 cols + 9 boxes
  });

  it('rejects puzzle strings that are not 81 characters', () => {
    expect(() => createGrid('123')).toThrow('81 characters');
  });

  it('rejects invalid characters', () => {
    expect(() => createGrid('x' + '0'.repeat(80))).toThrow('Invalid character');
  });

  it('sets given cells with values and no candidates', () => {
    const grid = createGrid(EASY_PUZZLE);
    // First char is '5', so cell 0 should be given=true, value=5
    const cell0 = grid.getCellByIndex(0);
    expect(cell0.value).toBe(5);
    expect(cell0.isGiven).toBe(true);
    expect(cell0.candidates).toBe(0);
    expect(cell0.candidateCount).toBe(0);
  });

  it('computes candidates for unsolved cells', () => {
    const grid = createGrid(EASY_PUZZLE);
    // Position 2 is '0' → unsolved
    const cell2 = grid.getCellByIndex(2);
    expect(cell2.value).toBeNull();
    expect(cell2.isGiven).toBe(false);
    expect(cell2.candidateCount).toBeGreaterThan(0);
  });

  it('getRow returns correct row', () => {
    const grid = createGrid(EASY_PUZZLE);
    const row0 = grid.getRow(0);
    expect(row0.type).toBe('row');
    expect(row0.cells).toHaveLength(9);
    expect(row0.cells.every((c) => c.row === 0)).toBe(true);
  });

  it('getCol returns correct column', () => {
    const grid = createGrid(EASY_PUZZLE);
    const col3 = grid.getCol(3);
    expect(col3.type).toBe('col');
    expect(col3.cells).toHaveLength(9);
    expect(col3.cells.every((c) => c.col === 3)).toBe(true);
  });

  it('getBox returns correct box', () => {
    const grid = createGrid(EASY_PUZZLE);
    const box0 = grid.getBox(0);
    expect(box0.type).toBe('box');
    expect(box0.cells).toHaveLength(9);
  });

  it('getCell returns cell at row,col', () => {
    const grid = createGrid(EASY_PUZZLE);
    const cell = grid.getCell(1, 2);
    expect(cell.row).toBe(1);
    expect(cell.col).toBe(2);
    expect(cell.index).toBe(11);
  });

  it('getPeers returns 20 unique peers', () => {
    const grid = createGrid(EASY_PUZZLE);
    const peers = grid.getPeers(0);
    expect(peers.length).toBe(20);
    // No peer should be cell 0 itself
    expect(peers.every((p) => p.index !== 0)).toBe(true);
  });

  it('solved grid has no candidates on any cell', () => {
    const grid = createGrid(SOLVED_PUZZLE);
    for (const cell of grid.cells) {
      expect(cell.value).not.toBeNull();
      expect(cell.candidates).toBe(0);
    }
  });

  it('region.getCandidateCells returns only unsolved cells with that digit', () => {
    const grid = createGrid(EASY_PUZZLE);
    const row0 = grid.getRow(0);
    // Digit 5 is given in row 0, so no unsolved cell should have 5 as candidate
    const cells5 = row0.getCandidateCells(5);
    expect(cells5.every((c) => c.value === null)).toBe(true);
  });

  it('region.getUnsolvedCells returns only cells without values', () => {
    const grid = createGrid(EASY_PUZZLE);
    const row0 = grid.getRow(0);
    const unsolved = row0.getUnsolvedCells();
    expect(unsolved.every((c) => c.value === null)).toBe(true);
  });
});
