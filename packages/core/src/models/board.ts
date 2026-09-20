/**
 * Board geometry.
 *
 * Every dimension the grid model depends on is derived from the three
 * primitives below, so there are no bare 9s, 81s or 3s scattered through
 * `GridImpl` / `CellImpl`.
 *
 * ## On arbitrary board sizes
 *
 * These are `const`, not configuration — TSudoku is a 9x9 engine today. The
 * point of funnelling geometry through one module is that *when* variant board
 * sizes are worth supporting (4x4, 6x6 with 2x3 boxes, 16x16), the arithmetic
 * that needs to change is here rather than spread across the codebase.
 *
 * Two constraints to know before attempting that:
 *
 * 1. **The candidate bitmask caps out at 32 digits.** Candidates are a JS
 *    number used with bitwise operators, which are 32-bit. Beyond 32 digits the
 *    representation itself has to change. `candidateCount` is additionally
 *    specialised for <= 9 bits today (verified exhaustively over 0..511) and
 *    would need widening first.
 *
 * 2. **The techniques are deliberately NOT parameterised.** They are
 *    line-by-line ports of SudokuExplainer's Java, and SE is 9x9-only. A `9` in
 *    a technique's loop bound corresponds to a `9` in the Java source, so
 *    replacing it with `SIZE` would be an undiscussed divergence from the
 *    reference — exactly what the Cardinal Rule forbids. Supporting variant
 *    boards means deciding what SE parity even means for a board SE cannot
 *    rate, which is a design discussion, not a refactor.
 *
 * So: geometry is centralised here, techniques stay literal. See
 * `notes/improvements.md` and CLAUDE.md's Cardinal Rule.
 */

/** Digits are 1..SIZE; the grid is SIZE x SIZE. */
export const SIZE = 9;

/** Width of a box in cells. */
export const BOX_WIDTH = 3;

/** Height of a box in cells. */
export const BOX_HEIGHT = 3;

/** Total cells in the grid. */
export const CELL_COUNT = SIZE * SIZE;

/** Boxes per band (horizontally). `SIZE / BOX_WIDTH` = 3 on a 9x9. */
export const BOXES_PER_ROW = SIZE / BOX_WIDTH;

/**
 * Region layout within `Grid.regions`: rows first, then columns, then boxes.
 * Each group has SIZE entries.
 */
export const ROW_OFFSET = 0;
export const COL_OFFSET = SIZE;
export const BOX_OFFSET = SIZE * 2;

/** Total regions: SIZE rows + SIZE columns + SIZE boxes. */
export const REGION_COUNT = SIZE * 3;

/** Row index (0-based) of a cell index. */
export function rowOf(index: number): number {
  return Math.floor(index / SIZE);
}

/** Column index (0-based) of a cell index. */
export function colOf(index: number): number {
  return index % SIZE;
}

/** Box index (0-based) of a row/column pair. */
export function boxOf(row: number, col: number): number {
  return Math.floor(row / BOX_HEIGHT) * BOXES_PER_ROW + Math.floor(col / BOX_WIDTH);
}

/** Cell index from a row/column pair. */
export function indexOf(row: number, col: number): number {
  return row * SIZE + col;
}
