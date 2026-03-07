# Quick Start

::: warning NOT YET IMPLEMENTED
The API shown below is the **planned** public interface. It is not functional yet. Implementation begins in Phase 1.
:::

The planned usage will look like:

```typescript
import { createGrid, Solver } from '@tsudoku/core';

const puzzle = '530070000600195000098000060800060003400803001700020006060000280000419005000080079';
const grid = createGrid(puzzle);
const solver = new Solver();

const hint = solver.getNextHint(grid);
// Expected output (once implemented):
// {
//   type: 'direct',
//   technique: 'NakedSingle',
//   cell: 14,
//   digit: 4,
//   difficulty: 2.3,
//   explanation: 'Cell R2C6 has only one remaining candidate: 4'
// }
```
