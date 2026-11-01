import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Solver } from '@tsudoku/core';
import type { Grid, Hint } from '@tsudoku/core';
import { applyHintAsMove, applyMove, createGame, presentHint, toPlayerGrid } from '../src/index.js';
import type { GameState } from '../src/index.js';

/**
 * One real hint per technique, found by playing corpus puzzles the way a player
 * would: placements entered, eliminations struck.
 */
function hintsByTechnique(): ReadonlyMap<string, { hint: Hint; grid: Grid }> {
  const corpus = ['phase1', 'phase2'].flatMap((phase) =>
    readFileSync(new URL(`../../../benchmarks/corpus/${phase}.jsonl`, import.meta.url), 'utf8')
      .trim()
      .split('\n')
      .map((line) => (JSON.parse(line) as { puzzle: string }).puzzle),
  );
  const found = new Map<string, { hint: Hint; grid: Grid }>();
  for (const puzzle of corpus) {
    if (found.size >= TECHNIQUES.length) break;
    let game: GameState = createGame(puzzle);
    for (let step = 0; step < 81; step++) {
      const grid = toPlayerGrid(game);
      const hint = new Solver().getNextHint(grid);
      if (hint === null) break;
      if (!found.has(hint.technique)) found.set(hint.technique, { hint, grid });
      if (hint.type === 'direct') {
        game = applyHintAsMove(game, hint);
      } else {
        for (const { cell, digit } of hint.eliminations) {
          game = applyMove(game, { kind: 'addNote', cell, digit, note: 'excluded' });
        }
      }
    }
  }
  return found;
}

const TECHNIQUES = [
  'HiddenSingle',
  'NakedSingle',
  'DirectPointing',
  'DirectHiddenPair',
  'DirectHiddenTriplet',
  'Pointing',
  'Claiming',
  'NakedPair',
  'NakedTriplet',
  'XWing',
  'Swordfish',
  'HiddenPair',
  'HiddenTriplet',
  'XYWing',
  'XYZWing',
] as const;

const HINTS = hintsByTechnique();

describe('presentHint', () => {
  it('finds a hint for every technique it presents', () => {
    expect(TECHNIQUES.filter((t) => !HINTS.has(t))).toEqual([]);
  });

  describe.each(TECHNIQUES)('%s', (technique) => {
    const entry = HINTS.get(technique);
    if (entry === undefined) return;
    const { hint, grid } = entry;
    const { decorations, sentence } = presentHint(hint, grid);
    const prose = sentence.map((s) => s.text).join('');

    it('tells the reasoning in words, with references instead of coordinates', () => {
      expect(sentence.some((s) => s.kind === 'ref')).toBe(true);
      expect(prose).not.toMatch(/R\dC\d/);
    });

    it('decorates every group the sentence refers to', () => {
      for (const segment of sentence) {
        if (segment.kind !== 'ref') continue;
        expect(decorations.some((d) => d.role === segment.role)).toBe(true);
      }
    });

    it('marks exactly what the hint concludes', () => {
      const notes = (role: string): string[] =>
        decorations
          .filter((d) => d.role === role && d.target.kind === 'note')
          .map((d) => (d.target.kind === 'note' ? `${d.target.cell}.${d.target.digit}` : ''))
          .sort();
      if (hint.type === 'direct') {
        expect(notes('primary')).toEqual([`${hint.cell}.${hint.digit}`]);
      } else {
        expect(notes('eliminated')).toEqual(
          hint.eliminations.map((e) => `${e.cell}.${e.digit}`).sort(),
        );
      }
    });

    it('marks the pattern the conclusion rests on', () => {
      const marked = new Set(
        decorations
          .filter(
            (d) => (d.role === 'supporting' || d.role === 'pivot') && d.target.kind === 'note',
          )
          .map((d) => (d.target.kind === 'note' ? `${d.target.cell}.${d.target.digit}` : '')),
      );
      for (const [cell, digits] of hint.involvedCandidates) {
        if (hint.type === 'direct' && cell === hint.cell) continue;
        for (const digit of digits) expect(marked.has(`${cell}.${digit}`)).toBe(true);
      }
    });
  });

  it('falls back to the engine sentence when a pattern cannot be read', () => {
    const entry = HINTS.get('NakedPair');
    if (entry === undefined) throw new Error('fixture');
    const { hint, grid } = entry;
    // Same hint, but its pattern cells no longer share a house.
    const broken: Hint = {
      ...hint,
      involvedCandidates: new Map([
        [0, [1]],
        [80, [2]],
      ]),
    };
    const { sentence } = presentHint(broken, grid);
    expect(sentence).toEqual([{ kind: 'text', text: hint.explanation }]);
  });
});
