import { describe, expect, it } from 'vitest';
import {
  BOXES_PER_ROW,
  BOX_HEIGHT,
  BOX_OFFSET,
  BOX_WIDTH,
  CELL_COUNT,
  COL_OFFSET,
  REGION_COUNT,
  ROW_OFFSET,
  SIZE,
  boxOf,
  colOf,
  indexOf,
  rowOf,
} from '../../src/models/board.js';

describe('board geometry', () => {
  it('derives dimensions consistently', () => {
    expect(SIZE).toBe(9);
    expect(CELL_COUNT).toBe(SIZE * SIZE);
    expect(BOX_WIDTH * BOXES_PER_ROW).toBe(SIZE);
    expect(REGION_COUNT).toBe(SIZE * 3);
  });

  it('lays out region groups without overlap', () => {
    expect(ROW_OFFSET).toBe(0);
    expect(COL_OFFSET).toBe(SIZE);
    expect(BOX_OFFSET).toBe(SIZE * 2);
    expect(BOX_OFFSET + SIZE).toBe(REGION_COUNT);
  });

  it('round-trips index <-> row/col for every cell', () => {
    for (let i = 0; i < CELL_COUNT; i++) {
      expect(indexOf(rowOf(i), colOf(i))).toBe(i);
    }
  });

  it('keeps row, col and box within range for every cell', () => {
    for (let i = 0; i < CELL_COUNT; i++) {
      const row = rowOf(i);
      const col = colOf(i);
      const box = boxOf(row, col);
      expect(row).toBeGreaterThanOrEqual(0);
      expect(row).toBeLessThan(SIZE);
      expect(col).toBeGreaterThanOrEqual(0);
      expect(col).toBeLessThan(SIZE);
      expect(box).toBeGreaterThanOrEqual(0);
      expect(box).toBeLessThan(SIZE);
    }
  });

  it('assigns exactly BOX_WIDTH * BOX_HEIGHT cells to each box', () => {
    const counts = new Array<number>(SIZE).fill(0);
    for (let i = 0; i < CELL_COUNT; i++) {
      counts[boxOf(rowOf(i), colOf(i))]! += 1;
    }
    for (const count of counts) {
      expect(count).toBe(BOX_WIDTH * BOX_HEIGHT);
    }
  });

  it('matches the known 9x9 box layout', () => {
    // Corners and centre of a standard grid.
    expect(boxOf(0, 0)).toBe(0);
    expect(boxOf(0, 8)).toBe(2);
    expect(boxOf(4, 4)).toBe(4);
    expect(boxOf(8, 0)).toBe(6);
    expect(boxOf(8, 8)).toBe(8);
  });
});
