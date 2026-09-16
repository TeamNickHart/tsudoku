// 9-bit bitmask where bit (d-1) represents digit d as a candidate.
// 0b111111111 (511) = all digits 1–9 are candidates.

export const FULL_CANDIDATES = 0b111111111;

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
  for (let d = 1; d <= 9; d++) {
    if (hasCandidate(candidates, d)) {
      result.push(d);
    }
  }
  return result;
}

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
