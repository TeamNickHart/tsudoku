import type { Grid, Hint } from '@tsudoku/core';
import { hintDecorations } from '../hints.js';
import { explainHiddenSingle } from './hiddenSingle.js';
import type { Lesson } from './types.js';

export type { Lesson, LessonStep } from './types.js';
export { explainHiddenSingle } from './hiddenSingle.js';

/**
 * Explain a hint as a walk-through, if this technique has an explainer.
 *
 * Techniques get explainers one at a time, so most return null today. Callers
 * should treat null as "show the plain hint" rather than an error — see
 * `explainOrSummarise`, which does exactly that.
 */
export function explain(hint: Hint, grid: Grid): Lesson | null {
  if (hint.type === 'direct' && hint.technique === 'HiddenSingle') {
    return explainHiddenSingle(hint, grid);
  }
  return null;
}

/**
 * Explain a hint, falling back to a single step carrying the hint's own
 * explanation.
 *
 * The fallback matters more than it looks. Without it the UI needs two code
 * paths — "lesson" and "plain hint" — and every technique added later has to
 * be wired into both. With it there is one path: a lesson always exists, it is
 * just shorter when nothing has taught that technique yet. The UI renders
 * steps and never asks which kind it got.
 *
 * The one-step fallback is honest rather than padded: it states the conclusion
 * and shows the same decorations the hint already produced, which is exactly
 * what the app did before the tutor existed.
 */
export function explainOrSummarise(hint: Hint, grid: Grid): Lesson {
  const lesson = explain(hint, grid);
  if (lesson !== null) return lesson;

  return {
    technique: hint.technique,
    principle: hint.explanation,
    steps: [
      {
        caption: hint.explanation,
        decorations: hintDecorations(hint),
      },
    ],
  };
}

/** True when this hint has a real walk-through rather than the fallback. */
export function hasLesson(hint: Hint, grid: Grid): boolean {
  return explain(hint, grid) !== null;
}
