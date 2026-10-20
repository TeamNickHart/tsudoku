# Quick Start

::: warning NOT YET PUBLISHED
`@tsudoku/core` is not on npm yet. Build it from source (see [Installation](./installation.md)); the API below works today.
:::

```typescript
import { createGrid, applyHint, Solver } from '@tsudoku/core';

const puzzle = '530070000600195000098000060800060003400803001700020006060000280000419005000080079';
let grid = createGrid(puzzle);
const solver = new Solver();

const hint = solver.getNextHint(grid);
// {
//   type: 'direct',
//   technique: 'HiddenSingle',
//   difficulty: 1.2,
//   cell: 5,
//   digit: 8,
//   explanation: '8 can only go in R1C6 in box 2',
//   involvedCells: [...],
//   involvedCandidates: Map(...)
// }

grid = applyHint(grid, hint); // immutable -- returns a new Grid
```

Every hint carries a human-readable `explanation` plus the cells and candidates
involved. Elimination techniques (Pointing, X-Wing, XY-Wing and the rest of
Phase 2) return an `EliminationHint` listing the candidates they remove.
