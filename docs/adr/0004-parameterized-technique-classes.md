# ADR-0004: Parameterized Technique Classes

- **Status:** Accepted
- **Date:** 2026-03-07
- **Phase:** 0
- **Deciders:** Nick Hart

## Context

Several SE techniques are the same algorithm parameterized by size: NakedSet handles pairs (2), triples (3), and quads (4). Fisherman handles X-Wing (2), Swordfish (3), and Jellyfish (4). Duplicating the implementation for each size violates DRY and increases maintenance burden.

## Decision

We will use parameterized classes where the size is a constructor argument.

```typescript
new NakedSet(2); // Naked Pair
new NakedSet(3); // Naked Triple
new NakedSet(4); // Naked Quad
new Fisherman(2); // X-Wing
new Fisherman(3); // Swordfish
new Fisherman(4); // Jellyfish
```

## Rationale

This matches SE's approach and eliminates code duplication. The difficulty rating is derived from the size parameter. One implementation, one test suite (parameterized), multiple registrations in the producer list.

## Alternatives Considered

### Separate Class Per Size

- **Pros:** Each class is self-contained, simpler individual files
- **Cons:** Massive code duplication, bugs must be fixed in N places, inconsistency risk

### Strategy Pattern with External Size

- **Pros:** Maximum flexibility
- **Cons:** Over-abstracted for this use case, harder to read

## Java Reference

```java
// SE parameterizes by degree
new NakedSet(2, false) // pair, indirect
new NakedSet(3, false) // triple, indirect
```

```typescript
// TSudoku uses same pattern
new NakedSet(2); // pair
new NakedSet(3); // triple
```

## Consequences

- **Positive:** DRY, one fix applies to all sizes, easy to add new sizes
- **Negative:** Slightly more complex single implementation
- **Neutral:** Difficulty ratings derived from size via `TECHNIQUE_DIFFICULTY` map

## Compliance

- Code review: separate classes for different sizes of the same algorithm are rejected
- Test suites must cover all supported sizes
