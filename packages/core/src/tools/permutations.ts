/**
 * Combination enumeration — port of SE's `diuf/sudoku/tools/Permutations.java`.
 *
 * Every technique that looks for a *set* of cells or digits needs to walk all
 * C(n, k) combinations: naked and hidden sets over digits, Fisherman over
 * rows or columns. SE has one Permutations class for all of them, so this is
 * shared rather than duplicated per technique.
 *
 * Uses Gosper's hack from "Hacker's Delight", exactly as SE does — the
 * iteration order matters, since it determines which hint a technique reports
 * first when several apply.
 */

/**
 * All ways to choose `countOnes` positions from `countBits`, each returned as
 * a sorted array of indices.
 *
 * SE ref: Permutations.hasNext / next / nextBitNums
 */
export function permutations(countOnes: number, countBits: number): number[][] {
  const results: number[][] = [];
  if (countBits === 0) return results;

  let value = (1 << countOnes) - 1;
  const mask = (1 << (countBits - countOnes)) - 1;
  let isLast = false;

  // SE: while (perm.hasNext()) { int[] values = perm.nextBitNums(); ... }
  // hasNext() returns !isLast (before update), then sets isLast for next call
  for (;;) {
    const hasNext = !isLast;
    isLast = (value & -value & mask) === 0;
    if (!hasNext) break;

    // SE: nextBitNums() — convert bitmask to array of set bit indices
    const bitNums: number[] = [];
    const current = value;
    for (let src = 0; src < countBits; src++) {
      if ((current & (1 << src)) !== 0) {
        bitNums.push(src);
      }
    }
    results.push(bitNums);

    // SE: next() — advance to the next permutation
    if (!isLast) {
      const smallest = value & -value;
      const ripple = value + smallest;
      const ones = ((value ^ ripple) >>> 2) / smallest;
      value = ripple | ones;
    }
  }

  return results;
}
