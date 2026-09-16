import type { Cell, Region, RegionType } from '../types/Grid.js';
import { hasCandidate } from '../candidates/bitmask.js';

export function createRegion(type: RegionType, index: number, cells: readonly Cell[]): Region {
  return {
    type,
    index,
    cells,
    getCandidateCells(digit: number): readonly Cell[] {
      return cells.filter((c) => c.value === null && hasCandidate(c.candidates, digit));
    },
    getUnsolvedCells(): readonly Cell[] {
      return cells.filter((c) => c.value === null);
    },
  };
}
