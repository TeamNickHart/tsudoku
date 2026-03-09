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

## Cardinal Rule: Mirror the SE Reference Implementation

TSudoku is a **line-by-line port** of SudokuExplainer to TypeScript. Every
technique must mirror the corresponding Java class — same structure, same
iteration order, same logic, same control flow. Use TypeScript syntax and
idioms, but the code should read as a direct translation of the Java source.

**Porting process:**

1. Read the SE Java source (`tools/se-reference/SudokuExplainer-source/`)
2. Port it line by line into TypeScript
3. If a Java concept doesn't map cleanly to TypeScript, **stop and discuss**
4. If you spot an opportunity to improve the algorithm, **don't change it** —
   instead add a note to `notes/improvements.md` for later discussion
5. Undiscussed divergences from SE's code are bugs

**File structure should mirror SE's class structure** where practical. A single
SE Java class may map to a single TS file. If SE combines techniques in one
class (e.g., `Locking.java` handles both Pointing and Claiming), the TS port
should do the same unless there's a discussed reason to split.

---

## Current Phase Status

- [x] **Phase 0** — Scaffolding (repo, tooling, CI, docs skeleton) ✅
- [ ] **Phase 1** — Direct techniques (SE 1.0–2.5)
- [ ] **Phase 2** — Candidate techniques (SE 2.6–4.4)
- [ ] **Phase 3** — Uniqueness techniques (SE 4.5–6.0)
- [ ] **Phase 4** — Chain techniques (SE 6.2+, server-side)
- [ ] **Phase 5** — Generator + corpus pipeline
- [ ] **Phase 6** — ML package (ONNX inference)

**No solving techniques are implemented yet.** The monorepo scaffold, CI pipeline,
docs site, and benchmark harness are complete.

### SE Oracle Integration

The benchmark harness will incorporate the actual SudokuExplainer Java CLI
(`serate`) as a ground-truth oracle. This lets us validate TSudoku's technique
detection and difficulty ratings against the original SE on every puzzle,
providing authoritative pass/fail for CI.

```bash
# SE CLI usage (requires Java)
java -cp SudokuExplainer.jar diuf.sudoku.test.serate \
  --input=puzzles.txt --output=rated.txt --format="%g ED=%r/%p/%d"
```

The `tools/` directory will contain wrapper scripts to run SE and compare output.
A `tools/se-reference/` directory holds the SE jar and integration harness.

---

## Documentation Convention: Planned vs Implemented

Roadmaps, plans, and architectural vision are welcome everywhere — just don't
present unimplemented features as if they already work.

- **Tense:** Future tense for future things ("will detect"), present tense for
  what works today ("builds all packages").
- **VitePress pages:** Use `::: warning NOT YET IMPLEMENTED` or
  `::: warning PROJECT STATUS` callout boxes on pages showing APIs or features
  that don't exist yet.
- **Tables:** Add a `Status` column (`Complete`, `Scaffold`, `Planned`, `Not started`).
- **Code examples:** If the API doesn't exist yet, label it:
  "The **planned** usage will look like:" — don't present it as working code.
- **CLAUDE.md:** Design reference sections (planned types, interfaces, architecture)
  are fine — label them as design targets so future sessions know what's real.

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
│   └── showcase/                 ← React Native demo app (Expo) [PLANNED]
├── docs/                         ← VitePress site → tsudoku.dev
│   ├── index.md
│   ├── guide/
│   ├── api/                      ← auto-generated from TypeDoc [PLANNED]
│   └── techniques/               ← one page per technique [PLANNED]
├── benchmarks/                   ← SE parity suite
│   ├── runner.ts
│   └── corpus/                   ← .jsonl files with known SE ratings
├── data/
│   └── puzzles/                  ← seed corpus
├── turbo.json                    ← Turborepo task config
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

| Tool                | Purpose                       | Config file                    |
| ------------------- | ----------------------------- | ------------------------------ |
| pnpm workspaces     | Monorepo package management   | `pnpm-workspace.yaml`          |
| Turborepo           | Build orchestration + caching | `turbo.json`                   |
| TypeScript 5.x      | Strict mode everywhere        | `tsconfig.base.json`           |
| Vitest              | Unit + integration testing    | `vitest.config.ts` per package |
| ESLint              | Linting                       | `.eslintrc.cjs`                |
| Prettier            | Formatting                    | `.prettierrc`                  |
| Husky + lint-staged | Pre-commit hooks              | `.husky/`                      |
| GitHub Actions      | CI/CD                         | `.github/workflows/`           |
| VitePress           | Docs site                     | `docs/.vitepress/config.ts`    |
| Changesets          | Versioning + changelog        | `.changeset/`                  |
| Commander           | CLI framework (planned)       | in `packages/cli`              |

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
  "tasks": {
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

## Design Targets (not yet implemented)

The sections below describe the **planned** architecture for the core engine.
These are design references for Phase 1+ implementation — none of this code
exists yet.

### The Candidate Bitmask (most important convention)

Candidates are stored as a **9-bit integer**. Bit position `d-1` represents digit `d`.

```typescript
// bit 0 (1)   → digit 1 is a candidate
// bit 1 (2)   → digit 2 is a candidate
// bit 8 (256) → digit 9 is a candidate

// Utilities (planned for packages/core/src/candidates/bitmask.ts)
const candidateMask = (digit: number): number => 1 << (digit - 1);
const hasCandidate = (candidates: number, digit: number): boolean =>
  (candidates & candidateMask(digit)) !== 0;
const candidateList = (candidates: number): number[] =>
  Array.from({ length: 9 }, (_, i) => i + 1).filter((d) => hasCandidate(candidates, d));
const candidateCount = (candidates: number): number => candidates.toString(2).split('1').length - 1; // or use Math.popcount when available

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
  readonly index: number; // 0–80
  readonly row: number; // 0–8
  readonly col: number; // 0–8
  readonly box: number; // 0–8
  readonly value: number | null; // null = unsolved
  readonly candidates: number; // bitmask
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
  readonly index: number; // 0–8 within type
  readonly cells: readonly Cell[]; // always 9 cells
  getCandidateCells(digit: number): readonly Cell[];
  getUnsolvedCells(): readonly Cell[];
}
```

### Hint System

```typescript
type Hint = DirectHint | EliminationHint;

// DirectHint: places a digit in a cell
interface DirectHint {
  readonly type: 'direct';
  readonly technique: Technique;
  readonly difficulty: number;
  readonly cell: number;
  readonly digit: number;
  readonly explanation: string;
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

// Immutable hint application
function applyHint(grid: Grid, hint: Hint): Grid;
function recomputeCandidates(grid: Grid): Grid;
```

### HintProducer Interface

```typescript
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

## SE Benchmark Convention

The benchmark compares TSudoku's technique detection and difficulty ratings against
a corpus of puzzles with known SE ratings. It lives in `benchmarks/`.

**The benchmark is a CI gate.** If agreement drops below 95% on any implemented
technique, CI fails. This is the project's credibility guarantee.

### Corpus Target

**~100 puzzles per technique**, grouped by the exact SE technique required (the
hardest technique in the solve path). This serves both benchmark validation and
as pre-generated puzzle content for the mobile app.

When implementing a new technique, build the corpus for it before marking it
done. Don't move on to the next technique without corpus coverage.

**Difficulty levels for the app** use technique-based grouping (Option A):
each unique SE technique/rating is its own level. This supports a teaching-
oriented UX where users progress through techniques.

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

### Test utilities (planned for packages/core/tests/helpers.ts)

```typescript
createGridFromString(puzzle: string): Grid
createGridWithCandidates(puzzle: string, candidates: Record<number, number[]>): Grid
expectHint(hint: Hint | null, expected: Partial<Hint>): void
expectNoHint(grid: Grid, producer: HintProducer): void
loadCorpus(technique: Technique): TrainingSample[]
```

Puzzle input format: 81-character string, digits 1–9 and `.` or `0` for empty cells.
Example: `530070000600195000098000060800060003400803001700020006060000280000419005000080079`

---

## Release Process

Releases use Changesets with a two-phase workflow:

1. **Version PR:** Changesets bot opens a "Version Packages" PR bumping versions + changelogs
2. **Publish:** On merge of that PR, `release.yml` publishes changed packages to npm

See `.github/workflows/release.yml` for the full automation.

**Required secrets:** `NPM_TOKEN`, `GITHUB_TOKEN`

**npm publish requirements:**

- `NPM_CONFIG_PROVENANCE=true` — attestation links package to repo + workflow
- All packages use `"publishConfig": { "access": "public", "provenance": true }`
- Dual exports: `types` → `import` → `require` in every `package.json`

---

## What NOT to Do

- **Do not mutate Grid or Cell objects.** Always return new instances.
- **Do not use `any`.** If you're tempted, use `unknown` with a type guard.
- **Do not add techniques to the wrong phase.** Phase determines on-device vs server.
- **Do not skip tests.** Every technique needs detection + non-detection tests.
- **Do not add chain techniques to `DEFAULT_PRODUCERS`.** They are server-only.
- **Do not hardcode difficulty ratings inline.** Use `TECHNIQUE_DIFFICULTY` map.
- **Do not add dependencies to `@tsudoku/core` without discussion.** Core must stay lean.
- **Do not present planned features as implemented** in docs, README, or this file.
- **Do not diverge from the SE reference implementation.** Port line by line. If a Java concept doesn't map to TS, stop and discuss. If you see an improvement, note it in `notes/improvements.md` — don't change the algorithm. See "Cardinal Rule" section above.

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

## Open Decisions

- React Native app: Expo managed workflow vs bare? (leaning Expo for speed)
- Docs technique pages: auto-generated from technique metadata or hand-authored?
- ML training: PyTorch (Python pipeline) vs TensorFlow.js?
- Chain techniques: port SE's `Chaining.java` directly vs implement from scratch using AIC theory?
- Corpus license: CC0 for public puzzle dataset?
- Unique Rectangle: all 7+ UR types or just types 1–4 for V1?
