# Techniques

TSudoku will implement Sudoku solving techniques in phases matching SudokuExplainer's difficulty scale. All techniques listed below are **planned** -- none are implemented yet.

::: info CONVENTION
Technique status is tracked per-phase. Individual technique pages will be added as each is implemented.
:::

## Phase 1 -- Direct (SE 1.0-2.5) ::: Planned

Techniques solvable without writing candidates.

| Rating | Technique               | Status  |
| ------ | ----------------------- | ------- |
| 1.0    | Last Value              | Planned |
| 1.2    | Hidden Single (box)     | Planned |
| 1.5    | Hidden Single (row/col) | Planned |
| 1.7    | Direct Pointing         | Planned |
| 1.9    | Direct Claiming         | Planned |
| 2.0    | Direct Hidden Pair      | Planned |
| 2.3    | Naked Single            | Planned |
| 2.5    | Direct Hidden Triplet   | Planned |

## Phase 2 -- Candidate-based (SE 2.6-4.4) ::: Planned

Techniques requiring candidate notation.

| Rating | Technique      | Status  |
| ------ | -------------- | ------- |
| 2.6    | Pointing       | Planned |
| 2.8    | Claiming       | Planned |
| 3.0    | Naked Pair     | Planned |
| 3.2    | X-Wing         | Planned |
| 3.4    | Hidden Pair    | Planned |
| 3.6    | Naked Triplet  | Planned |
| 3.8    | Swordfish      | Planned |
| 4.0    | Hidden Triplet | Planned |
| 4.2    | XY-Wing        | Planned |
| 4.4    | XYZ-Wing       | Planned |

## Phase 3 -- Uniqueness (SE 4.5-6.0) ::: Planned

Techniques exploiting the unique-solution constraint.

| Rating  | Technique                    | Status  |
| ------- | ---------------------------- | ------- |
| 4.5-5.0 | Unique Rectangle (types 1-4) | Planned |
| 5.0     | Naked Quad                   | Planned |
| 5.2     | Jellyfish                    | Planned |
| 5.4     | Hidden Quad                  | Planned |
| 5.6-6.0 | Bivalue Universal Grave      | Planned |

## Phase 4 -- Chains (SE 6.2+) ::: Planned

Chain-based techniques (server-side only in the planned architecture).

| Rating | Technique                   | Status  |
| ------ | --------------------------- | ------- |
| 6.2    | Aligned Pair Exclusion      | Planned |
| 6.5+   | Various chaining techniques | Planned |
