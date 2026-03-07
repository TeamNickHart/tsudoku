# TSudoku — Project Plan

> Living document. Feed to Claude Code at the start of each session.
> **Claude Code generates all scaffold files** — this document is requirements,
> not pre-built artifacts. Update it as decisions evolve.

---

## Project Identity

- **Name:** TSudoku
- **Tagline:** A TypeScript-first Sudoku engine. Human techniques, machine precision.
- **Website:** tsudoku.dev
- **GitHub:** github.com/tsudoku/tsudoku
- **npm scope:** `@tsudoku`
- **License:** MIT
- **Inspiration:** SudokuExplainer (Nicolas Juillerat, Java, ~2006)

---

## Problem Statement

The JS/TS ecosystem has no technique-aware Sudoku engine. Every existing npm
package uses backtracking only — correct but unexplainable. SudokuExplainer is
the community standard but JVM-only. TSudoku ports its technique hierarchy to
TypeScript: Node.js, browsers, React Native. No JVM required.

---

## Locked Architecture Decisions

### 1. Immutable Grid State

Every hint application returns a new `Grid`. Never mutate. Enables free
undo/redo, trivial testing, React Native compatibility.

```typescript
function applyHint(grid: Grid, hint: Hint): Grid;
```

### 2. Candidate Bitmask

Candidates as a 9-bit integer per cell. Bit `d-1` = digit `d` is a candidate.
Faster than BitSet, simpler than arrays, bitwise ops for intersection/union/count.

### 3. Producer/Accumulator Pattern

Every technique is a `HintProducer`. Solver runs them in difficulty order.
Accumulator returns `'stop'` to short-circuit after first hit.

```typescript
type HintAccumulator = (hint: Hint) => void | 'stop';
interface HintProducer {
  readonly technique: Technique;
  readonly difficulty: number;
  getHints(grid: Grid, acc: HintAccumulator): void;
}
```

### 4. DirectHint vs EliminationHint

- `DirectHint` — places a digit
- `EliminationHint` — removes candidates

### 5. Parameterized Techniques

`NakedSet(size)` handles pairs/triples/quads. `Fisherman(size)` handles
X-Wing/Swordfish/Jellyfish. Never create separate classes per size.

### 6. On-Device vs Server Split

```
SE ≤ 4.4  → @tsudoku/core, on-device, Hermes, offline
SE > 4.4  → server API (Node + SE CLI oracle)
AI hints  → Claude API, token-gated
```

### 7. pnpm + Turborepo + tsup

- pnpm workspaces for monorepo
- Turborepo with remote cache (TURBO_TOKEN) for build orchestration
- tsup (esbuild) for ESM + CJS dual output from every package

---

## Repository Structure

```
tsudoku/
├── packages/
│   ├── core/              # @tsudoku/core — primary library
│   │   ├── src/
│   │   │   ├── models/        # Grid, Cell, Region
│   │   │   ├── candidates/    # bitmask utilities
│   │   │   ├── techniques/
│   │   │   │   ├── phase1/    # NakedSingle, HiddenSingle, Direct*
│   │   │   │   ├── phase2/    # Locking, NakedSet, HiddenSet, Fisherman, Wings
│   │   │   │   ├── phase3/    # UniqueRectangle, BUG
│   │   │   │   └── phase4/    # Chaining (server-side only)
│   │   │   ├── solver/        # orchestrator + Analyser
│   │   │   └── index.ts
│   │   └── tests/
│   ├── solver/            # @tsudoku/solver — full solve path recording
│   ├── generator/         # @tsudoku/generator — puzzle gen + difficulty rating
│   ├── cli/               # @tsudoku/cli — Commander CLI
│   └── react-native/      # @tsudoku/react-native — RN components + hooks
├── apps/
│   └── showcase/          # Expo demo app
├── docs/                  # VitePress → tsudoku.dev
│   ├── guide/
│   ├── api/               # TypeDoc auto-generated
│   ├── techniques/        # one page per technique
│   └── adr/               # Architecture Decision Records
│       ├── README.md      # ADR index
│       ├── _template.md
│       └── 0001-*.md …
├── benchmarks/
│   ├── runner.ts
│   └── corpus/            # .jsonl puzzles with known SE ratings
├── data/puzzles/
├── tools/                 # SE runner wrapper, corpus scripts
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── release.yml
├── turbo.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── package.json           # root scripts only
├── .eslintrc.cjs
├── .prettierrc
├── .changeset/config.json
├── PORTING.md             # Java→TS porting guide
└── CONTRIBUTING.md
```

---

## Toolchain

| Tool                | Purpose                                               |
| ------------------- | ----------------------------------------------------- |
| pnpm workspaces     | Package management                                    |
| Turborepo           | Build orchestration + remote caching                  |
| tsup                | ESM + CJS dual output (esbuild-based)                 |
| TypeScript 5.x      | Strict everywhere                                     |
| Vitest + fast-check | Unit, integration, property-based tests               |
| ESLint              | typescript-eslint/recommended-type-checked            |
| Prettier            | Formatting                                            |
| Husky + lint-staged | Pre-commit: lint + format + typecheck on staged files |
| commitlint          | Conventional commits enforced                         |
| GitHub Actions      | CI/CD                                                 |
| VitePress           | Docs site                                             |
| TypeDoc             | API reference generation                              |
| Changesets          | Versioning + changelog + npm publish automation       |
| Commander           | CLI framework                                         |
| nyc                 | Merge sharded coverage reports                        |
| Codecov             | Coverage tracking + PR comments                       |

### tsup config (identical across all packages)

```typescript
import { defineConfig } from 'tsup';
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
});
```

### TypeScript (tsconfig.base.json — all packages extend this)

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

### Turborepo (turbo.json)

```json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "typecheck": { "dependsOn": ["^build"] },
    "lint": {},
    "test": { "dependsOn": ["^build"], "outputs": ["coverage/**"] },
    "benchmark": { "dependsOn": ["build"], "outputs": ["benchmark-results/**"] },
    "docs:build": { "dependsOn": ["^build"] }
  }
}
```

### Commit convention

Format: `type(scope): description`
Types: `feat` `fix` `test` `docs` `refactor` `chore` `bench` `adr`
Scopes: `core` `cli` `solver` `generator` `react-native` `ml` `docs` `ci`

---

## CI/CD Requirements

### ci.yml — Quality Gates (PR + push to main)

**Principles:**

- All independent gates run in parallel — no unnecessary serialization
- pnpm store and node_modules cached by lockfile hash and shared across all jobs
- Turborepo remote cache (`TURBO_TOKEN`) skips builds for unchanged packages
- Build artifacts uploaded once, downloaded by all downstream jobs
- Tests sharded across 3 parallel runners; coverage merged before asserting thresholds
- SE benchmark only runs when `packages/` files change (skip on docs-only PRs)
- `concurrency` group cancels in-progress run on new push to same branch
- Single `ci-success` aggregator job — all branch protection rules point here

**Job dependency graph:**

```
setup ──┬──► build ──┬──► typecheck ──┐
        │            ├──► lint        ├──► ci-success
        │            ├──► test ──► coverage
        └──► format  └──► benchmark  ┘
```

**Jobs:**

| Job                    | Needs     | What it does                                                       |
| ---------------------- | --------- | ------------------------------------------------------------------ |
| `setup`                | —         | pnpm install, prime pnpm + node_modules cache                      |
| `build`                | setup     | `turbo build`, upload `dist/` artifacts, prime turbo cache         |
| `typecheck`            | build     | `turbo typecheck`                                                  |
| `lint`                 | build     | `turbo lint`                                                       |
| `format`               | setup     | `prettier --check` (no build needed — fastest gate)                |
| `test (1/3, 2/3, 3/3)` | build     | `vitest run --shard=N/3 --coverage`, upload coverage shard         |
| `coverage`             | test      | merge shards with nyc, assert 80% thresholds, upload to Codecov    |
| `benchmark`            | build     | SE parity check, fail if any implemented technique < 95% agreement |
| `ci-success`           | all above | exits 1 if any needed job failed; always runs                      |

**Cache keys:**

| Cache            | Key                                       | Restore key              |
| ---------------- | ----------------------------------------- | ------------------------ |
| pnpm store       | `pnpm-store-{os}-{lockfile-hash}`         | `pnpm-store-{os}-`       |
| node_modules     | `node-modules-{os}-{lockfile-hash}`       | —                        |
| `.turbo`         | `turbo-{os}-{sha}`                        | `turbo-{os}-`            |
| benchmark corpus | `benchmark-corpus-{corpus-hash}`          | —                        |
| build artifacts  | `actions/upload-artifact` 1-day retention | `download-artifact`      |
| coverage shards  | `actions/upload-artifact` per shard       | merged in `coverage` job |

### release.yml — npm Publishing (push to main only)

**Changesets flow:**

1. Developer runs `pnpm changeset` → creates `.changeset/*.md` describing the change
2. On merge to main: Changesets bot opens "Version Packages" PR bumping versions + changelogs
3. On merge of that PR: `release.yml` publishes all changed packages to npm

**Jobs:**

| Job           | What it does                                                      |
| ------------- | ----------------------------------------------------------------- |
| `release`     | `changesets/action`: opens version PR or publishes to npm         |
| `deploy-docs` | Builds VitePress + TypeDoc, deploys to GitHub Pages (always runs) |

**npm publish requirements:**

- `NPM_CONFIG_PROVENANCE=true` — attestation links package to this repo + workflow run
- Scope `@tsudoku` must exist on npmjs.org with automation token
- All packages use `"publishConfig": { "access": "public", "provenance": true }`
- Dual exports in every `package.json`:
  ```json
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    }
  }
  ```
- `"files": ["dist", "README.md", "CHANGELOG.md"]`

**Changesets config:**

```json
{
  "changelog": "@changesets/changelog-github",
  "commit": false,
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": ["showcase"]
}
```

**On publish failure:** auto-open GitHub Issue labeled `release` + `bug`

**Required secrets:** `NPM_TOKEN`, `TURBO_TOKEN`, `CODECOV_TOKEN`
**Required vars:** `TURBO_TEAM`

---

## Architecture Decision Records (ADR) System

### Purpose

TSudoku is a multi-phase port spanning months and many contributors. ADRs capture
_what_ was decided, _why_, what alternatives were considered, and what consequences
follow. Without them, contributors across phases will make inconsistent choices and
lose the reasoning behind patterns that look arbitrary.

### Location

`docs/adr/` — versioned alongside code, reviewed via PR like code.

### Claude Code must generate these files

**`docs/adr/README.md`** — ADR index with status table

**`docs/adr/_template.md`** — template with these required sections:

- Status, Date, Phase, Deciders
- **Context** — what forces motivated this?
- **Decision** — "We will..." (clear, direct)
- **Rationale** — why this over alternatives?
- **Alternatives Considered** — minimum 2, each with pros/cons
- **Java Reference** — SE Java snippet + TypeScript equivalent or departure
- **Consequences** — positive / negative / neutral
- **Compliance** — how is this enforced? ESLint rule? CI check? Code review item?

**Initial ADRs (Phase 0):**

| #    | Title                                          |
| ---- | ---------------------------------------------- |
| 0001 | Immutable Grid State                           |
| 0002 | Candidate Bitmask Representation               |
| 0003 | Producer/Accumulator Pattern                   |
| 0004 | Parameterized Technique Classes                |
| 0005 | On-Device vs Server Technique Split            |
| 0006 | tsup for ESM+CJS Dual Output                   |
| 0007 | Vitest + fast-check for Property-Based Testing |

### ADR rules

- Never delete or rewrite an accepted ADR — supersede it with a new numbered ADR
- The `adr` commit type is reserved for ADR additions/amendments
- ADRs are merged via PR with at least one review

---

## Porting Guide (PORTING.md)

Claude Code must generate `PORTING.md` at repo root. This is the primary
consistency document ensuring a uniform approach across all technique ports.

### Required sections

**1. Guiding Principles**

- Results over structure: match SE output exactly; internal impl may differ freely
- Idiomatic TypeScript: no Java-isms (no null returns, no mutable shared state)
- One technique, one file
- Test first: write SE parity tests before implementation
- ADR before divergence: non-trivial departures from Java structure need an ADR

**2. Step-by-step porting workflow** for every technique:

1. Locate Java source (`diuf/sudoku/solver/rules/TechniqueName.java`)
2. Read SudokuWiki page (visual explanation)
3. Write failing tests using SE output as expected values
4. Implement `HintProducer`
5. Register in `producers.ts` at correct difficulty position
6. Add to `Technique` type union and `TECHNIQUE_DIFFICULTY` map
7. Run `pnpm benchmark --technique MyTechnique` — verify ≥ 99% agreement

**3. Java → TypeScript translation patterns** with before/after code for:

- `BitSet` → 9-bit integer bitmask
- Mutable `Grid` modification → `applyHint()` returning new `Grid`
- `HintsAccumulator` interface → `HintAccumulator` callback with `'stop'`
- `InterruptedException` short-circuit → `return 'stop'` from accumulator
- Java `for (Cell c : cells)` → `for (const c of cells)`
- Null returns → `| null` return types
- Java inner classes for hints → plain TypeScript object literals

**4. Candidate bitmask utility reference** — full API of `bitmask.ts` with examples

**5. Required test cases per technique:**

- Detection: finds pattern when present
- Non-detection: returns nothing when absent
- Short-circuit: stops after first hint when accumulator returns `'stop'`
- Explanation: `hint.explanation` is a non-empty human-readable string
- SE corpus: agrees with SE on reference puzzles

**6. Test helper reference** (`packages/core/tests/helpers.ts`):

- `createGrid(puzzleString)` — 81-char string to Grid
- `createGridWithState(puzzle, candidateOverrides)` — precise test setup
- `getHints(producer, grid)` — collect all hints into array
- `loadCorpus(technique)` — load SE reference samples

**7. Java class → TypeScript file mapping** (full table)

**8. What NOT to do:**

- Do not mutate Grid/Cell — always return new instances
- Do not use `any`
- Do not add chain techniques to `DEFAULT_PRODUCERS` (server-side only)
- Do not hardcode difficulty ratings inline — use `TECHNIQUE_DIFFICULTY` map
- Do not skip the non-detection test
- Do not open a PR without running `pnpm benchmark --technique <n>`

---

## SE Technique Table

Puzzle difficulty = highest-rated technique required to solve it.
SE rating format: `ED=hardest/hardest_without_BF/easiest`

### Phase 1 — Direct (SE 1.0–2.5) — no candidates needed

| Rating | Technique                | SE Java Class                    |
| ------ | ------------------------ | -------------------------------- |
| 1.0    | Last Value               | `NakedSingle`                    |
| 1.2    | Hidden Single in box     | `HiddenSingle`                   |
| 1.5    | Hidden Single in row/col | `HiddenSingle`                   |
| 1.7    | Direct Pointing          | `Locking`                        |
| 1.9    | Direct Claiming          | `Locking`                        |
| 2.0    | Direct Hidden Pair       | `HiddenSet(size=2, direct=true)` |
| 2.3    | Naked Single             | `NakedSingle`                    |
| 2.5    | Direct Hidden Triplet    | `HiddenSet(size=3, direct=true)` |

### Phase 2 — Candidate-based (SE 2.6–4.4)

| Rating | Technique      | SE Java Class       |
| ------ | -------------- | ------------------- |
| 2.6    | Pointing       | `Locking`           |
| 2.8    | Claiming       | `Locking`           |
| 3.0    | Naked Pair     | `NakedSet(size=2)`  |
| 3.2    | X-Wing         | `Fisherman(size=2)` |
| 3.4    | Hidden Pair    | `HiddenSet(size=2)` |
| 3.6    | Naked Triplet  | `NakedSet(size=3)`  |
| 3.8    | Swordfish      | `Fisherman(size=3)` |
| 4.0    | Hidden Triplet | `HiddenSet(size=3)` |
| 4.2    | XY-Wing        | `XYWing`            |
| 4.4    | XYZ-Wing       | `XYWing(xyz=true)`  |

### Phase 3 — Uniqueness (SE 4.5–6.0)

| Rating  | Technique                  | SE Java Class           |
| ------- | -------------------------- | ----------------------- |
| 4.5–5.0 | Unique Rectangle types 1–4 | `UniqueLoop`            |
| 5.0     | Naked Quad                 | `NakedSet(size=4)`      |
| 5.2     | Jellyfish                  | `Fisherman(size=4)`     |
| 5.4     | Hidden Quad                | `HiddenSet(size=4)`     |
| 5.6–6.0 | Bivalue Universal Grave    | `BivalueUniversalGrave` |

### Phase 4 — Chains (SE 6.2+, server-side only)

| Rating   | Technique                  | SE Java Class          |
| -------- | -------------------------- | ---------------------- |
| 6.2      | Aligned Pair Exclusion     | `AlignedPairExclusion` |
| 6.5–7.5  | Bidirectional X/Y-Cycles   | `Chaining`             |
| 6.6–7.6  | Forcing X-Chains           | `Chaining`             |
| 7.0–8.0  | Forcing Chains             | `Chaining`             |
| 7.5–8.5  | Nishio                     | `Chaining`             |
| 8.0–9.0  | Cell/Region Forcing Chains | `Chaining`             |
| 8.5–9.5  | Dynamic Forcing Chains     | `Chaining`             |
| 9.0–10.0 | Dynamic Forcing Chains (+) | `Chaining`             |
| >9.5     | Nested Forcing Chains      | `Chaining`             |

---

## Core Type Definitions

```typescript
interface Grid {
  readonly cells: readonly Cell[];
  readonly regions: readonly Region[];
  getRow(r: number): Region;
  getCol(c: number): Region;
  getBox(b: number): Region;
  getCell(row: number, col: number): Cell;
  getPeers(cellIndex: number): readonly Cell[];
}

interface Cell {
  readonly index: number; // 0–80, row-major
  readonly row: number; // 0–8
  readonly col: number; // 0–8
  readonly box: number; // 0–8
  readonly value: number | null;
  readonly candidates: number; // 9-bit bitmask
  readonly isGiven: boolean;
  readonly candidateList: readonly number[];
  readonly candidateCount: number;
}

type Hint = DirectHint | EliminationHint;

interface DirectHint {
  readonly type: 'direct';
  readonly technique: Technique;
  readonly difficulty: number;
  readonly cell: number;
  readonly digit: number;
  readonly explanation: string;
  readonly involvedCells: readonly number[];
}

interface EliminationHint {
  readonly type: 'elimination';
  readonly technique: Technique;
  readonly difficulty: number;
  readonly eliminations: ReadonlyArray<{ cell: number; digit: number }>;
  readonly explanation: string;
  readonly involvedCells: readonly number[];
}

type HintAccumulator = (hint: Hint) => void | 'stop';

interface HintProducer {
  readonly technique: Technique;
  readonly difficulty: number;
  getHints(grid: Grid, accumulator: HintAccumulator): void;
}
```

---

## Phase Delivery Plan

### Phase 0 — Scaffolding

**Goal:** Repo passes CI with zero implementation. All tooling correct.
Claude Code generates everything listed below.

**Monorepo foundation:**

- [ ] `pnpm-workspace.yaml`
- [ ] Root `package.json` (scripts only, no runtime deps)
- [ ] `turbo.json` (pipeline as specified above)
- [ ] `tsconfig.base.json` (strict config as above)
- [ ] `.eslintrc.cjs` (typescript-eslint/recommended-type-checked)
- [ ] `.prettierrc` + `.prettierignore`
- [ ] `.commitlintrc.cjs`
- [ ] `.husky/pre-commit` (lint-staged: lint + format + typecheck on staged)
- [ ] `.husky/commit-msg` (commitlint)
- [ ] `.changeset/config.json`

**Package skeletons** (each needs: `package.json`, `tsconfig.json`,
`tsup.config.ts`, `vitest.config.ts`, `src/index.ts` stub, `tests/` dir):

- [ ] `packages/core`
- [ ] `packages/solver`
- [ ] `packages/generator`
- [ ] `packages/cli`
- [ ] `packages/react-native`

**GitHub Actions:**

- [ ] `.github/workflows/ci.yml` (parallel pipeline as specified above)
- [ ] `.github/workflows/release.yml` (Changesets + npm provenance + docs deploy)
- [ ] `.github/PULL_REQUEST_TEMPLATE.md`
- [ ] `.github/ISSUE_TEMPLATE/bug_report.md`
- [ ] `.github/ISSUE_TEMPLATE/technique_request.md`

**Documentation:**

- [ ] `docs/` VitePress skeleton
- [ ] `docs/adr/README.md` (ADR index)
- [ ] `docs/adr/_template.md`
- [ ] `docs/adr/0001` through `0007` (as listed above)
- [ ] `PORTING.md` (full guide as specified above)
- [ ] `CONTRIBUTING.md`
- [ ] `README.md`

**Benchmark harness:**

- [ ] `benchmarks/runner.ts`
- [ ] `benchmarks/corpus/` with seed puzzles + `README.md`
- [ ] `tools/se-oracle/` — SudokuExplainer Java CLI integration
- [ ] SE jar download/setup script
- [ ] Wrapper to run SE `serate` and compare output against TSudoku
- [ ] CI job to validate TSudoku ratings against SE oracle

**Deliverable:** `pnpm install && pnpm turbo build` succeeds. `pnpm lint`,
`pnpm typecheck`, `pnpm test`, `pnpm benchmark` all pass on empty stubs.
Benchmark reports 0% agreement (expected — no techniques yet).

---

### Phase 1 — Direct Techniques (SE 1.0–2.5)

**Goal:** Solve easy/medium puzzles. ≥ 99% SE agreement on SE ≤ 2.5 puzzles.

- [ ] Grid, Cell, Region models (immutable, fully typed)
- [ ] `createGrid(puzzle: string): Grid` factory
- [ ] `packages/core/src/candidates/bitmask.ts` utilities
- [ ] `recomputeCandidates(grid): Grid`
- [ ] `applyHint(grid, hint): Grid`
- [ ] Solver orchestrator + short-circuit accumulator
- [ ] `NakedSingle` (1.0 / 2.3)
- [ ] `HiddenSingle` box (1.2) + line (1.5)
- [ ] `DirectPointing` (1.7) + `DirectClaiming` (1.9)
- [ ] `DirectHiddenSet(2)` (2.0) + `DirectHiddenSet(3)` (2.5)
- [ ] `packages/core/tests/helpers.ts`
- [ ] Full test suite (detection + non-detection + short-circuit + explanation)
- [ ] CLI: `tsudoku solve`, `tsudoku hint`, `tsudoku validate`
- [ ] Benchmark: Phase 1 vs SE corpus

---

### Phase 2 — Candidate Techniques (SE 2.6–4.4)

**Goal:** Solve hard/fiendish puzzles. ≥ 99% SE agreement on SE ≤ 4.4 puzzles.

- [ ] `Pointing` (2.6) + `Claiming` (2.8)
- [ ] `NakedSet(size)` — parameterized 2/3/4
- [ ] `HiddenSet(size)` — parameterized 2/3/4
- [ ] `Fisherman(size)` — X-Wing (2) / Swordfish (3) / Jellyfish (4)
- [ ] `XYWing` (4.2) + `XYZWing` (4.4)
- [ ] Generator: produce puzzles using solver in reverse
- [ ] Difficulty rater: SE-compatible `ED=r/p/d` output
- [ ] CLI: `tsudoku generate`, `tsudoku rate`
- [ ] Benchmark: Phase 2 vs SE corpus

---

### Phase 3 — Uniqueness (SE 4.5–6.0)

- [ ] `UniqueRectangle` types 1–4
- [ ] `UniqueLoop` variants
- [ ] `BivalueUniversalGrave`
- [ ] Benchmark: Phase 3 vs SE corpus

---

### Phase 4 — Chains (SE 6.2+, server-side)

One technique at a time:

- [ ] `AlignedPairExclusion` (6.2) — simplest entry point
- [ ] `Chaining` infrastructure (Potential, link graph, weak/strong links)
- [ ] Bidirectional X/Y-Cycles → Forcing Chains → Nishio → Dynamic → Nested

---

### Phase 5 — Generator + Corpus

- [ ] Production generator with difficulty targeting
- [ ] Scenario tagging + 10k+ labeled puzzle corpus
- [ ] Digit permutation augmentation for ML training
- [ ] CLI: `tsudoku corpus generate|augment|stats`

---

### Phase 6 — ML Package

- [ ] Board feature extraction (729-bit candidate tensor + derived features)
- [ ] PyTorch training pipeline → ONNX export
- [ ] `@tsudoku/ml` with onnxruntime-react-native inference
- [ ] Self-training loop (shadow oracle from SE server during gameplay)

---

### Phase 7 — React Native App (parallel with Phase 2+)

- [ ] Board + candidate rendering
- [ ] Hint system UI with token economy
- [ ] Claude API integration with validation layer
- [ ] IAP via RevenueCat
- [ ] On-device engine (L1–L3) + server fallback (L4+)

---

## Token Economy (App Feature)

```
Free:          Naked singles (rule engine, zero cost)
1 token:       Technique name only
2 tokens:      Natural language explanation
1 token/step:  Step-by-step walkthrough (generated upfront, revealed incrementally)
5 tokens:      Full solution

Earn: solve clean +2, daily puzzle +2, 7-day streak +5, first hard solve +3
```

Hint validation: ALL Claude responses validated against board state before
display and before token debit. Failure → rule engine fallback, no charge.

Caching: `sha256(puzzleId + candidateBitmaskHash)` — one Claude call serves
N users at same board state.

Model routing: technique name → Haiku; explanation + walkthrough → Sonnet.

---

## SE Oracle (Backend / Corpus Generation)

```bash
java -cp SudokuExplainer.jar diuf.sudoku.test.serate \
  --input=puzzles.txt --output=rated.txt --format="%g ED=%r/%p/%d"
```

Used for: L4+ server hints, authoritative ratings, corpus labeling, ML training.
Never required on-device.

---

## Reference Links

- SE Java source: https://github.com/1to9only/SudokuExplainer
- SE technique wiki: https://github.com/SudokuMonster/SukakuExplainer/wiki
- SE difficulty ratings: http://forum.enjoysudoku.com/how-is-the-difficulty-of-a-sudoku-puzzle-determined-t32249.html
- SudokuWiki (visual technique explanations): https://www.sudokuwiki.org

---

## Open Questions

- [ ] React Native: Expo managed or bare workflow?
- [ ] Docs: auto-generate technique pages from metadata or hand-authored?
- [ ] ML: PyTorch (Python) vs TensorFlow.js?
- [ ] Chain techniques: port `Chaining.java` directly or reimplement using AIC theory?
- [ ] Unique Rectangle: types 1–4 only for V1, or all 7+ types?
- [ ] Corpus: CC0 license for public puzzle dataset?
