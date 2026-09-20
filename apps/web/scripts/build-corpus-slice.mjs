/**
 * Build a small, technique-balanced slice of the benchmark corpus for the app.
 *
 * The full corpus is 607 puzzles; the app does not need them all, and shipping
 * a JSONL file would mean runtime fetching and a loading state. This emits a TS
 * module instead: no fetch, no loading, works offline.
 *
 * Run: node apps/web/scripts/build-corpus-slice.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..', '..');
const PER_TECHNIQUE = 6;

const lines = readFileSync(join(root, 'benchmarks/corpus/phase1.jsonl'), 'utf8').trim().split('\n');

const byTechnique = new Map();
for (const line of lines) {
  const entry = JSON.parse(line);
  const list = byTechnique.get(entry.se_technique) ?? [];
  if (list.length < PER_TECHNIQUE) {
    list.push(entry);
    byTechnique.set(entry.se_technique, list);
  }
}

const selected = [...byTechnique.entries()]
  .sort(([, a], [, b]) => a[0].se_rating - b[0].se_rating)
  .flatMap(([, entries]) => entries);

const body = selected
  .map(
    (e) => `  { puzzle: '${e.puzzle}', rating: ${e.se_rating}, technique: '${e.se_technique}' },`,
  )
  .join('\n');

const out = `// GENERATED — do not edit by hand.
// Regenerate: node apps/web/scripts/build-corpus-slice.mjs
//
// A technique-balanced slice of benchmarks/corpus/phase1.jsonl. Every puzzle
// here is SE-verified, so the rating and hardest-technique labels are ground
// truth, not estimates.

export interface CorpusPuzzle {
  /** 81 chars, digits and '0' for blanks. */
  readonly puzzle: string;
  /** SudokuExplainer difficulty rating. */
  readonly rating: number;
  /** The hardest technique SE needed to solve it. */
  readonly technique: string;
}

export const PUZZLES: readonly CorpusPuzzle[] = [
${body}
];

/** Puzzles grouped by the technique they teach, easiest first. */
export const BY_TECHNIQUE: ReadonlyMap<string, readonly CorpusPuzzle[]> = new Map(
  PUZZLES.reduce<[string, CorpusPuzzle[]][]>((acc, p) => {
    const found = acc.find(([t]) => t === p.technique);
    if (found) found[1].push(p);
    else acc.push([p.technique, [p]]);
    return acc;
  }, []),
);
`;

writeFileSync(join(here, '..', 'src', 'data', 'corpus.ts'), out);
console.log(`Wrote ${selected.length} puzzles across ${byTechnique.size} techniques.`);
for (const [technique, entries] of byTechnique) {
  console.log(`  ${technique.padEnd(22)} ${entries.length}`);
}
