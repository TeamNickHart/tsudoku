# CLAUDE.md — TSudoku Project Context

> This file is read by Claude Code at the start of every session.
> It contains all architectural decisions, conventions, and context needed
> to work on TSudoku without re-explanation. Update it as decisions evolve.

---

## What Is This Project?

TSudoku (`@tsudoku/*`) is an open-source TypeScript port of SudokuExplainer —
the gold-standard Java Sudoku technique classifier used by the competitive Sudoku
community for 20 years. The goal is to be the first complete, idiomatic TypeScript
implementation of human-readable Sudoku technique detection, running natively in
Node.js, browsers, and React Native (Hermes). Zero JVM dependency.

- **Domain:** tsudoku.dev
- **GitHub:** github.com/tsudoku/tsudoku
- **npm scope:** `@tsudoku`
- **License:** MIT
- **Tagline:** A TypeScript-first Sudoku engine. Human techniques, machine precision.

---

## Monorepo Structure

```
tsudoku/                          ← pnpm workspace root
├── packages/
│   ├── core/                     ← @tsudoku/core — THE primary library
│   │   ├── src/
│   │   │   ├── models/           ← Grid, Cell, Region, types
│   │   │   ├── candidates/       ← bitmask utils, candidate computation
│   │   │   ├── techniques/
│   │   │   │   ├── phase1/       ← NakedSingle, HiddenSingle, Direct*
│   │   │   │   ├── phase2/       ← Locking, NakedSet, HiddenSet, Fisherman, Wings
│   │   │   │   ├── phase3/       ← UniqueRectangle, BUG
│   │   │   │   └── phase4/       ← Chaining variants (server-side only)
│   │   │   ├── solver/           ← Solver orchestrator, Analyser
│   │   │   └── index.ts          ← public API surface
│   │   ├── tests/
│   │   └── package.json
│   ├── solver/                   ← @tsudoku/solver — full solve path recording
│   ├── generator/                ← @tsudoku/generator — puzzle gen + difficulty rating
│   ├── cli/                      ← @tsudoku/cli — Commander-based CLI tool
│   └── react-native/             ← @tsudoku/react-native — RN components + hooks
├── apps/
│   └── showcase/                 ← React Native demo app (Expo)
├── docs/                         ← VitePress site → tsudoku.dev
│   ├── index.md
│   ├── guide/
│   ├── api/                      ← auto-generated from TypeDoc
│   └── techniques/               ← one page per technique with visual examples
├── benchmarks/                   ← SE parity suite
│   ├── runner.ts
│   └── corpus/                   ← .jsonl files with known SE ratings
├── data/
│   └── puzzles/                  ← seed corpus
├── tools/                        ← internal scripts (corpus gen, SE runner wrapper)
├── turbo.json                    ← Turborepo pipeline config
├── pnpm-workspace.yaml
├── package.json                  ← root (scripts only, no deps)
├── tsconfig.base.json            ← shared TS config
├── .eslintrc.cjs
├── .prettierrc
└── .github/
    └── workflows/
        ├── ci.yml
        └── release.yml
```

---

## Toolchain

| Tool | Purpose | Config file |
|---|---|---|
| pnpm workspaces | Monorepo package management | `pnpm-workspace.yaml` |
| Turborepo | Build orchestration + caching | `turbo.json` |
| TypeScript 5.x | Strict mode everywhere | `tsconfig.base.json` |
| Vitest | Unit + integration testing | `vitest.config.ts` per package |
| ESLint | Linting | `.eslintrc.cjs` |
| Prettier | Formatting | `.prettierrc` |
| Husky + lint-staged | Pre-commit hooks | `.husky/` |
| GitHub Actions | CI/CD | `.github/workflows/` |
| VitePress | Docs site | `docs/.vitepress/config.ts` |
| TypeDoc | API doc generation | `typedoc.json` |
| Changesets | Versioning + changelog | `.changeset/` |
| Commander | CLI framework | in `packages/cli` |

---

## TypeScript Configuration

### tsconfig.base.json (root — all packages extend this)
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitOverride": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

**Rules:**
- No `any`. Ever. Use `unknown` with narrowing.
- No non-null assertions (`!`) without a comment explaining why it's safe.
- All exported functions must have explicit return types.
- All public interfaces must be in `src/types/` or co-located with their implementation.

---

## Turbo Pipeline

```json
// turbo.json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"]
    },
    "lint": {},
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "benchmark": {
      "dependsOn": ["build"],
      "outputs": ["benchmark-results/**"]
    }
  }
}
```

**Key commands:**
```bash
pnpm build              # build all packages in dependency order
pnpm test               # run all tests
pnpm test --filter=core # run tests for one package only
pnpm lint               # lint all packages
pnpm typecheck          # tsc --noEmit all packages
pnpm benchmark          # run SE parity benchmarks
pnpm changeset          # create a new changeset for release
```

---

## Core Data Model

### The Candidate Bitmask (most important convention)

Candidates are stored as a **9-bit integer**. Bit position `d-1` represents digit `d`.

```typescript
// bit 0 (1)   → digit 1 is a candidate
// bit 1 (2)   → digit 2 is a candidate
// bit 8 (256) → digit 9 is a candidate

// Utilities (in packages/core/src/candidates/bitmask.ts)
const candidateMask = (digit: number): number => 1 << (digit - 1);
const hasCandidate = (candidates: number, digit: number): boolean =>
  (candidates & candidateMask(digit)) !== 0;
const candidateList = (candidates: number): number[] =>
  Array.from({ length: 9 }, (_, i) => i + 1).filter(d => hasCandidate(candidates, d));
const candidateCount = (candidates: number): number =>
  candidates.toString(2).split('1').length - 1; // or use Math.popcount when available

// Full candidate set (all 9 digits): 0b111111111 = 511
const FULL_CANDIDATES = 0b111111111;
```

### Grid (immutable)
```typescript
interface Grid {
  readonly cells: readonly Cell[];
  readonly regions: readonly Region[];
  getRow(r: number): Region;
  getCol(c: number): Region;
  getBox(b: number): Region;
  getCell(row: number, col: number): Cell;
  getCellByIndex(index: number): Cell;
  getPeers(cellIndex: number): readonly Cell[];
}

// Cell index convention: index = row * 9 + col
// Box convention: box = Math.floor(row / 3) * 3 + Math.floor(col / 3)
// Regions: rows = regions[0..8], cols = regions[9..17], boxes = regions[18..26]
```

### Cell (immutable)
```typescript
interface Cell {
  readonly index: number;          // 0–80
  readonly row: number;            // 0–8
  readonly col: number;            // 0–8
  readonly box: number;            // 0–8
  readonly value: number | null;   // null = unsolved
  readonly candidates: number;     // bitmask
  readonly isGiven: boolean;
  // Derived (computed lazily or eagerly — implementation detail)
  readonly candidateList: readonly number[];
  readonly candidateCount: number;
}
```

### Region
```typescript
interface Region {
  readonly type: 'row' | 'col' | 'box';
  readonly index: number;           // 0–8 within type
  readonly cells: readonly Cell[];  // always 9 cells
  getCandidateCells(digit: number): readonly Cell[];
  getUnsolvedCells(): readonly Cell[];
}
```

---

## Hint System

### The Two Hint Types (mirrors SE's DirectHint / IndirectHint)

```typescript
type Hint = DirectHint | EliminationHint;

// DirectHint: places a digit in a cell
interface DirectHint {
  readonly type: 'direct';
  readonly technique: Technique;
  readonly difficulty: number;        // SE difficulty rating
  readonly cell: number;              // cell index 0–80
  readonly digit: number;             // digit to place (1–9)
  readonly explanation: string;       // human-readable why
  readonly involvedCells: readonly number[];
  readonly involvedCandidates: ReadonlyMap<number, readonly number[]>;
}

// EliminationHint: removes candidates (does not place a digit)
interface EliminationHint {
  readonly type: 'elimination';
  readonly technique: Technique;
  readonly difficulty: number;
  readonly eliminations: ReadonlyArray<{ cell: number; digit: number }>;
  readonly explanation: string;
  readonly involvedCells: readonly number[];
  readonly involvedCandidates: ReadonlyMap<number, readonly number[]>;
}
```

### Applying Hints (always immutable)
```typescript
// Every hint application returns a NEW grid — never mutate
function applyHint(grid: Grid, hint: Hint): Grid;

// Recompute all candidates from scratch after a digit placement
// (simpler and safer than incremental updates)
function recomputeCandidates(grid: Grid): Grid;
```

---

## HintProducer Interface (the heart of the architecture)

Every technique is a `HintProducer`. The Solver runs them in difficulty order.

```typescript
// Returning 'stop' from the accumulator short-circuits the producer
// (equivalent to SE's SingleHintAccumulator throwing InterruptedException)
type HintAccumulator = (hint: Hint) => void | 'stop';

interface HintProducer {
  readonly technique: Technique;
  readonly difficulty: number;
  getHints(grid: Grid, accumulator: HintAccumulator): void;
}
```

### Adding a New Technique
1. Create `packages/core/src/techniques/phaseN/MyTechnique.ts`
2. Implement `HintProducer`
3. Create `packages/core/tests/techniques/phaseN/MyTechnique.test.ts`
4. Register in `packages/core/src/solver/producers.ts` in difficulty order
5. Add to `Technique` union type in `packages/core/src/types/Technique.ts`
6. Add SE difficulty rating to `TECHNIQUE_DIFFICULTY` map
7. Run benchmark to verify SE agreement

---

## Technique Registry

```typescript
// packages/core/src/solver/producers.ts
// Ordered by difficulty — Solver tries them in this order

export const DEFAULT_PRODUCERS: HintProducer[] = [
  // Phase 1 — Direct (no candidates needed)
  new NakedSingle(),              // 1.0 / 2.3
  new HiddenSingle('box'),        // 1.2
  new HiddenSingle('line'),       // 1.5
  new DirectPointing(),           // 1.7
  new DirectClaiming(),           // 1.9
  new DirectHiddenSet(2),         // 2.0
  new DirectHiddenSet(3),         // 2.5

  // Phase 2 — Candidate-based
  new Locking('pointing'),        // 2.6
  new Locking('claiming'),        // 2.8
  new NakedSet(2),                // 3.0
  new Fisherman(2),               // 3.2 — X-Wing
  new HiddenSet(2),               // 3.4
  new NakedSet(3),                // 3.6
  new Fisherman(3),               // 3.8 — Swordfish
  new HiddenSet(3),               // 4.0
  new XYWing(),                   // 4.2
  new XYWing({ xyz: true }),      // 4.4

  // Phase 3 — Uniqueness
  new UniqueRectangle(),          // 4.5–5.0
  new NakedSet(4),                // 5.0
  new Fisherman(4),               // 5.2 — Jellyfish
  new HiddenSet(4),               // 5.4
  new BivalueUniversalGrave(),    // 5.6–6.0

  // Phase 4 — Chains (server-side only, not in default mobile producers)
  // new AlignedPairExclusion(),  // 6.2
  // new Chaining(...),           // 6.5+
];
```

---

## Technique Difficulty Reference

```
1.0   NakedSingle (last value in completed unit)
1.2   HiddenSingle (box)
1.5   HiddenSingle (row/col)
1.7   DirectPointing
1.9   DirectClaiming
2.0   DirectHiddenPair
2.3   NakedSingle (general)
2.5   DirectHiddenTriplet
2.6   Pointing (Locked Candidates type 1)
2.8   Claiming (Locked Candidates type 2)
3.0   NakedPair
3.2   XWing
3.4   HiddenPair
3.6   NakedTriplet
3.8   Swordfish
4.0   HiddenTriplet
4.2   XYWing
4.4   XYZWing
4.5–5.0  UniqueRectangle (types 1–4)
5.0   NakedQuad
5.2   Jellyfish
5.4   HiddenQuad
5.6–6.0  BivalueUniversalGrave
6.2   AlignedPairExclusion
6.5–7.5  BidirectionalXCycle / YCycle
7.0–8.0  ForcingChain
7.5–8.5  NishioChain
8.0–9.0  CellForcingChain / RegionForcingChain
8.5–9.5  DynamicForcingChain
9.0–10.0 DynamicForcingChainPlus
>9.5     NestedForcingChain
```

Puzzle difficulty = **highest technique difficulty used in the solve path**.
SE rating format: `ED=hardest/hardest_without_BF/easiest`

---

## Solver Orchestrator

```typescript
class Solver {
  constructor(private producers: HintProducer[] = DEFAULT_PRODUCERS) {}

  // Returns the first (easiest) applicable hint, or null if none found
  getNextHint(grid: Grid): Hint | null {
    for (const producer of this.producers) {
      let found: Hint | null = null;
      producer.getHints(grid, hint => {
        found = hint;
        return 'stop'; // short-circuit
      });
      if (found !== null) return found;
    }
    return null;
  }

  // Returns ALL hints from ALL producers (for analysis/UI)
  getAllHints(grid: Grid): Hint[] {
    const hints: Hint[] = [];
    for (const producer of this.producers) {
      producer.getHints(grid, hint => { hints.push(hint); });
    }
    return hints;
  }

  // Full puzzle analysis: solve completely, return difficulty rating + step list
  analyzeGrid(grid: Grid): AnalysisResult {
    // ... iteratively apply hints, recording each step
    // difficulty = max hint.difficulty across all steps
  }
}
```

---

## SE Benchmark Convention

The benchmark compares TSudoku's technique detection and difficulty ratings against
a corpus of puzzles with known SE ratings. It lives in `benchmarks/`.

```bash
pnpm benchmark
# Output:
# NakedSingle:    100.0% agreement (8,432 puzzles)
# HiddenSingle:   100.0% agreement (7,103 puzzles)
# NakedPair:       99.8% agreement (4,221 puzzles)
# XWing:           99.1% agreement (1,847 puzzles)
# ─────────────────────────────────────────────────
# Overall rating:   97.3% correlation  r=0.971
# CI status:        PASS (threshold: 95%)
```

**The benchmark is a CI gate.** If agreement drops below 95% on any implemented
technique, CI fails. This is the project's credibility guarantee.

---

## CLI Commands

```bash
# Solve a puzzle completely
tsudoku solve <puzzle>

# Get the next hint
tsudoku hint <puzzle> [--type name|explanation|step|solution]

# Validate a puzzle (unique solution, minimum 17 clues)
tsudoku validate <puzzle>

# Rate a puzzle (SE-compatible)
tsudoku rate <puzzle>
# → ED=3.8/2.6/1.2

# Generate puzzles
tsudoku generate [--difficulty <min>-<max>] [--technique <name>] [--count <n>]

# Run full analysis with technique breakdown
tsudoku analyze <puzzle> [--format json|text]

# Benchmark SE parity
tsudoku benchmark [--corpus <path>] [--technique <name>]

# Cost modeling (for AI hint token economy)
tsudoku cost-model [--monthly-users <n>] [--hints-per-user <n>]
```

Puzzle input format: 81-character string, digits 1–9 and `.` or `0` for empty cells.
Example: `530070000600195000098000060800060003400803001700020006060000280000419005000080079`

---

## Testing Conventions

### Test file naming
```
packages/core/src/techniques/phase1/NakedSingle.ts
packages/core/tests/techniques/phase1/NakedSingle.test.ts
```

### Required tests for every technique
```typescript
describe('NakedSingle', () => {
  it('detects naked single when one candidate remains', () => { ... });
  it('does not fire when multiple candidates remain', () => { ... });
  it('produces correct DirectHint with cell and digit', () => { ... });
  it('produces correct explanation string', () => { ... });
  it('short-circuits after first hint with stop signal', () => { ... });
  it('agrees with SE on corpus puzzles', () => { ... }); // integration
});
```

### Test utilities to build
```typescript
// packages/core/tests/helpers.ts
createGridFromString(puzzle: string): Grid
createGridWithCandidates(puzzle: string, candidates: Record<number, number[]>): Grid
expectHint(hint: Hint | null, expected: Partial<Hint>): void
expectNoHint(grid: Grid, producer: HintProducer): void
loadCorpus(technique: Technique): TrainingSample[]
```

---

## AI Hint System (App Layer — not in core)

### Architecture
```
On-device (@tsudoku/core):  L1–L3 techniques (SE ≤ 4.4), instant, offline
Server API (Node):           L4+ techniques + SE oracle for chains
Claude API:                  Natural language hints, token-gated
```

### Token Economy
```
Free:          Naked singles hints (rule engine, no cost)
1 token:       Technique name only
2 tokens:      Natural language explanation
1 token/step:  Step-by-step walkthrough (full path generated once, revealed incrementally)
5 tokens:      Full solution
```

### Hint Validation Rule
ALL Claude API responses must be validated against board state before:
1. Displaying to user
2. Debiting tokens
Validation failure → fall back to rule engine hint, no charge.

### Model Selection
```
Technique name:   claude-haiku  (fast, cheap)
Explanation:      claude-sonnet
Walkthrough:      claude-sonnet
```

### Caching
Cache key: `sha256(puzzleId + candidateBitmaskHash)`.
Same board state → same deterministic hint → cache hit serves multiple users.

---

## What NOT to Do

- **Do not mutate Grid or Cell objects.** Always return new instances.
- **Do not use `any`.** If you're tempted, use `unknown` with a type guard.
- **Do not add techniques to the wrong phase.** Phase determines on-device vs server.
- **Do not skip tests.** Every technique needs detection + non-detection tests.
- **Do not add chain techniques to `DEFAULT_PRODUCERS`.** They are server-only.
- **Do not hardcode difficulty ratings inline.** Use `TECHNIQUE_DIFFICULTY` map.
- **Do not add dependencies to `@tsudoku/core` without discussion.** Core must stay lean.

---

## Key Reference Files

When implementing a technique, consult in this order:
1. SE Java source: https://github.com/1to9only/SudokuExplainer (see `diuf/sudoku/solver/rules/`)
2. SudokuWiki technique pages: https://www.sudokuwiki.org (excellent visual explanations)
3. SE technique wiki: https://github.com/SudokuMonster/SukakuExplainer/wiki
4. Forum ratings reference: http://forum.enjoysudoku.com/how-is-the-difficulty-of-a-sudoku-puzzle-determined-t32249.html

### SE Java → TypeScript Class Mapping
```
NakedSingle.java          → techniques/phase1/NakedSingle.ts
HiddenSingle.java         → techniques/phase1/HiddenSingle.ts
Locking.java              → techniques/phase1/DirectPointing.ts + DirectClaiming.ts
                            techniques/phase2/Pointing.ts + Claiming.ts
NakedSet.java             → techniques/phase2/NakedSet.ts (parameterized by size 2/3/4)
HiddenSet.java            → techniques/phase2/HiddenSet.ts (parameterized by size 2/3/4)
Fisherman.java            → techniques/phase2/Fisherman.ts (parameterized by size 2/3/4)
XYWing.java               → techniques/phase2/XYWing.ts
AlignedPairExclusion.java → techniques/phase4/AlignedPairExclusion.ts
Chaining.java             → techniques/phase4/Chaining.ts (the big one)
BivalueUniversalGrave.java→ techniques/phase3/BivalueUniversalGrave.ts
UniqueLoop.java           → techniques/phase3/UniqueRectangle.ts + UniqueLoop.ts
```

---

## Current Phase Status

Update this section as phases complete:

- [ ] **Phase 0** — Scaffolding (repo, tooling, CI, docs skeleton)
- [ ] **Phase 1** — Direct techniques (SE 1.0–2.5)
- [ ] **Phase 2** — Candidate techniques (SE 2.6–4.4)
- [ ] **Phase 3** — Uniqueness techniques (SE 4.5–6.0)
- [ ] **Phase 4** — Chain techniques (SE 6.2+, server-side)
- [ ] **Phase 5** — Generator + corpus pipeline
- [ ] **Phase 6** — ML package (ONNX inference)

---

## Open Decisions

- React Native app: Expo managed workflow vs bare? (leaning Expo for speed)
- Docs technique pages: auto-generated from technique metadata or hand-authored?
- ML training: PyTorch (Python pipeline) vs TensorFlow.js?
- Chain techniques: port SE's `Chaining.java` directly vs implement from scratch using AIC theory?
- Corpus license: CC0 for public puzzle dataset?
- Unique Rectangle: all 7+ UR types or just types 1–4 for V1?
