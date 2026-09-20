// @tsudoku/solver — brute-force analysis, solve paths, difficulty rating

export const VERSION = '0.0.0';

export {
  bruteForceSolve,
  solveRandom,
  solutionString,
  countSolutions,
  hasUniqueSolution,
} from './BruteForceAnalysis.js';
export type { SolutionCount, Rng } from './BruteForceAnalysis.js';
export { hasNoDoubles, findDuplicate } from './NoDoubles.js';
