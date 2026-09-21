/**
 * Merge harvested puzzles into a phase corpus file.
 *
 * Deduplicates against what is already there, fills in any missing
 * se_technique from the SE rating, and reports the resulting distribution.
 *
 * Usage:
 *   node tools/se-reference/merge-corpus.mjs <harvested.jsonl> <phaseN.jsonl>
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

/** SE rating -> the technique that rating denotes. Mirrors lib.sh. */
const RATING_TO_TECHNIQUE = {
  1.0: 'NakedSingle',
  1.2: 'HiddenSingle',
  1.5: 'HiddenSingle',
  1.7: 'DirectPointing',
  1.9: 'DirectClaiming',
  2.0: 'DirectHiddenPair',
  2.3: 'NakedSingle',
  2.5: 'DirectHiddenTriplet',
  2.6: 'Pointing',
  2.8: 'Claiming',
  3.0: 'NakedPair',
  3.2: 'XWing',
  3.4: 'HiddenPair',
  3.6: 'NakedTriplet',
  3.8: 'Swordfish',
  4.0: 'HiddenTriplet',
  4.2: 'XYWing',
  4.4: 'XYZWing',
};

const [, , sourcePath, targetPath] = process.argv;
if (!sourcePath || !targetPath) {
  console.error('usage: merge-corpus.mjs <harvested.jsonl> <phaseN.jsonl>');
  process.exit(1);
}

const parse = (path) =>
  existsSync(path)
    ? readFileSync(path, 'utf8')
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((l) => JSON.parse(l))
    : [];

const existing = parse(targetPath);
const incoming = parse(sourcePath);

const seen = new Set(existing.map((e) => e.puzzle));
const merged = [...existing];
let added = 0;
let duplicates = 0;

for (const entry of incoming) {
  if (seen.has(entry.puzzle)) {
    duplicates += 1;
    continue;
  }
  seen.add(entry.puzzle);
  merged.push({
    puzzle: entry.puzzle,
    se_rating: entry.se_rating,
    se_technique: entry.se_technique || RATING_TO_TECHNIQUE[entry.se_rating] || 'Unknown',
  });
  added += 1;
}

// Sort by rating so the file reads as a difficulty ramp and diffs stay legible.
merged.sort((a, b) => a.se_rating - b.se_rating || a.puzzle.localeCompare(b.puzzle));

writeFileSync(targetPath, merged.map((e) => JSON.stringify(e)).join('\n') + '\n');

console.log(
  `${targetPath}: ${existing.length} -> ${merged.length} (+${added}, ${duplicates} dupes)`,
);
const counts = new Map();
for (const e of merged) {
  const key = `${e.se_rating.toFixed(1)} ${e.se_technique}`;
  counts.set(key, (counts.get(key) ?? 0) + 1);
}
for (const [key, n] of [...counts].sort()) {
  console.log(`  ${key.padEnd(26)} ${n}`);
}
