import type { Cell } from '../types/Grid.js';
import { candidateCount, candidateList } from '../candidates/bitmask.js';
import { boxOf, colOf, rowOf } from './board.js';

export function createCell(
  index: number,
  value: number | null,
  candidates: number,
  isGiven: boolean,
): Cell {
  const row = rowOf(index);
  const col = colOf(index);
  const box = boxOf(row, col);
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
