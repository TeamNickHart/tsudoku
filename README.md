# TSudoku

> **A TypeScript-first Sudoku engine. Human techniques, machine precision.**

[![CI](https://github.com/TeamNickHart/tsudoku/actions/workflows/ci.yml/badge.svg)](https://github.com/TeamNickHart/tsudoku/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

TSudoku is an open-source TypeScript port of [SudokuExplainer](https://github.com/1to9only/SudokuExplainer) (SE), the Java Sudoku technique classifier the competitive Sudoku community has used for two decades. It runs natively in Node.js, browsers, and React Native (via Hermes), with no JVM dependency.

**Website:** [tsudoku.dev](https://tsudoku.dev)

---

## Why TSudoku?

Most Sudoku solvers use backtracking — they find a solution but can't explain _how_. TSudoku identifies the named human technique that applies at each step, explains why it works, and rates puzzle difficulty by the hardest technique required.

The goal is a **Sudoku game that teaches you to play better**, not one that just checks your answers. The engine is the foundation for that.

---

## Project Status

**Phases 1 and 2 are complete**, with **100% agreement against SudokuExplainer** across a 1858-puzzle corpus. The engine correctly detects and rates every technique in the SE 1.0–4.4 band — singles through X-Wing, Swordfish and XYZ-Wing.

On top of it sit a framework-free game layer (`@tsudoku/game`), a puzzle generator, and a playable web app. The app is deployed privately while it takes shape; the next big piece is the **tutor** — stepping a player through _why_ a technique works, not just where it applies.

See **[STATUS.md](./STATUS.md)** for the honest, current picture: what works, what's next, and the known issues.

```
$ pnpm benchmark

  Claiming                  25/25 (100.0%) PASS
  DirectHiddenPair          103/103 (100.0%) PASS
  DirectHiddenTriplet       100/100 (100.0%) PASS
  DirectPointing            106/106 (100.0%) PASS
  HiddenPair                123/123 (100.0%) PASS
  HiddenSingle              229/229 (100.0%) PASS
  HiddenTriplet             102/102 (100.0%) PASS
  NakedPair                 131/131 (100.0%) PASS
  NakedSingle               100/100 (100.0%) PASS
  NakedTriplet              108/108 (100.0%) PASS
  Pointing                  305/305 (100.0%) PASS
  Swordfish                 100/100 (100.0%) PASS
  XWing                     110/110 (100.0%) PASS
  XYWing                    100/100 (100.0%) PASS
  XYZWing                   116/116 (100.0%) PASS

  Overall: 1858/1858 (100.0%)
```

---

## What Works Today

`@tsudoku/core` solves puzzles through the Phase 2 technique band and explains every step:

```typescript
import { createGrid, applyHint, Solver } from '@tsudoku/core';

let grid = createGrid(
  '530070000600195000098000060800060003400803001700020006060000280000419005000080079',
);
const solver = new Solver();

const hint = solver.getNextHint(grid);
// {
//   type: 'direct',
//   technique: 'HiddenSingle',
//   cell: 5,
//   digit: 8,
//   difficulty: 1.2,
//   explanation: '8 can only go in R1C6 in box 2',
//   involvedCells: [...],
//   involvedCandidates: Map(...)
// }

grid = applyHint(grid, hint); // immutable — returns a new Grid
```

Every hint carries a human-readable `explanation` plus the cells and candidates
involved, which is what makes technique _teaching_ possible rather than just
technique _detection_.

> **Not published to npm yet.** Build from source — see below.

---

## Packages

pnpm monorepo; packages publish under the `@tsudoku` scope.

| Package                                            | Description                                      | Status                      |
| -------------------------------------------------- | ------------------------------------------------ | --------------------------- |
| [`@tsudoku/core`](./packages/core)                 | Grid model, candidate engine, techniques, solver | **Phases 1–2 complete**     |
| [`@tsudoku/game`](./packages/game)                 | Framework-free game state, notes, history, tutor | **Working**                 |
| [`@tsudoku/solver`](./packages/solver)             | Brute force, uniqueness, solution strings        | **Working**                 |
| [`@tsudoku/generator`](./packages/generator)       | Puzzle generation with SE-compatible rating      | **Working**                 |
| [`apps/web`](./apps/web)                           | The web game                                     | **Working** (private)       |
| [`@tsudoku/cli`](./packages/cli)                   | CLI for solving, rating, explaining, generating  | Stub                        |
| [`@tsudoku/react-native`](./packages/react-native) | React Native components and hooks                | Stub — after web proves out |

See [STATUS.md](./STATUS.md#the-architecture-split) for how the layers divide.

---

## Technique Coverage

Phases match SudokuExplainer's difficulty scale. For technique descriptions and visual examples, see [SudokuWiki](https://www.sudokuwiki.org).

### Phase 1 — Direct (SE 1.0–2.5) — **Complete**

| Technique             | SE rating       | SE parity                     |
| --------------------- | --------------- | ----------------------------- |
| Hidden Single         | 1.0 / 1.2 / 1.5 | 229/229                       |
| Direct Pointing       | 1.7             | 106/106                       |
| Direct Claiming       | 1.9             | _unreachable as a rating_[^1] |
| Direct Hidden Pair    | 2.0             | 103/103                       |
| Naked Single          | 2.3             | 100/100                       |
| Direct Hidden Triplet | 2.5             | 100/100                       |

[^1]: Implemented and correct, but SE's own scan order means it can never be a puzzle's hardest step. See [STATUS.md](./STATUS.md).

### Phase 2 — Candidate-based (SE 2.6–4.4) — **Complete**

| Technique      | SE rating | SE parity |
| -------------- | --------- | --------- |
| Pointing       | 2.6       | 305/305   |
| Claiming       | 2.8       | 25/25     |
| Naked Pair     | 3.0       | 131/131   |
| X-Wing         | 3.2       | 110/110   |
| Hidden Pair    | 3.4       | 123/123   |
| Naked Triplet  | 3.6       | 108/108   |
| Swordfish      | 3.8       | 100/100   |
| Hidden Triplet | 4.0       | 102/102   |
| XY-Wing        | 4.2       | 100/100   |
| XYZ-Wing       | 4.4       | 116/116   |

### Phase 3 — Uniqueness (SE 4.5–6.0) — Not started

Unique Rectangles (types 1–4), Unique Loops, Bivalue Universal Graves — plus Naked Quad, Jellyfish and Hidden Quad (5.0–5.4), which are already implemented as size-4 sets and fish but not yet registered or validated.

### Phase 4 — Chains (SE 6.2+) — Deferred

Aligned Pair Exclusion, X/Y-Cycles, Forcing Chains, Nishio, Dynamic and Nested variants. Server-side only; deprioritized in favor of the teaching app.

---

## Development

Requires Node 20+ and pnpm 10+.

```bash
pnpm install
pnpm build
pnpm test
```

Other useful commands:

```bash
pnpm benchmark:quick   # SE parity check, Phase 1 only
pnpm typecheck
pnpm lint
pnpm format
```

Run a single test file:

```bash
cd packages/core && npx vitest run tests/techniques/phase1/NakedSingle.test.ts
```

### Validating against SudokuExplainer

The benchmark is a CI gate: parity below 95% on any implemented technique fails the build. To rate puzzles against the real SE (requires Java):

```bash
bash tools/se-reference/setup.sh
bash tools/se-reference/rate.sh '530070000600195000098000060800060003400803001700020006060000280000419005000080079'
```

The SE Java source is a git submodule at `tools/se-reference/SudokuExplainer-source`, used as the reference for every port.

---

## Contributing

Contributions welcome — this is a hobby project that would be more fun with company.

Each technique is a self-contained file implementing one interface. Adding a technique means one source file, one test file, and registering it in the solver's producer list.

**Start here:** [STATUS.md](./STATUS.md) for what needs doing, [PORTING.md](./PORTING.md) for the Java→TypeScript porting workflow, and [CONTRIBUTING.md](./CONTRIBUTING.md) for conventions.

The one non-negotiable rule: **techniques are line-by-line ports of the SE Java source** — same structure, same iteration order, same control flow. SE parity is the project's entire credibility claim. Improvements over SE's algorithms are welcome as notes in [notes/improvements.md](./notes/improvements.md), not as code changes.

---

## Inspiration & Attribution

TSudoku is a TypeScript port of **Nicolas Juillerat's SudokuExplainer** (v1.2.1, 2006). Juillerat's original website is no longer online; the canonical source is the [1to9only/SudokuExplainer](https://github.com/1to9only/SudokuExplainer) fork, which preserves the original implementation alongside **Glenn Fowler's** (`gsf`) `serate` command-line rating modifications.

The SE difficulty scale, technique hierarchy, and technique names are derived from Juillerat's work and reproduced with attribution.

---

## License

MIT © TSudoku Contributors
