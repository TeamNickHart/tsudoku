# ADR-0007: Vitest + fast-check for Property-Based Testing

- **Status:** Accepted
- **Date:** 2026-03-07
- **Phase:** 0
- **Deciders:** Nick Hart

## Context

Testing technique detectors requires both example-based tests (specific puzzles with known SE output) and property-based tests (e.g., "applying a NakedSingle hint always produces a valid grid"). We need a test framework that supports both styles and integrates with our Vite-based toolchain.

## Decision

We will use Vitest for all testing and fast-check for property-based tests where applicable.

## Rationale

Vitest is the natural choice for a Vite/tsup project: native ESM, fast watch mode, compatible API (Jest-like), built-in coverage via v8. fast-check enables property-based testing for grid invariants without replacing example-based tests.

## Alternatives Considered

### Jest

- **Pros:** Industry standard, largest ecosystem
- **Cons:** ESM support still experimental, requires transform config, slower than Vitest

### node:test (built-in)

- **Pros:** Zero dependencies, built into Node.js
- **Cons:** Less mature assertion library, no coverage built-in, no watch mode

### Hypothesis-style (custom)

- **Pros:** Full control
- **Cons:** Reinventing the wheel, maintenance burden

## Consequences

- **Positive:** Fast test execution, native ESM, Jest-compatible API (low learning curve)
- **Negative:** fast-check adds a dev dependency
- **Neutral:** Property-based tests supplement but don't replace SE corpus tests

## Compliance

- Every package has a `vitest.config.ts`
- Coverage threshold enforced at 80% in CI
- Property-based tests use `fc.assert()` from fast-check
- SE corpus agreement tests are example-based (specific puzzles)
