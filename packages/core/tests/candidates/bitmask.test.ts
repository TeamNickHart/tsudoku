import { describe, it, expect } from 'vitest';
import {
  FULL_CANDIDATES,
  candidateMask,
  hasCandidate,
  addCandidate,
  removeCandidate,
  candidateList,
  candidateCount,
  candidateIntersection,
  candidateUnion,
} from '../../src/candidates/bitmask.js';

describe('bitmask', () => {
  it('FULL_CANDIDATES represents all 9 digits', () => {
    expect(FULL_CANDIDATES).toBe(0b111111111);
    expect(candidateCount(FULL_CANDIDATES)).toBe(9);
  });

  it('candidateMask returns correct bit for each digit', () => {
    expect(candidateMask(1)).toBe(1);
    expect(candidateMask(5)).toBe(16);
    expect(candidateMask(9)).toBe(256);
  });

  it('hasCandidate checks single bit', () => {
    const mask = candidateMask(3) | candidateMask(7); // bits for 3 and 7
    expect(hasCandidate(mask, 3)).toBe(true);
    expect(hasCandidate(mask, 7)).toBe(true);
    expect(hasCandidate(mask, 1)).toBe(false);
    expect(hasCandidate(mask, 9)).toBe(false);
  });

  it('addCandidate sets a bit', () => {
    let c = 0;
    c = addCandidate(c, 4);
    expect(hasCandidate(c, 4)).toBe(true);
    expect(candidateCount(c)).toBe(1);
  });

  it('removeCandidate clears a bit', () => {
    let c = FULL_CANDIDATES;
    c = removeCandidate(c, 5);
    expect(hasCandidate(c, 5)).toBe(false);
    expect(candidateCount(c)).toBe(8);
  });

  it('candidateList returns digits in order', () => {
    const c = candidateMask(2) | candidateMask(5) | candidateMask(9);
    expect(candidateList(c)).toEqual([2, 5, 9]);
  });

  it('candidateCount counts set bits', () => {
    expect(candidateCount(0)).toBe(0);
    expect(candidateCount(candidateMask(1))).toBe(1);
    expect(candidateCount(candidateMask(3) | candidateMask(7))).toBe(2);
    expect(candidateCount(FULL_CANDIDATES)).toBe(9);
  });

  it('candidateIntersection ANDs two masks', () => {
    const a = candidateMask(1) | candidateMask(3) | candidateMask(5);
    const b = candidateMask(3) | candidateMask(5) | candidateMask(7);
    expect(candidateList(candidateIntersection(a, b))).toEqual([3, 5]);
  });

  it('candidateUnion ORs two masks', () => {
    const a = candidateMask(1) | candidateMask(3);
    const b = candidateMask(3) | candidateMask(7);
    expect(candidateList(candidateUnion(a, b))).toEqual([1, 3, 7]);
  });
});
