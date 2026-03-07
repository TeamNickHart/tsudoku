# Introduction

TSudoku is a TypeScript port of [SudokuExplainer](https://github.com/1to9only/SudokuExplainer) -- the gold-standard Sudoku technique classifier. The goal is to identify named solving techniques, explain why moves are valid, and rate puzzle difficulty -- all in TypeScript with zero JVM dependency.

::: warning PROJECT STATUS
TSudoku is in **Phase 0**. The monorepo scaffold is complete but no solving techniques are implemented yet. This documentation describes the project's goals and architecture.
:::

## Why TSudoku?

The JS/TS ecosystem has plenty of backtracking solvers. What it lacks is a solver that reasons the way humans do. TSudoku aims to fill that gap.

## Roadmap

| Phase | Description                             | Status       |
| ----- | --------------------------------------- | ------------ |
| 0     | Monorepo scaffolding, CI, docs          | **Complete** |
| 1     | Direct techniques (SE 1.0-2.5)          | Not started  |
| 2     | Candidate techniques (SE 2.6-4.4)       | Not started  |
| 3     | Uniqueness techniques (SE 4.5-6.0)      | Not started  |
| 4     | Chain techniques (SE 6.2+, server-side) | Not started  |
| 5     | Generator + corpus pipeline             | Not started  |
| 6     | ML package (ONNX inference)             | Not started  |

## Packages

All packages are scaffolded but not yet functional.

| Package                 | Description                                          | Status   |
| ----------------------- | ---------------------------------------------------- | -------- |
| `@tsudoku/core`         | Board model, candidates, technique detectors, solver | Scaffold |
| `@tsudoku/solver`       | Full solve path recording                            | Scaffold |
| `@tsudoku/generator`    | Puzzle generation + difficulty rating                | Scaffold |
| `@tsudoku/cli`          | Command-line interface                               | Scaffold |
| `@tsudoku/react-native` | React Native components + hooks                      | Scaffold |
