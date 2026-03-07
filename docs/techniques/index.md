# Techniques

TSudoku implements Sudoku solving techniques in phases matching SudokuExplainer's difficulty scale.

## Phase 1 -- Direct (SE 1.0-2.5)

| Rating | Technique               |
| ------ | ----------------------- |
| 1.0    | Last Value              |
| 1.2    | Hidden Single (box)     |
| 1.5    | Hidden Single (row/col) |
| 1.7    | Direct Pointing         |
| 1.9    | Direct Claiming         |
| 2.0    | Direct Hidden Pair      |
| 2.3    | Naked Single            |
| 2.5    | Direct Hidden Triplet   |

## Phase 2 -- Candidate-based (SE 2.6-4.4)

| Rating | Technique      |
| ------ | -------------- |
| 2.6    | Pointing       |
| 2.8    | Claiming       |
| 3.0    | Naked Pair     |
| 3.2    | X-Wing         |
| 3.4    | Hidden Pair    |
| 3.6    | Naked Triplet  |
| 3.8    | Swordfish      |
| 4.0    | Hidden Triplet |
| 4.2    | XY-Wing        |
| 4.4    | XYZ-Wing       |

## Phase 3 -- Uniqueness (SE 4.5-6.0)

| Rating  | Technique                    |
| ------- | ---------------------------- |
| 4.5-5.0 | Unique Rectangle (types 1-4) |
| 5.0     | Naked Quad                   |
| 5.2     | Jellyfish                    |
| 5.4     | Hidden Quad                  |
| 5.6-6.0 | Bivalue Universal Grave      |

## Phase 4 -- Chains (SE 6.2+)

| Rating | Technique                   |
| ------ | --------------------------- |
| 6.2    | Aligned Pair Exclusion      |
| 6.5+   | Various chaining techniques |
