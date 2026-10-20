# Introduction

TSudoku is a TypeScript port of [SudokuExplainer](https://github.com/1to9only/SudokuExplainer) -- the gold-standard Sudoku technique classifier. It identifies named solving techniques, explains why moves are valid, and rates puzzle difficulty -- all in TypeScript with zero JVM dependency.

::: warning PROJECT STATUS
The engine covers **Phases 1 and 2** (SE 1.0–4.4) with **100% agreement against SudokuExplainer** on a 1858-puzzle corpus. Packages are **not yet published to npm** -- build from source. The web game is deployed privately while the teaching features take shape.
:::

## Why TSudoku?

The JS/TS ecosystem has plenty of backtracking solvers. What it lacks is a solver that reasons the way humans do. TSudoku fills that gap -- and uses it to build a game that _teaches_ techniques rather than just applying them.

## Roadmap

| Phase | Description                                | Status                                |
| ----- | ------------------------------------------ | ------------------------------------- |
| 0     | Monorepo scaffolding, CI, docs             | **Complete**                          |
| 1     | Direct techniques (SE 1.0–2.5)             | **Complete** -- 100% SE parity        |
| 2     | Candidate techniques (SE 2.6–4.4)          | **Complete** -- 100% SE parity        |
| --    | SE reference integration (Java CLI oracle) | **Complete** -- the benchmark's truth |
| --    | Generator + corpus pipeline                | **Complete** -- 1858 rated puzzles    |
| --    | Web game (notes, hints, difficulty bands)  | **Working** -- private deployment     |
| --    | Tutor: step-by-step technique lessons      | **In progress** -- next up            |
| 3     | Uniqueness techniques (SE 4.5–6.0)         | Not started                           |
| 4     | Chain techniques (SE 6.2+, server-side)    | Deferred                              |
| --    | React Native app                           | Planned, after the web app            |
| --    | ML package                                 | Parked                                |

The live, detailed plan is [STATUS.md](https://github.com/TeamNickHart/tsudoku/blob/main/STATUS.md) in the repository.

## Packages

| Package                 | Description                                          | Status      |
| ----------------------- | ---------------------------------------------------- | ----------- |
| `@tsudoku/core`         | Board model, candidates, technique detectors, solver | **Working** |
| `@tsudoku/game`         | Framework-free game state, notes, history, tutor     | **Working** |
| `@tsudoku/solver`       | Brute force, uniqueness, solution strings            | **Working** |
| `@tsudoku/generator`    | Puzzle generation + difficulty rating                | **Working** |
| `@tsudoku/cli`          | Command-line interface                               | Scaffold    |
| `@tsudoku/react-native` | React Native components + hooks                      | Scaffold    |
