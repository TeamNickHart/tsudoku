# ADR-0003: Producer/Accumulator Pattern

- **Status:** Accepted
- **Date:** 2026-03-07
- **Phase:** 0
- **Deciders:** Nick Hart

## Context

The solver needs to iterate through techniques in difficulty order, finding applicable hints. SE uses a `HintsAccumulator` interface that collects hints, with `InterruptedException` thrown to short-circuit after the first hit.

## Decision

We will use a callback-based accumulator pattern where each technique is a `HintProducer`. The accumulator returns `'stop'` to short-circuit.

```typescript
type HintAccumulator = (hint: Hint) => void | 'stop';

interface HintProducer {
  readonly technique: Technique;
  readonly difficulty: number;
  getHints(grid: Grid, accumulator: HintAccumulator): void;
}
```

## Rationale

This mirrors SE's architecture closely enough for easy porting while being idiomatic TypeScript. Using a return value instead of exception-based flow control is cleaner and more performant.

## Alternatives Considered

### Generator/Iterator Pattern

- **Pros:** `yield` is idiomatic JS, lazy evaluation built-in
- **Cons:** Generator overhead per technique call, harder to short-circuit from outside, less direct mapping to SE architecture

### Return Array of Hints

- **Pros:** Simplest interface, easy to test
- **Cons:** Forces computation of ALL hints even when only first is needed, wasteful for solver's `getNextHint()`

## Java Reference

```java
// SE uses InterruptedException for short-circuit
public interface HintsAccumulator {
    void add(Hint hint) throws InterruptedException;
}
```

```typescript
// TSudoku uses return value
type HintAccumulator = (hint: Hint) => void | 'stop';
```

## Consequences

- **Positive:** Direct SE mapping, efficient short-circuit, simple to implement and test
- **Negative:** Callback pattern slightly less intuitive than return-array for simple cases
- **Neutral:** Both `getNextHint()` and `getAllHints()` are trivially built on this pattern

## Compliance

- Every technique file must implement `HintProducer`
- Tests must verify short-circuit behavior (accumulator returns `'stop'`)
- Code review: techniques that ignore the accumulator return value are rejected
