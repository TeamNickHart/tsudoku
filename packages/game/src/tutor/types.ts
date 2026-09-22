import type { Decoration } from '../types.js';

/**
 * The tutor layer: turning a hint's *conclusion* into its *reasoning*.
 *
 * The engine already answers "what should I do next" — a hint carries a
 * technique, a conclusion and the cells involved. What it does not carry is
 * **why**. Its explanation is a single sentence ("9 can only go in R1C7 in box
 * 3"), which states the finding rather than the argument that reaches it.
 *
 * That gap is the whole point of this project. An app that names a technique
 * and places its digit is a solver with a nice UI; an app that walks you
 * through the argument is a teacher. So a lesson is an ordered list of steps,
 * each with decorations and a caption, derived from the live board.
 *
 * Derived, not authored: an explainer takes the actual hint and the actual
 * grid, so a lesson works on whatever puzzle the player is stuck on rather
 * than only on curated examples. Deterministic throughout — no AI at runtime.
 */

/**
 * One step of an explanation.
 *
 * Steps are cumulative in intent but independent in data: each carries the
 * complete set of decorations for its own moment, so the UI renders a step by
 * replacing what it is showing rather than diffing against the previous one.
 * That keeps stepping backwards as cheap as stepping forwards.
 */
export interface LessonStep {
  /** One sentence, addressed to the learner. */
  readonly caption: string;
  /** Everything the board should show at this moment. */
  readonly decorations: readonly Decoration[];
}

/** An explanation of one hint, as an ordered walk-through. */
export interface Lesson {
  /** The technique being taught, for titling and progress tracking. */
  readonly technique: string;
  /**
   * A one-line statement of the idea, independent of this board.
   *
   * This is the sentence worth remembering after the specific puzzle is
   * forgotten — the transferable part.
   */
  readonly principle: string;
  /** The walk-through, in order. Never empty. */
  readonly steps: readonly LessonStep[];
}
