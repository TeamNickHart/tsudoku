import { describe, expect, it } from 'vitest';
import { createGrid } from '@tsudoku/core';
import { findDuplicate, hasNoDoubles } from '../src/NoDoubles.js';

const EASY = '530070000600195000098000060800060003400803001700020006060000280000419005000080079';
const SOLVED = '534678912672195348198342567859761423426853791713924856961537284287419635345286179';

describe('hasNoDoubles', () => {
  it('accepts a valid puzzle', () => {
    expect(hasNoDoubles(createGrid(EASY))).toBe(true);
  });

  it('accepts a completed grid', () => {
    expect(hasNoDoubles(createGrid(SOLVED))).toBe(true);
  });

  it('accepts an empty grid', () => {
    expect(hasNoDoubles(createGrid('.'.repeat(81)))).toBe(true);
  });

  it('rejects a duplicate in a row', () => {
    expect(hasNoDoubles(createGrid(`5.5${'.'.repeat(78)}`))).toBe(false);
  });

  it('rejects a duplicate in a column', () => {
    const g = '.'.repeat(81).split('');
    g[0] = '7';
    g[9 * 4] = '7'; // same column 0, row 5
    expect(hasNoDoubles(createGrid(g.join('')))).toBe(false);
  });

  it('rejects a duplicate in a box', () => {
    const g = '.'.repeat(81).split('');
    g[0] = '3';
    g[10] = '3'; // r2c2 — same top-left box
    expect(hasNoDoubles(createGrid(g.join('')))).toBe(false);
  });
});

describe('findDuplicate', () => {
  it('returns null for a valid grid', () => {
    expect(findDuplicate(createGrid(EASY))).toBeNull();
  });

  it('identifies the offending digit', () => {
    const found = findDuplicate(createGrid(`5.5${'.'.repeat(78)}`));
    expect(found).not.toBeNull();
    expect(found!.digit).toBe(5);
    expect(found!.region).toBe('row 1');
  });
});
