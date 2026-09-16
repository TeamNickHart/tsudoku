# Porting Guide: SudokuExplainer Java to TSudoku TypeScript

This document ensures a uniform approach across all technique ports.

## Guiding Principles

1. **Structure _and_ results:** Mirror the SE Java source line by line — same
   structure, same iteration order, same control flow — and match SE's output
   exactly. Undiscussed divergence is a bug, not a style choice. (This is
   CLAUDE.md's Cardinal Rule; earlier revisions of this file said "internal
   implementation may differ freely", which was wrong and contradicted it.)
   If a Java concept doesn't map cleanly to TypeScript, stop and discuss. If you
   spot an improvement over SE's algorithm, note it in `notes/improvements.md`
   rather than changing the code.
2. **Idiomatic TypeScript, within that constraint:** use TS syntax and idioms —
   no Java-isms, no null returns where `| null` works, no mutable shared state —
   but the code should still read as a direct translation of the Java.
3. **One technique, one file:** Each technique lives in a single `.ts` file.
4. **Test first:** Write SE parity tests before implementation.
5. **ADR before divergence:** Non-trivial departures from Java structure need an ADR.

## Step-by-Step Porting Workflow

For every technique:

1. Locate Java source in `diuf/sudoku/solver/rules/TechniqueName.java`
2. Read the SudokuWiki page for visual explanation
3. Write failing tests using SE output as expected values
4. Implement `HintProducer`
5. Register in `packages/core/src/solver/producers.ts` at correct difficulty position
6. Add to `Technique` type union and `TECHNIQUE_DIFFICULTY` map
7. Run `pnpm benchmark:quick` -- verify >= 99% agreement for the technique
   (note: a `--technique` filter does not exist yet; the runner takes `--phases=`)

## Java to TypeScript Translation Patterns

### BitSet to 9-bit bitmask

```java
// Java (SE)
BitSet potentials = new BitSet(10);
potentials.set(digit);
potentials.get(digit);
potentials.cardinality();
```

```typescript
// TypeScript (TSudoku)
let candidates = FULL_CANDIDATES; // 0b111111111
candidates |= candidateMask(digit); // set
hasCandidate(candidates, digit); // get
candidateCount(candidates); // cardinality
```

### Mutable Grid to Immutable applyHint

```java
// Java (SE)
cell.setValue(value);
grid.cancelPotentialValue(cell, value);
```

```typescript
// TypeScript (TSudoku)
const newGrid = applyHint(grid, hint);
```

### HintsAccumulator to HintAccumulator

```java
// Java (SE) — uses exception for short-circuit
public interface HintsAccumulator {
    void add(Hint hint) throws InterruptedException;
}
// SingleHintAccumulator throws InterruptedException on first hint
```

```typescript
// TypeScript (TSudoku) — uses return value
type HintAccumulator = (hint: Hint) => void | 'stop';
// Return 'stop' to short-circuit after first hint
```

### Null Returns to Explicit Null Types

```java
// Java (SE)
public Hint getHint() { return null; }
```

```typescript
// TypeScript (TSudoku)
getHints(grid: Grid, accumulator: HintAccumulator): void;
// No return — hints are pushed to accumulator
```

### Java Inner Classes to Object Literals

```java
// Java (SE)
return new DirectHiddenSetHint(this, cells, values, ...);
```

```typescript
// TypeScript (TSudoku)
accumulator({
  type: 'direct',
  technique: this.technique,
  difficulty: this.difficulty,
  cell: cellIndex,
  digit,
  explanation: `...`,
  involvedCells: [...],
  involvedCandidates: new Map([...]),
});
```

## Candidate Bitmask Utility Reference

All utilities are in `packages/core/src/candidates/bitmask.ts`:

```typescript
candidateMask(digit: number): number        // 1 << (digit - 1)
hasCandidate(candidates: number, d: number): boolean
addCandidate(candidates: number, d: number): number
removeCandidate(candidates: number, d: number): number
candidateList(candidates: number): number[]  // e.g., [1, 3, 7]
candidateCount(candidates: number): number   // popcount
intersect(a: number, b: number): number      // a & b
union(a: number, b: number): number          // a | b
difference(a: number, b: number): number     // a & ~b
FULL_CANDIDATES: number                      // 0b111111111 = 511
```

## Required Test Cases Per Technique

Every technique must have tests for:

1. **Detection:** Finds the pattern when present
2. **Non-detection:** Returns nothing when pattern is absent
3. **Short-circuit:** Stops after first hint when accumulator returns `'stop'`
4. **Explanation:** `hint.explanation` is a non-empty human-readable string
5. **SE corpus:** Agrees with SE on reference puzzles (integration test)

## Test Helper Reference

`packages/core/tests/helpers.ts`:

```typescript
createGrid(puzzleString: string): Grid
getHints(producer: HintProducer, grid: Grid): Hint[]
getFirstHint(producer: HintProducer, grid: Grid): Hint | null

// Fixture puzzles
EASY_PUZZLE, POINTING_PUZZLE, CLAIMING_PUZZLE, SOLVED_PUZZLE
```

That's the whole surface today. `createGridWithState`, `expectHint`,
`expectNoHint` and `loadCorpus` were specified here but never written — add them
if you need them rather than assuming they exist.

## Java Class to TypeScript File Mapping

| SE Java Class                | TSudoku File                                 | Phase |
| ---------------------------- | -------------------------------------------- | ----- |
| `NakedSingle.java`           | `techniques/phase1/NakedSingle.ts`           | 1     |
| `HiddenSingle.java`          | `techniques/phase1/HiddenSingle.ts`          | 1     |
| `Locking.java` (direct)      | `techniques/phase1/DirectPointing.ts`        | 1     |
| `Locking.java` (direct)      | `techniques/phase1/DirectClaiming.ts`        | 1     |
| `HiddenSet.java` (direct)    | `techniques/phase1/DirectHiddenSet.ts`       | 1     |
| `Locking.java`               | `techniques/phase2/Pointing.ts`              | 2     |
| `Locking.java`               | `techniques/phase2/Claiming.ts`              | 2     |
| `NakedSet.java`              | `techniques/phase2/NakedSet.ts`              | 2     |
| `HiddenSet.java`             | `techniques/phase2/HiddenSet.ts`             | 2     |
| `Fisherman.java`             | `techniques/phase2/Fisherman.ts`             | 2     |
| `XYWing.java`                | `techniques/phase2/XYWing.ts`                | 2     |
| `UniqueLoop.java`            | `techniques/phase3/UniqueRectangle.ts`       | 3     |
| `BivalueUniversalGrave.java` | `techniques/phase3/BivalueUniversalGrave.ts` | 3     |
| `AlignedPairExclusion.java`  | `techniques/phase4/AlignedPairExclusion.ts`  | 4     |
| `Chaining.java`              | `techniques/phase4/Chaining.ts`              | 4     |

## What NOT to Do

- Do not mutate Grid/Cell -- always return new instances
- Do not use `any` -- use `unknown` with type guards
- Do not add chain techniques to `DEFAULT_PRODUCERS` (server-side only)
- Do not hardcode difficulty ratings inline -- use `TECHNIQUE_DIFFICULTY` map
- Do not skip the non-detection test
- Do not open a PR without running `pnpm benchmark:quick`
