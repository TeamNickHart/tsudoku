// @tsudoku/solver — brute-force analysis, solve paths, difficulty rating

export const VERSION = '0.0.0';

export {
  bruteForceSolve,
  solutionString,
  countSolutions,
  hasUniqueSolution,
} from './BruteForceAnalysis.js';
export type { SolutionCount } from './BruteForceAnalysis.js';
export { hasNoDoubles, findDuplicate } from './NoDoubles.js';
