# ADR-0005: On-Device vs Server Technique Split

- **Status:** Accepted
- **Date:** 2026-03-07
- **Phase:** 0
- **Deciders:** Nick Hart

## Context

Chain techniques (SE 6.2+) are computationally expensive and account for <5% of puzzles in typical play. Including them in the on-device bundle increases size and risks performance issues on mobile (Hermes). Meanwhile, techniques up to SE 4.4 cover >90% of newspaper-difficulty puzzles.

## Decision

We will split technique execution at SE difficulty 4.4:

- **On-device** (`@tsudoku/core`): SE <= 4.4, runs offline on any platform
- **Server** (Node.js API): SE > 4.4, chain techniques + SE oracle fallback
- **AI hints** (Claude API): Natural language explanations, token-gated

## Rationale

This keeps the core bundle lean and fast for mobile while still supporting the full SE difficulty range via server fallback. The split point (4.4) covers all techniques that can run in constant or low-polynomial time.

## Alternatives Considered

### Everything On-Device

- **Pros:** Fully offline, no server dependency
- **Cons:** Bundle size, Hermes performance for chains, <5% of puzzles need chains

### Everything Server-Side

- **Pros:** Simplest architecture, always up-to-date
- **Cons:** Requires internet, latency for basic hints, no offline play

## Java Reference

```java
// SE runs everything in one JVM process
// No split concept exists
```

```typescript
// TSudoku splits at the producer registration level
const ON_DEVICE_PRODUCERS = DEFAULT_PRODUCERS.filter((p) => p.difficulty <= 4.4);
const SERVER_PRODUCERS = DEFAULT_PRODUCERS;
```

## Consequences

- **Positive:** Fast mobile experience, small bundle, offline play for most puzzles
- **Negative:** Server dependency for hard puzzles, two deployment targets
- **Neutral:** Phase 4 techniques are implemented in the same codebase, just excluded from default mobile producers

## Compliance

- Chain techniques (Phase 4) must NOT be added to `DEFAULT_PRODUCERS`
- `@tsudoku/core` must have zero server-side dependencies
- CI checks that core bundle size stays under threshold
