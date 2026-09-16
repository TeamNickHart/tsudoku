import type { Technique } from './Technique.js';

export interface DirectHint {
  readonly type: 'direct';
  readonly technique: Technique;
  readonly difficulty: number;
  readonly cell: number;
  readonly digit: number;
  readonly explanation: string;
  readonly involvedCells: readonly number[];
  readonly involvedCandidates: ReadonlyMap<number, readonly number[]>;
}

export interface EliminationHint {
  readonly type: 'elimination';
  readonly technique: Technique;
  readonly difficulty: number;
  readonly eliminations: ReadonlyArray<{ readonly cell: number; readonly digit: number }>;
  readonly explanation: string;
  readonly involvedCells: readonly number[];
  readonly involvedCandidates: ReadonlyMap<number, readonly number[]>;
}

export type Hint = DirectHint | EliminationHint;

export type HintAccumulator = (hint: Hint) => void | 'stop';
