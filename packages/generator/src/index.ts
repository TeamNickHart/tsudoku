// @tsudoku/generator — puzzle generation with SE-compatible symmetries

export const VERSION = '0.0.0';

export { generate, generateMany } from './Generator.js';
export type { GenerateOptions, GeneratedPuzzle } from './Generator.js';

export {
  SYMMETRIES,
  NO_SYMMETRY,
  VERTICAL,
  HORIZONTAL,
  DIAGONAL,
  ANTI_DIAGONAL,
  BI_DIAGONAL,
  ORTHOGONAL,
  ROTATIONAL_180,
  ROTATIONAL_90,
} from './Symmetry.js';
export type { Symmetry } from './Symmetry.js';
