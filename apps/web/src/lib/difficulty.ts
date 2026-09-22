import { PUZZLES } from '@/data/corpus';
import type { CorpusPuzzle } from '@/data/corpus';

/**
 * Difficulty bands for puzzle selection.
 *
 * Grouped by the hardest technique a puzzle needs, not by SE rating, because
 * SE's numbers measure solver search cost rather than how hard a person finds
 * something. The clearest case: SE rates Swordfish 3.8 and XY-Wing 4.2, but a
 * Swordfish spans three rows and three columns and has to be held in the head
 * at once, while an XY-Wing is three cells with a local story. Most players
 * find the XY-Wing easier. See STATUS.md 2.4a.
 *
 * So the bands below follow what a technique demands of a person, and a band
 * is named for what you will be practising rather than for a number.
 */

export interface DifficultyBand {
  readonly id: string;
  readonly label: string;
  /** What this band asks of the player. */
  readonly blurb: string;
  /** Techniques whose puzzles belong to this band. */
  readonly techniques: readonly string[];
}

export const DIFFICULTY_BANDS: readonly DifficultyBand[] = [
  {
    id: 'gentle',
    label: 'Gentle',
    blurb: 'Scanning for digits that have only one place left.',
    techniques: ['HiddenSingle', 'NakedSingle'],
  },
  {
    id: 'locked',
    label: 'Locked candidates',
    blurb: 'A digit confined to one line inside a box, or one box inside a line.',
    techniques: ['DirectPointing', 'Pointing', 'Claiming'],
  },
  {
    id: 'sets',
    label: 'Pairs & triples',
    blurb: 'Cells that between them hold a fixed set of digits.',
    techniques: [
      'DirectHiddenPair',
      'DirectHiddenTriplet',
      'NakedPair',
      'HiddenPair',
      'NakedTriplet',
      'HiddenTriplet',
    ],
  },
  {
    id: 'wings',
    label: 'Wings',
    blurb: 'Three cells whose candidates chain together to rule something out.',
    techniques: ['XYWing', 'XYZWing'],
  },
  {
    id: 'fish',
    label: 'Fish',
    blurb: 'A digit boxed into a grid of rows and columns. X-Wing, then Swordfish.',
    techniques: ['XWing', 'Swordfish'],
  },
];

/** Puzzles belonging to a band, in corpus order. */
export function puzzlesInBand(bandId: string): readonly CorpusPuzzle[] {
  const band = DIFFICULTY_BANDS.find((b) => b.id === bandId);
  if (band === undefined) return PUZZLES;
  return PUZZLES.filter((p) => band.techniques.includes(p.technique));
}

/**
 * A random puzzle from a band, avoiding `exclude` when possible.
 *
 * Excluding the current puzzle matters more than it sounds: without it, "new
 * puzzle" lands on the same board often enough to look broken, since a band can
 * hold as few as a dozen.
 */
export function randomPuzzleInBand(bandId: string, exclude?: string): CorpusPuzzle {
  const pool = puzzlesInBand(bandId);
  // Should not happen — every band maps to techniques present in the corpus —
  // but returning something valid beats throwing inside a click handler.
  if (pool.length === 0) return PUZZLES[0]!;

  const choices = pool.length > 1 ? pool.filter((p) => p.puzzle !== exclude) : pool;
  const picked = choices[Math.floor(Math.random() * choices.length)];
  return picked ?? pool[0]!;
}

/** The band a puzzle belongs to, or null if none claims it. */
export function bandForPuzzle(puzzle: CorpusPuzzle): DifficultyBand | null {
  return DIFFICULTY_BANDS.find((b) => b.techniques.includes(puzzle.technique)) ?? null;
}
