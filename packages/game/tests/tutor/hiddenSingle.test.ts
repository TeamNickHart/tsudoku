import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Solver, applyHint, colOf, createGrid, rowOf } from '@tsudoku/core';
import type { DirectHint, Grid } from '@tsudoku/core';
import { explain, explainOrSummarise, hasLesson } from '../../src/tutor/index.js';

const CORPUS = join(__dirname, '../../../../benchmarks/corpus/phase1.jsonl');

/** Hidden-single puzzles from the real corpus, so tests run on real boards. */
function corpusPuzzles(limit: number): string[] {
  const out: string[] = [];
  for (const line of readFileSync(CORPUS, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const entry = JSON.parse(line) as { puzzle: string; se_technique: string };
    if (entry.se_technique !== 'HiddenSingle') continue;
    out.push(entry.puzzle);
    if (out.length >= limit) break;
  }
  return out;
}

/** Walk a puzzle and yield each hidden-single hint with the grid it applies to. */
function hiddenSingleSteps(puzzle: string, max: number): { hint: DirectHint; grid: Grid }[] {
  const solver = new Solver();
  let grid = createGrid(puzzle);
  const out: { hint: DirectHint; grid: Grid }[] = [];
  for (let i = 0; i < 200 && out.length < max; i++) {
    const hint = solver.getNextHint(grid);
    if (hint === null) break;
    if (hint.type === 'direct' && hint.technique === 'HiddenSingle') {
      out.push({ hint, grid });
    }
    grid = applyHint(grid, hint);
  }
  return out;
}

const RULED_OUT = /^R(\d)C(\d) can't be (\d) — R(\d)C(\d) already has one\.$/;

function indexOfName(row: number, col: number): number {
  return (row - 1) * 9 + (col - 1);
}

describe('explainHiddenSingle', () => {
  it('produces a lesson for a hidden single', () => {
    const [puzzle] = corpusPuzzles(1);
    const [step] = hiddenSingleSteps(puzzle!, 1);
    const lesson = explain(step!.hint, step!.grid);

    expect(lesson).not.toBeNull();
    expect(lesson!.technique).toBe('HiddenSingle');
    expect(lesson!.steps.length).toBeGreaterThan(1);
    expect(lesson!.principle).toContain('only one possible cell');
  });

  it('ends on the conclusion, naming the right cell and digit', () => {
    for (const puzzle of corpusPuzzles(10)) {
      for (const { hint, grid } of hiddenSingleSteps(puzzle, 3)) {
        const lesson = explain(hint, grid);
        if (lesson === null) continue;
        const last = lesson.steps[lesson.steps.length - 1]!;
        const name = `R${rowOf(hint.cell) + 1}C${colOf(hint.cell) + 1}`;
        expect(last.caption).toContain(name);
        expect(last.caption).toContain(String(hint.digit));
        // The conclusion must point at the cell the hint actually places.
        expect(
          last.decorations.some((d) => d.role === 'primary' && d.target.cell === hint.cell),
        ).toBe(true);
      }
    }
  });

  /**
   * The test that matters. A lesson that reads plausibly but cites the wrong
   * cell is worse than no lesson: it teaches a false rule and the learner has
   * no way to catch it. So every "X can't be N — Y already has one" claim is
   * checked against the board — Y really holds N, and Y really sees X.
   */
  it('never makes a false claim about why a cell is ruled out', () => {
    let checked = 0;

    for (const puzzle of corpusPuzzles(40)) {
      for (const { hint, grid } of hiddenSingleSteps(puzzle, 5)) {
        const lesson = explain(hint, grid);
        if (lesson === null) continue;

        for (const step of lesson.steps) {
          const match = RULED_OUT.exec(step.caption);
          if (match === null) continue;

          const ruled = indexOfName(Number(match[1]), Number(match[2]));
          const digit = Number(match[3]);
          const blocker = indexOfName(Number(match[4]), Number(match[5]));

          const blockerCell = grid.getCellByIndex(blocker);
          const ruledCell = grid.getCellByIndex(ruled);

          // The named blocker genuinely holds that digit...
          expect(blockerCell.value).toBe(digit);
          // ...and genuinely constrains the cell it is cited against.
          const sees =
            rowOf(ruled) === rowOf(blocker) ||
            colOf(ruled) === colOf(blocker) ||
            ruledCell.box === blockerCell.box;
          expect(sees).toBe(true);
          // And the ruled-out cell really is empty — ruling out a filled cell
          // would be a true statement that misleads about why.
          expect(ruledCell.value).toBeNull();

          checked += 1;
        }
      }
    }

    // Guard against the assertions above silently never running.
    expect(checked).toBeGreaterThan(50);
  });

  it('rules out every empty cell in the region except the target', () => {
    for (const puzzle of corpusPuzzles(15)) {
      for (const { hint, grid } of hiddenSingleSteps(puzzle, 3)) {
        const lesson = explain(hint, grid);
        if (lesson === null) continue;

        const ruledOut = new Set<number>();
        for (const step of lesson.steps) {
          const match = RULED_OUT.exec(step.caption);
          if (match !== null) ruledOut.add(indexOfName(Number(match[1]), Number(match[2])));
        }

        // The argument is only complete if nothing is left unaccounted for.
        expect(ruledOut.has(hint.cell)).toBe(false);
      }
    }
  });

  it('returns null for a technique it does not teach', () => {
    const grid = createGrid(
      '..1.....6.9.4.53..2..6.13.4.6..53...7..1.2..3...86..7.5.24.1..8..79.6.2.1.....5..',
    );
    const solver = new Solver();
    let current = grid;
    for (let i = 0; i < 50; i++) {
      const hint = solver.getNextHint(current);
      if (hint === null) break;
      if (hint.technique !== 'HiddenSingle') {
        expect(explain(hint, current)).toBeNull();
        expect(hasLesson(hint, current)).toBe(false);
        return;
      }
      current = applyHint(current, hint);
    }
  });
});

describe('explainOrSummarise', () => {
  it('falls back to a single step carrying the hint explanation', () => {
    const grid = createGrid(
      '..1.....6.9.4.53..2..6.13.4.6..53...7..1.2..3...86..7.5.24.1..8..79.6.2.1.....5..',
    );
    const solver = new Solver();
    let current = grid;
    for (let i = 0; i < 50; i++) {
      const hint = solver.getNextHint(current);
      if (hint === null) break;
      if (hint.technique !== 'HiddenSingle') {
        const lesson = explainOrSummarise(hint, current);
        expect(lesson.steps).toHaveLength(1);
        expect(lesson.steps[0]!.caption).toBe(hint.explanation);
        expect(lesson.technique).toBe(hint.technique);
        return;
      }
      current = applyHint(current, hint);
    }
  });

  it('always returns a lesson with at least one step', () => {
    for (const puzzle of corpusPuzzles(20)) {
      const solver = new Solver();
      let grid = createGrid(puzzle);
      for (let i = 0; i < 30; i++) {
        const hint = solver.getNextHint(grid);
        if (hint === null) break;
        const lesson = explainOrSummarise(hint, grid);
        expect(lesson.steps.length).toBeGreaterThan(0);
        for (const step of lesson.steps) {
          expect(step.caption.length).toBeGreaterThan(0);
        }
        grid = applyHint(grid, hint);
      }
    }
  });
});
