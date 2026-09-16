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

**Phase 1 is complete**, with **100% agreement against SudokuExplainer** across a 607-puzzle corpus. The core engine correctly detects and rates every direct technique in the SE 1.0–2.5 band.

Everything downstream of `@tsudoku/core` — solver, generator, CLI, UI — is still scaffolding.

See **[STATUS.md](./STATUS.md)** for the honest, current picture: what works, what's next, and the known issues.

```
$ pnpm benchmark:quick

  DirectHiddenPair          103/103 (100.0%) PASS
  DirectHiddenTriplet       100/100 (100.0%) PASS
  DirectPointing            100/100 (100.0%) PASS
  HiddenSingle              204/204 (100.0%) PASS
  NakedSingle               100/100 (100.0%) PASS

  Overall: 607/607 (100.0%)      Status: PASS
```

---

## What Works Today

`@tsudoku/core` solves puzzles through the Phase 1 technique band and explains every step:

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

| Package                                            | Description                                      | Status               |
| -------------------------------------------------- | ------------------------------------------------ | -------------------- |
| [`@tsudoku/core`](./packages/core)                 | Grid model, candidate engine, techniques, solver | **Phase 1 complete** |
| [`@tsudoku/solver`](./packages/solver)             | Full solve-path recording                        | Stub                 |
| [`@tsudoku/generator`](./packages/generator)       | Puzzle generation + SE-compatible rating         | Stub                 |
| [`@tsudoku/cli`](./packages/cli)                   | CLI for solving, rating, explaining, generating  | Stub                 |
| [`@tsudoku/react-native`](./packages/react-native) | React Native components and hooks                | Stub                 |

Planned but not yet created: `@tsudoku/game` (framework-free game state) and `@tsudoku/web` (the web UI). See [STATUS.md](./STATUS.md#the-architecture-split) for how the layers divide.

---

## Technique Coverage

Phases match SudokuExplainer's difficulty scale. For technique descriptions and visual examples, see [SudokuWiki](https://www.sudokuwiki.org).

### Phase 1 — Direct (SE 1.0–2.5) — **Complete**

| Technique             | SE rating       | SE parity       |
| --------------------- | --------------- | --------------- |
| Hidden Single         | 1.0 / 1.2 / 1.5 | 204/204         |
| Direct Pointing       | 1.7             | 100/100         |
| Direct Claiming       | 1.9             | _no corpus yet_ |
| Direct Hidden Pair    | 2.0             | 103/103         |
| Naked Single          | 2.3             | 100/100         |
| Direct Hidden Triplet | 2.5             | 100/100         |

### Phase 2 — Candidate-based (SE 2.6–4.4) — Next up

Pointing & Claiming (Locked Candidates), Naked/Hidden Sets (pairs–quads), X-Wing, Swordfish, Jellyfish, XY-Wing, XYZ-Wing.

### Phase 3 — Uniqueness (SE 4.5–6.0) — Not started

Unique Rectangles (types 1–4), Unique Loops, Bivalue Universal Graves.

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
