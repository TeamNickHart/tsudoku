# TSudoku

> **A TypeScript-first Sudoku engine. Human techniques, machine precision.**

[![CI](https://github.com/tsudoku/tsudoku/actions/workflows/ci.yml/badge.svg)](https://github.com/tsudoku/tsudoku/actions)
[![npm version](https://badge.fury.io/js/%40tsudoku%2Fcore.svg)](https://badge.fury.io/js/%40tsudoku%2Fcore)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

TSudoku is an open-source TypeScript port of [SudokuExplainer](https://github.com/1to9only/SudokuExplainer), a Java-based Sudoku technique classifier used by the competitive Sudoku community. It runs natively in Node.js, browsers, and React Native (via Hermes), with no JVM dependency.

**Website:** [tsudoku.dev](https://tsudoku.dev)

---

## What is Sudoku?

Sudoku is a logic puzzle played on a 9×9 grid divided into nine 3×3 boxes. The goal is to fill every cell with a digit 1–9 such that each digit appears exactly once in every row, column, and box. No arithmetic is required — the digits are purely symbolic. For a thorough introduction, see [SudokuWiki](https://www.sudokuwiki.org).

---

## Why TSudoku?

Most Sudoku solvers use backtracking — they find a solution but cannot explain _how_. TSudoku identifies the named human technique that applies at each step, explains why it works, and rates puzzle difficulty by the hardest technique required. This mirrors how competitive solvers and publishers like [Nikoli](https://www.nikoli.co.jp) think about Sudoku difficulty.

```typescript
import { createGrid, Solver } from '@tsudoku/core';

const grid = createGrid(
  '530070000600195000098000060800060003400803001700020006060000280000419005000080079',
);
const solver = new Solver();

const hint = solver.getNextHint(grid);
// {
//   type: 'direct',
//   technique: 'NakedSingle',
//   cell: 14,
//   digit: 4,
//   difficulty: 2.3,
//   explanation: 'Cell R2C6 has only one remaining candidate: 4'
// }
```

---

## Packages

This is a pnpm monorepo. Packages are published under the `@tsudoku` scope.

| Package                                            | Description                                                             |
| -------------------------------------------------- | ----------------------------------------------------------------------- |
| [`@tsudoku/core`](./packages/core)                 | Board model, candidate engine, technique detectors, solver orchestrator |
| [`@tsudoku/solver`](./packages/solver)             | Human-style solver with full solve path recording                       |
| [`@tsudoku/generator`](./packages/generator)       | Puzzle generation and SE-compatible difficulty rating                   |
| [`@tsudoku/cli`](./packages/cli)                   | Command-line interface for solving, hinting, generating, benchmarking   |
| [`@tsudoku/react-native`](./packages/react-native) | React Native components and hooks                                       |
| [`@tsudoku/ml`](./packages/ml)                     | ONNX model training pipeline and on-device inference _(roadmap)_        |

---

## Technique Coverage

Techniques are implemented in phases matching SudokuExplainer's difficulty rating scale. For technique descriptions and visual examples, see [SudokuWiki](https://www.sudokuwiki.org).

### Phase 1 — Direct (SE 1.0–2.5) ✅

Solvable without writing candidates: Last Value, Hidden Singles, Direct Pointing/Claiming, Direct Hidden Pairs/Triplets, Naked Singles.

### Phase 2 — Candidate-based (SE 2.6–4.4) ✅

Pointing & Claiming (Locked Candidates), Naked/Hidden Sets (pairs through quads), X-Wing, Swordfish, Jellyfish, XY-Wing, XYZ-Wing.

### Phase 3 — Uniqueness (SE 4.5–6.0) 🚧

Unique Rectangles (types 1–4), Unique Loops, Bivalue Universal Graves.

### Phase 4 — Chains (SE 6.2+) 🗺️

Aligned Pair Exclusion, Bidirectional X/Y-Cycles, Forcing Chains, Nishio, Dynamic and Nested variants.

---

## CLI Quick Start

```bash
npm install -g @tsudoku/cli

# Solve a puzzle
tsudoku solve "530070000600195000098000060800060003400803001700020006060000280000419005000080079"

# Get the next hint with explanation
tsudoku hint --puzzle "..." --type explanation

# Generate a puzzle at a target difficulty
tsudoku generate --difficulty 3.8

# Rate a puzzle (SE-compatible output)
tsudoku rate --puzzle "..."
# → ED=3.8/2.6/1.2

# Benchmark against SE reference corpus
tsudoku benchmark --corpus se-reference.jsonl
```

---

## Contributing

Each technique is a self-contained file implementing a single interface. Adding a new technique means adding one file, one test file, and registering it in the solver's producer list.

See [CONTRIBUTING.md](./CONTRIBUTING.md) and [PORTING.md](./PORTING.md) for the full guide.

---

## Inspiration & Attribution

TSudoku is a TypeScript port of **Nicolas Juillerat's SudokuExplainer** (v1.2.1, 2006). Juillerat's original website is no longer online; the canonical source for the Java code is the [1to9only/SudokuExplainer](https://github.com/1to9only/SudokuExplainer) fork on GitHub, which preserves Juillerat's original implementation alongside **Glenn Fowler's** (`gsf`) `serate` command-line rating modifications.

The SE difficulty rating scale, technique hierarchy, and technique names used throughout TSudoku are derived from Juillerat's work and reproduced with attribution.

---

## License

MIT © TSudoku Contributors
