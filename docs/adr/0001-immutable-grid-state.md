# ADR-0001: Immutable Grid State

- **Status:** Accepted
- **Date:** 2026-03-07
- **Phase:** 0
- **Deciders:** Nick Hart

## Context

SudokuExplainer mutates its grid in place during solving. This makes undo/redo complex, complicates testing (test isolation requires cloning), and is incompatible with React/React Native's expectation of immutable state for efficient re-rendering.

## Decision

We will make `Grid`, `Cell`, and `Region` objects fully immutable. Every hint application returns a new `Grid` instance. The signature is:

```typescript
function applyHint(grid: Grid, hint: Hint): Grid;
```

## Rationale

Immutability gives us free undo/redo (keep a stack of Grid snapshots), trivial test isolation, and direct compatibility with React's state model. The performance cost is negligible for a 9x9 grid (81 cells).

## Alternatives Considered

### Mutable Grid with Clone-on-Undo

- **Pros:** Slightly faster single operations, closer to SE Java structure
- **Cons:** Requires explicit cloning for undo/redo, error-prone shared state, test isolation requires setup/teardown, incompatible with React state model

### Persistent Data Structure (HAMT)

- **Pros:** Structural sharing minimizes allocation
- **Cons:** Over-engineered for 81 cells, adds dependency, no measurable benefit at this scale

## Java Reference

```java
// SE mutates grid directly
cell.setValue(value);
grid.cancelPotentialValue(cell, value);
```

```typescript
// TSudoku returns new grid
const newGrid = applyHint(grid, hint);
```

## Consequences

- **Positive:** Free undo/redo, trivial testing, React-compatible, no shared mutable state bugs
- **Negative:** More allocations per step (negligible for 81 cells)
- **Neutral:** Requires `recomputeCandidates()` after placement (explicit is better than implicit)

## Compliance

- All `Grid`, `Cell`, `Region` interfaces use `readonly` properties
- ESLint rule: `@typescript-eslint/prefer-readonly` enabled
- Code review: any mutation of grid state is rejected
