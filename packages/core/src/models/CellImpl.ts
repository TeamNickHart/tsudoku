import type { Cell } from '../types/Grid.js';
import { candidateCount, candidateList } from '../candidates/bitmask.js';

export function createCell(
  index: number,
  value: number | null,
  candidates: number,
  isGiven: boolean,
): Cell {
  const row = Math.floor(index / 9);
  const col = index % 9;
  const box = Math.floor(row / 3) * 3 + Math.floor(col / 3);
  const list = candidateList(candidates);
  const count = candidateCount(candidates);

  return {
    index,
    row,
    col,
    box,
    value,
    candidates,
    isGiven,
    candidateList: list,
    candidateCount: count,
  };
}
