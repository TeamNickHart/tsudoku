import { SIZE, colOf, rowOf } from '@tsudoku/core';
import type { DirectHint, Grid } from '@tsudoku/core';
import type { Decoration } from '../types.js';
import type { Lesson, LessonStep } from './types.js';

/**
 * Explain a Hidden Single — the first real technique a learner meets.
 *
 * The hint says "9 can only go in R1C7 in box 3". True, but it is the
 * conclusion, and a learner who could see it would not have asked. The
 * argument underneath has three moves:
 *
 *   1. this region has to contain a 9 somewhere — every region holds 1-9
 *   2. these cells cannot take it, because each already sees a 9
 *   3. one cell is left, so that is where it goes
 *
 * Step 2 is the one that teaches, and it is the one the explanation omits.
 * "Sees a 9" means shares a row, column or box with a placed 9 — so for each
 * ruled-out cell we can name the *specific* 9 doing the ruling out, which is
 * the difference between being told the answer and being shown it.
 */

function cellName(index: number): string {
  return `R${rowOf(index) + 1}C${colOf(index) + 1}`;
}

/** Human name for the region a hidden single was found in. */
function regionName(kind: 'row' | 'col' | 'box', index: number): string {
  if (kind === 'row') return `row ${index + 1}`;
  if (kind === 'col') return `column ${index + 1}`;
  return `box ${index + 1}`;
}

/** The cells of a region, by kind and index. */
function regionCells(grid: Grid, kind: 'row' | 'col' | 'box', index: number): readonly number[] {
  const region =
    kind === 'row' ? grid.getRow(index) : kind === 'col' ? grid.getCol(index) : grid.getBox(index);
  return region.cells.map((c) => c.index);
}

/**
 * Which region this hidden single was found in.
 *
 * The hint does not record it — `involvedCells` is just the target — so it is
 * recovered by asking which region containing the cell has exactly one place
 * left for the digit. Box is checked first because SE finds box singles first
 * (1.2) and rates them easier than line singles (1.5), so preferring the box
 * matches both the engine's reasoning and the gentler explanation.
 */
function findRegion(
  grid: Grid,
  cell: number,
  digit: number,
): { kind: 'row' | 'col' | 'box'; index: number } | null {
  const row = rowOf(cell);
  const col = colOf(cell);
  const box = grid.getCellByIndex(cell).box;

  const candidates: { kind: 'row' | 'col' | 'box'; index: number }[] = [
    { kind: 'box', index: box },
    { kind: 'row', index: row },
    { kind: 'col', index: col },
  ];

  for (const candidate of candidates) {
    const cells = regionCells(grid, candidate.kind, candidate.index);
    const places = cells.filter((i) => {
      const c = grid.getCellByIndex(i);
      return c.value === null && c.candidateList.includes(digit);
    });
    if (places.length === 1 && places[0] === cell) return candidate;
  }
  return null;
}

/**
 * A placed cell holding `digit` that shares a line or box with `cell`.
 *
 * This is the *evidence* — the specific digit that rules the cell out. Peers
 * are searched in the order a person would scan: along the row, then the
 * column, then the rest of the box.
 */
function blockerFor(grid: Grid, cell: number, digit: number): number | null {
  const row = rowOf(cell);
  const col = colOf(cell);

  for (let c = 0; c < SIZE; c++) {
    const index = row * SIZE + c;
    if (index !== cell && grid.getCellByIndex(index).value === digit) return index;
  }
  for (let r = 0; r < SIZE; r++) {
    const index = r * SIZE + col;
    if (index !== cell && grid.getCellByIndex(index).value === digit) return index;
  }
  for (const index of regionCells(grid, 'box', grid.getCellByIndex(cell).box)) {
    if (index !== cell && grid.getCellByIndex(index).value === digit) return index;
  }
  return null;
}

/**
 * Build the walk-through for a hidden single.
 *
 * @returns the lesson, or null if the hint is not a hidden single this
 *   explainer recognises — callers should fall back to the plain explanation
 *   rather than showing a broken lesson.
 */
export function explainHiddenSingle(hint: DirectHint, grid: Grid): Lesson | null {
  if (hint.technique !== 'HiddenSingle') return null;

  const { cell, digit } = hint;
  const region = findRegion(grid, cell, digit);
  if (region === null) return null;

  const where = regionName(region.kind, region.index);
  const cells = regionCells(grid, region.kind, region.index);

  // Cells in the region that are empty but cannot take the digit. These are
  // what the argument actually rests on.
  const ruledOut: { cell: number; blocker: number }[] = [];
  for (const index of cells) {
    if (index === cell) continue;
    if (grid.getCellByIndex(index).value !== null) continue;
    const blocker = blockerFor(grid, index, digit);
    if (blocker !== null) ruledOut.push({ cell: index, blocker });
  }

  const alreadyFilled = cells.filter((i) => i !== cell && grid.getCellByIndex(i).value !== null);

  const steps: LessonStep[] = [];

  // 1. Frame the region and the goal.
  steps.push({
    caption: `Every ${region.kind === 'box' ? 'box' : region.kind} holds each digit exactly once, so ${where} needs a ${digit} somewhere.`,
    decorations: cells.map(
      (index): Decoration => ({ target: { kind: 'cell', cell: index }, role: 'supporting' }),
    ),
  });

  // 2. Discount the cells that are already filled — cheap to say, and it stops
  //    the count in step 3 looking like it came from nowhere.
  if (alreadyFilled.length > 0) {
    steps.push({
      caption: `${alreadyFilled.length} of these ${alreadyFilled.length === 1 ? 'cell is' : 'cells are'} already filled, so the ${digit} must go in one of the empty ones.`,
      decorations: [
        ...alreadyFilled.map(
          (index): Decoration => ({ target: { kind: 'cell', cell: index }, role: 'eliminated' }),
        ),
        ...cells
          .filter((i) => !alreadyFilled.includes(i))
          .map(
            (index): Decoration => ({ target: { kind: 'cell', cell: index }, role: 'supporting' }),
          ),
      ],
    });
  }

  // 3. The heart of it: rule out each remaining cell, naming the evidence.
  for (const { cell: ruled, blocker } of ruledOut) {
    steps.push({
      caption: `${cellName(ruled)} can't be ${digit} — ${cellName(blocker)} already has one.`,
      decorations: [
        { target: { kind: 'cell', cell: ruled }, role: 'eliminated' },
        { target: { kind: 'cell', cell: blocker }, role: 'primary' },
        { target: { kind: 'note', cell: ruled, digit }, role: 'eliminated' },
      ],
    });
  }

  // 4. The conclusion, now earned.
  steps.push({
    caption: `That leaves only ${cellName(cell)}, so it must be ${digit}.`,
    decorations: [
      { target: { kind: 'cell', cell }, role: 'primary', note: hint.explanation },
      ...ruledOut.map(
        ({ cell: ruled }): Decoration => ({
          target: { kind: 'cell', cell: ruled },
          role: 'eliminated',
        }),
      ),
    ],
  });

  return {
    technique: 'HiddenSingle',
    principle:
      'If a digit has only one possible cell left in a row, column or box, it goes there — ' +
      'even when that cell still has other candidates of its own.',
    steps,
  };
}
