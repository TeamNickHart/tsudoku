# TSudoku

> **A TypeScript-first Sudoku engine. Human techniques, machine precision.**

[![CI](https://github.com/tsudoku/tsudoku/actions/workflows/ci.yml/badge.svg)](https://github.com/tsudoku/tsudoku/actions)
[![npm version](https://badge.fury.io/js/%40tsudoku%2Fcore.svg)](https://badge.fury.io/js/%40tsudoku%2Fcore)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

TSudoku is an open-source TypeScript port of [SudokuExplainer](https://github.com/1to9only/SudokuExplainer) — the gold-standard Sudoku technique classifier used by the competitive Sudoku community for 20 years. It runs natively in Node.js, browsers, and React Native (via Hermes), with zero JVM dependency.

**Website:** [tsudoku.dev](https://tsudoku.dev)

---

## Why TSudoku?

The JavaScript/TypeScript ecosystem has plenty of backtracking Sudoku solvers. What it has never had is a solver that reasons the way humans do — identifying named techniques, explaining *why* a digit can be placed or a candidate eliminated, and rating puzzle difficulty by the hardest technique required.

TSudoku fills that gap.

```typescript
import { createGrid, Solver } from '@tsudoku/core';

const grid = createGrid('530070000600195000098000060800060003400803001700020006060000280000419005000080079');
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

| Package | Description |
|---|---|
| [`@tsudoku/core`](./packages/core) | Board model, candidate engine, technique detectors, solver orchestrator |
| [`@tsudoku/solver`](./packages/solver) | Human-style solver with full solve path recording |
| [`@tsudoku/generator`](./packages/generator) | Puzzle generation and SE-compatible difficulty rating |
| [`@tsudoku/cli`](./packages/cli) | Command-line interface for solving, hinting, generating, benchmarking |
| [`@tsudoku/react-native`](./packages/react-native) | React Native components and hooks |
| [`@tsudoku/ml`](./packages/ml) | ONNX model training pipeline and on-device inference *(roadmap)* |

---

## Technique Coverage

TSudoku implements techniques in phases matching SE's difficulty rating scale:

### Phase 1 — Direct (SE 1.0–2.5) ✅
Techniques solvable without writing candidates: Last Value, Hidden Singles, Direct Pointing/Claiming, Direct Hidden Pairs/Triplets, Naked Singles.

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
tsudoku generate --difficulty 3.8 --technique x-wing

# Rate a puzzle (SE-compatible output)
tsudoku rate --puzzle "..." 
# → ED=3.8/2.6/1.2

# Benchmark against SE reference corpus
tsudoku benchmark --corpus se-reference.jsonl
```

---

## SE Parity

TSudoku measures agreement with SudokuExplainer's ratings on a reference corpus of rated puzzles. Current benchmark results:

```
Naked Singles:      100% agreement
Hidden Singles:     100% agreement
Naked Pairs:         99.8% agreement
X-Wing:              99.1% agreement
Overall SE rating:   97.3% correlation (r=0.97)
```

Reproducible with: `pnpm benchmark`

---

## Contributing

TSudoku is intentionally designed to be contribution-friendly. Each technique is a self-contained file implementing a single interface. Adding a new technique means adding one file, one test file, and registering it in the solver's producer list.

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full guide, including how to use SudokuExplainer's Java source as a reference for new technique ports.

---

## Inspiration & Attribution

TSudoku is a TypeScript port of Nicolas Juillerat's [SudokuExplainer](http://diuf.unifr.ch/pai/people/juillera/Sudoku/Sudoku.html) (v1.2.1), with reference to Glenn Fowler's serate modifications and the [1to9only fork](https://github.com/1to9only/SudokuExplainer). The SE difficulty rating scale and technique hierarchy are reproduced with attribution.

---

## License

MIT © TSudoku Contributors
