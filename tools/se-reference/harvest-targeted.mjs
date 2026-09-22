/**
 * Harvest puzzles for specific SE ratings, using TSudoku itself as a filter.
 *
 * Blind generation is hopeless for the rare ratings: measured hit rates put
 * XWing (3.2), Swordfish (3.8) and HiddenTriplet (4.0) at about 0.12% each,
 * roughly 22 hours per 1000 puzzles. Nearly all of that time is spent paying
 * for SE ratings on puzzles that were never going to qualify.
 *
 * The fix is that TSudoku can now rate these puzzles itself. Solving locally
 * takes ~0.1s against ~40ms of SE round trip *plus* the generation cost, and —
 * verified over 60 puzzles — the local rating agreed with SE on all 47 it
 * could solve, with zero disagreements. So:
 *
 *   1. generate
 *   2. solve locally, take the hardest technique used
 *   3. discard unless that rating is still wanted
 *   4. only then confirm with the real SE CLI
 *
 * SE remains the oracle. The local solve only decides what is worth asking
 * about.
 *
 * Usage:
 *   node tools/se-reference/harvest-targeted.mjs [--progress[=N]] <quota> <rating...>
 *
 *   --progress[=N]  report every N generated puzzles (default 500). Without
 *                   it the only mid-run output is a carriage-return counter,
 *                   which disappears entirely when stdout is a file — so a
 *                   redirected run looks stalled between confirmations.
 *
 * Example — fill the thin Phase 2 ratings to 20 each:
 *   node tools/se-reference/harvest-targeted.mjs 20 3.0 3.2 3.4 3.6 3.8 4.0 4.4
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// Imported by path rather than by package name: workspace links only resolve
// from inside a package directory, and this runs from the repo root.
import { CorpusLock } from './lock.mjs';
import { createGrid, applyHint, Solver } from '../../packages/core/dist/index.js';
import { generate, NO_SYMMETRY, ROTATIONAL_180 } from '../../packages/generator/dist/index.js';

const rawArgs = process.argv.slice(2);

// --progress / --progress=N
let progressEvery = 0;
const args = rawArgs.filter((arg) => {
  if (arg === '--progress') {
    progressEvery = 500;
    return false;
  }
  if (arg.startsWith('--progress=')) {
    progressEvery = Number(arg.split('=')[1]) || 500;
    return false;
  }
  return true;
});

const [quotaArg, ...ratingArgs] = args;
const quota = Number(quotaArg);
const wanted = new Set(ratingArgs.map(Number));

if (!quota || wanted.size === 0) {
  console.error('usage: harvest-targeted.mjs <quota> <rating...>');
  process.exit(1);
}

// Only one harvester may write the corpus. Each run holds the whole file in
// memory and rewrites it on every flush, so two concurrent runs do not
// interleave — the second to flush discards the first's work entirely.
const lock = new CorpusLock('corpus');
try {
  lock.acquire();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
lock.releaseOnExit();

const CORPUS = 'benchmarks/corpus/phase2.jsonl';

/** The corpus as it is on disk right now. */
function readCorpus() {
  if (!existsSync(CORPUS)) return [];
  return readFileSync(CORPUS, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

const existing = readCorpus();

const have = new Map();
const seen = new Set(existing.map((e) => e.puzzle));
for (const entry of existing) {
  have.set(entry.se_rating, (have.get(entry.se_rating) ?? 0) + 1);
}

const RATING_TO_TECHNIQUE = {
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

let seed = Date.now() % 1e6;
const rng = () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/** The hardest technique rating TSudoku needs, or null if it cannot finish. */
function localRating(puzzle) {
  const solver = new Solver();
  let grid = createGrid(puzzle);
  let hardest = 0;
  for (let step = 0; step < 300; step++) {
    const hint = solver.getNextHint(grid);
    if (hint === null) break;
    if (hint.difficulty > hardest) hardest = hint.difficulty;
    grid = applyHint(grid, hint);
  }
  return grid.cells.every((c) => c.value !== null) ? Math.round(hardest * 10) / 10 : null;
}

/** Rewrite the corpus with everything confirmed so far, sorted by rating. */
function flush() {
  // Re-read rather than merging into the startup snapshot.
  //
  // `existing` is a photograph of the corpus taken when this run began. If
  // anything else has written since — a git pull, a merge, an earlier run
  // whose work was committed — merging into that stale copy silently reverts
  // it. That is how XWing went from 24 puzzles back to 22 between runs: the
  // second harvester started first, finished later, and rewrote the file with
  // a view of the world from before the first one's commit.
  //
  // The lock stops two harvesters overlapping. This stops a single harvester
  // undoing work that landed by any other route.
  const onDisk = readCorpus();
  const byPuzzle = new Map();
  for (const entry of [...onDisk, ...added]) {
    byPuzzle.set(entry.puzzle, entry);
  }

  const merged = [...byPuzzle.values()].sort(
    (a, b) => a.se_rating - b.se_rating || a.puzzle.localeCompare(b.puzzle),
  );
  writeFileSync(CORPUS, merged.map((e) => JSON.stringify(e)).join('\n') + '\n');
}

// Persist whatever has been confirmed if the run is interrupted.
//
// This releases the lock itself rather than relying on lock.releaseOnExit():
// handlers run in registration order and this one calls process.exit, so the
// lock's own handler would never be reached. Registering first and exiting is
// exactly how a lock gets left behind.
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    flush();
    lock.release();
    console.error(`\nInterrupted. ${added.length} puzzles kept.`);
    process.exit(0);
  });
}

const work = mkdtempSync(join(tmpdir(), 'tsudoku-'));
const symmetries = [ROTATIONAL_180, NO_SYMMETRY];

const remaining = () => [...wanted].filter((r) => (have.get(r) ?? 0) < quota);

console.error(`Targeting ${[...wanted].sort().join(', ')} to ${quota} each.`);
for (const r of [...wanted].sort()) {
  console.error(`  ${r}  ${have.get(r) ?? 0}/${quota}  ${RATING_TO_TECHNIQUE[r] ?? '?'}`);
}

let generated = 0;
let confirmed = 0;
let localHits = 0;
let lastProgressAt = 0;
const startedAt = Date.now();
const added = [];

while (remaining().length > 0 && generated < 200000) {
  const candidates = [];
  for (let i = 0; i < 200; i++) {
    const p = generate({ symmetry: symmetries[i % 2], rng });
    generated += 1;
    if (seen.has(p.puzzle)) continue;

    const rating = localRating(p.puzzle);
    if (rating === null || !wanted.has(rating)) continue;
    if ((have.get(rating) ?? 0) >= quota) continue;
    candidates.push(p.puzzle);
    localHits += 1;
  }

  // A line-oriented heartbeat, so a redirected run shows it is alive and how
  // far it has to go. The \r counter below is for an attached terminal.
  if (progressEvery > 0 && generated - lastProgressAt >= progressEvery) {
    lastProgressAt = generated;
    const outstanding = remaining()
      .map((r) => `${r}:${have.get(r) ?? 0}/${quota}`)
      .join(' ');
    const rate = Math.round(generated / ((Date.now() - startedAt) / 1000));
    console.error(
      `  [${new Date().toTimeString().slice(0, 8)}] ${generated} generated, ` +
        `${confirmed} confirmed, ${rate}/s — still wanted: ${outstanding}`,
    );
  }

  if (candidates.length === 0) {
    if (progressEvery === 0) {
      process.stderr.write(`  ${generated} generated, ${confirmed} confirmed\r`);
    }
    continue;
  }

  // Confirm with the real oracle. SE is authoritative; the local solve only
  // decided these were worth asking about.
  const batchFile = join(work, 'batch.txt');
  writeFileSync(batchFile, candidates.join('\n') + '\n');
  let rated;
  try {
    rated = execFileSync('bash', ['tools/se-reference/rate.sh', batchFile], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    continue;
  }

  for (const line of rated.trim().split('\n')) {
    const [puzzle, ed] = line.split(' ');
    if (!ed) continue;
    const rating = Number(ed.replace('ED=', '').split('/')[0]);
    if (!wanted.has(rating)) continue;
    if ((have.get(rating) ?? 0) >= quota) continue;
    if (seen.has(puzzle)) continue;

    seen.add(puzzle);
    have.set(rating, (have.get(rating) ?? 0) + 1);
    added.push({
      puzzle,
      se_rating: rating,
      se_technique: RATING_TO_TECHNIQUE[rating] ?? 'Unknown',
    });
    confirmed += 1;
    // Persist as we go. Writing only at the end means an interrupted run
    // discards everything it found, which is the wrong property for a job
    // meant to run overnight — and it cost 82 puzzles once already.
    flush();
    console.error(
      `  + ${rating} ${(RATING_TO_TECHNIQUE[rating] ?? '').padEnd(14)} ` +
        `${have.get(rating)}/${quota}  (${generated} generated)`,
    );
  }
}

flush();

console.error(
  `\nDone. ${generated} generated, ${localHits} passed the local filter, ` +
    `${confirmed} confirmed by SE. ${CORPUS}: ${existing.length} -> ${readCorpus().length}.`,
);
