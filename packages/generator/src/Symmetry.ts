import { SIZE, colOf, indexOf, rowOf } from '@tsudoku/core';

/**
 * Cell-removal symmetries — port of SE's
 * `diuf/sudoku/generator/Symmetry.java`.
 *
 * When the generator clears a cell it clears that cell's symmetric partners
 * too, which is what makes a generated puzzle look hand-made rather than
 * scattered. It also costs clues: the more partners a symmetry has, the more
 * cells must be removable together, so highly symmetric puzzles end up with
 * more givens than asymmetric ones.
 *
 * SE works in (x, y) where x is the column and y is the row. TSudoku works in
 * flat cell indexes, so each symmetry converts once at the edges rather than
 * threading a Point type through the generator.
 */

const LAST = SIZE - 1;

export interface Symmetry {
  readonly name: string;
  readonly description: string;
  /** The cell itself plus its symmetric partners. May contain duplicates. */
  pointsFor(cell: number): readonly number[];
}

/** Build a symmetry from an (x, y) → [(x, y), …] mapping, as SE expresses it. */
function fromPoints(
  name: string,
  description: string,
  map: (x: number, y: number) => readonly (readonly [number, number])[],
): Symmetry {
  return {
    name,
    description,
    pointsFor(cell: number): readonly number[] {
      const x = colOf(cell);
      const y = rowOf(cell);
      // Deduplicated: on the centre cell or an axis, several partners collapse
      // onto the same square, and the generator would otherwise "remove" a
      // cell it had already emptied.
      return [...new Set(map(x, y).map(([px, py]) => indexOf(py, px)))];
    },
  };
}

/** No symmetry — each cell is removed alone. Yields the fewest clues. */
export const NO_SYMMETRY: Symmetry = fromPoints('None', 'No symmetry', (x, y) => [[x, y]]);

export const VERTICAL: Symmetry = fromPoints(
  'Vertical',
  'Mirror symmetry around the vertical axis',
  (x, y) => [
    [x, y],
    [LAST - x, y],
  ],
);

export const HORIZONTAL: Symmetry = fromPoints(
  'Horizontal',
  'Mirror symmetry around the horizontal axis',
  (x, y) => [
    [x, y],
    [x, LAST - y],
  ],
);

export const DIAGONAL: Symmetry = fromPoints(
  'Diagonal',
  'Mirror symmetry around the raising diagonal',
  (x, y) => [
    [x, y],
    [LAST - y, LAST - x],
  ],
);

export const ANTI_DIAGONAL: Symmetry = fromPoints(
  'Anti-diagonal',
  'Mirror symmetry around the falling diagonal',
  (x, y) => [
    [x, y],
    [y, x],
  ],
);

export const BI_DIAGONAL: Symmetry = fromPoints(
  'Bi-diagonal',
  'Mirror symmetries around both diagonals',
  (x, y) => [
    [x, y],
    [y, x],
    [LAST - y, LAST - x],
    [LAST - x, LAST - y],
  ],
);

export const ORTHOGONAL: Symmetry = fromPoints(
  'Orthogonal',
  'Mirror symmetries around the horizontal and vertical axes',
  (x, y) => [
    [x, y],
    [LAST - x, y],
    [x, LAST - y],
    [LAST - x, LAST - y],
  ],
);

export const ROTATIONAL_180: Symmetry = fromPoints(
  'Rotational 180',
  '180 degree rotational symmetry',
  (x, y) => [
    [x, y],
    [LAST - x, LAST - y],
  ],
);

export const ROTATIONAL_90: Symmetry = fromPoints(
  'Rotational 90',
  '90 degree rotational symmetry',
  (x, y) => [
    [x, y],
    [LAST - x, LAST - y],
    [y, LAST - x],
    [LAST - y, x],
  ],
);

/** Every symmetry SE defines, in SE's declaration order. */
export const SYMMETRIES: readonly Symmetry[] = [
  VERTICAL,
  HORIZONTAL,
  DIAGONAL,
  ANTI_DIAGONAL,
  BI_DIAGONAL,
  ORTHOGONAL,
  ROTATIONAL_180,
  ROTATIONAL_90,
  NO_SYMMETRY,
];
