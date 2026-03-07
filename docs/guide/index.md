# Introduction

TSudoku is a TypeScript port of SudokuExplainer -- the gold-standard Sudoku technique classifier. It identifies named solving techniques, explains why moves are valid, and rates puzzle difficulty.

## Why TSudoku?

The JS/TS ecosystem has plenty of backtracking solvers. What it lacks is a solver that reasons the way humans do. TSudoku fills that gap.

## Packages

| Package                 | Description                                          |
| ----------------------- | ---------------------------------------------------- |
| `@tsudoku/core`         | Board model, candidates, technique detectors, solver |
| `@tsudoku/solver`       | Full solve path recording                            |
| `@tsudoku/generator`    | Puzzle generation + difficulty rating                |
| `@tsudoku/cli`          | Command-line interface                               |
| `@tsudoku/react-native` | React Native components + hooks                      |
