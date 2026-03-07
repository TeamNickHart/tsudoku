# Quick Start

```typescript
import { createGrid, Solver } from '@tsudoku/core';

const puzzle = '530070000600195000098000060800060003400803001700020006060000280000419005000080079';
const grid = createGrid(puzzle);
const solver = new Solver();

const hint = solver.getNextHint(grid);
console.log(hint);
// {
//   type: 'direct',
//   technique: 'NakedSingle',
//   cell: 14,
//   digit: 4,
//   difficulty: 2.3,
//   explanation: 'Cell R2C6 has only one remaining candidate: 4'
// }
```
