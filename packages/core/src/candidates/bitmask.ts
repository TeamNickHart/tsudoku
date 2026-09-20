// Bitmask where bit (d-1) represents digit d as a candidate.
// 0b111111111 (511) = all digits 1–9 are candidates.
//
// NOTE: candidates are a JS number used with bitwise operators, which are
// 32-bit — so this representation caps out at 32 digits. `candidateCount`
// below is further specialised for <= 9 bits. See models/board.ts.

import { SIZE } from '../models/board.js';

export const FULL_CANDIDATES = (1 << SIZE) - 1;

export function candidateMask(digit: number): number {
  return 1 << (digit - 1);
}

export function hasCandidate(candidates: number, digit: number): boolean {
  return (candidates & candidateMask(digit)) !== 0;
}

export function addCandidate(candidates: number, digit: number): number {
  return candidates | candidateMask(digit);
}

export function removeCandidate(candidates: number, digit: number): number {
  return candidates & ~candidateMask(digit);
}

export function candidateList(candidates: number): readonly number[] {
  const result: number[] = [];
  for (let d = 1; d <= SIZE; d++) {
    if (hasCandidate(candidates, d)) {
      result.push(d);
    }
  }
  return result;
}

/**
 * Population count, specialised for a 9-bit mask.
 *
 * The magic constants below are only correct for masks of <= 9 bits (verified
 * exhaustively over 0..511). Widening the board past 9 digits requires
 * widening these too.
 */
export function candidateCount(candidates: number): number {
  let n = candidates;
  n = n - ((n >> 1) & 0x155);
  n = (n & 0x333) + ((n >> 2) & 0x333);
  n = (n + (n >> 4)) & 0x10f;
  return (n + (n >> 8)) & 0xf;
}

export function candidateIntersection(a: number, b: number): number {
  return a & b;
}

export function candidateUnion(a: number, b: number): number {
  return a | b;
}
