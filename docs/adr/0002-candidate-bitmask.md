# ADR-0002: Candidate Bitmask Representation

- **Status:** Accepted
- **Date:** 2026-03-07
- **Phase:** 0
- **Deciders:** Nick Hart

## Context

Each cell in a Sudoku grid has a set of candidate digits (1-9). We need an efficient, ergonomic representation that supports fast set operations (union, intersection, difference, count).

## Decision

We will represent candidates as a 9-bit integer where bit `d-1` represents digit `d`.

```typescript
const candidateMask = (digit: number): number => 1 << (digit - 1);
const FULL_CANDIDATES = 0b111111111; // 511
```

## Rationale

A 9-bit integer fits in a single JavaScript number. Bitwise operations (`&`, `|`, `^`, `~`) give us O(1) union, intersection, difference, and symmetric difference. Population count gives candidate count. This is faster and more compact than arrays or `Set<number>`.

## Alternatives Considered

### Array of digits (`number[]`)

- **Pros:** Familiar, easy to iterate, no bit manipulation needed
- **Cons:** O(n) set operations, more memory, requires sorting for comparison

### `Set<number>`

- **Pros:** Built-in set operations, clear semantics
- **Cons:** Object overhead per cell (81 cells x Set), slower intersection/difference, not serializable

### Java `BitSet`

- **Pros:** Direct port from SE Java
- **Cons:** No native JS equivalent, would require a polyfill, overkill for 9 bits

## Java Reference

```java
// SE uses BitSet for candidates
BitSet potentials = new BitSet(10);
potentials.set(1, 10); // digits 1-9
```

```typescript
// TSudoku uses 9-bit integer
let candidates = FULL_CANDIDATES; // 0b111111111
candidates &= ~candidateMask(5); // remove digit 5
```

## Consequences

- **Positive:** Fastest possible set operations, minimal memory, trivially serializable
- **Negative:** Requires bit manipulation knowledge, less readable than arrays for newcomers
- **Neutral:** `candidateList()` helper converts to array when iteration is needed

## Compliance

- All candidate operations must use `bitmask.ts` utilities
- Code review: raw bit manipulation outside `bitmask.ts` is flagged
- Unit tests verify bitmask utilities against array-based reference implementation
