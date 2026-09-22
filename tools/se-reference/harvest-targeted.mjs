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
 * Ratings from both Phase 1 (1.0-2.5) and Phase 2 (2.6-4.4) can be harvested in
 * one run. Each confirmed puzzle is written to the corpus file its rating
 * belongs to — `phase1.jsonl` or `phase2.jsonl` — so a mixed run updates both.
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
 *
 * Example — the two Phase 1 holes, which have never had any puzzles:
 *   node tools/se-reference/harvest-targeted.mjs 100 1.0 1.9
 *
 * Be warned that 1.0 and 1.9 are *rare*: neither appeared once in 800 generated
 * puzzles. Expect them to take far longer than their low ratings suggest.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdtempSync, unlinkSync } from 'node:fs';
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
  console.error('usage: harvest-targeted.mjs [--progress[=N]] <quota> <rating...>');
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

/**
 * Every rating this harvester can chase, with the technique name the benchmark
 * keys on and the corpus file it belongs in.
 *
 * The technique names must match `TECHNIQUE_DIFFICULTY` in
 * packages/core/src/types/Technique.ts exactly. The runner filters the corpus
 * to `IMPLEMENTED_TECHNIQUES`, which is that map's keys — so a typo here does
 * not fail loudly, it makes the entry invisible and the technique silently
 * unvalidated. That is the same failure mode that let DirectClaiming ship
 * unvalidated in the first place.
 *
 * Note 1.0, 1.2 and 1.5 are all `HiddenSingle`. SE rates the same technique
 * differently by context — 1.0 when the cell is the last empty one in a region
 * ("full house"), 1.2 within a box, 1.5 along a line — and the existing corpus
 * already follows that convention.
 */
const RATINGS = {
  1.0: { technique: 'HiddenSingle', phase: 1 },
  1.2: { technique: 'HiddenSingle', phase: 1 },
  1.5: { technique: 'HiddenSingle', phase: 1 },
  1.7: { technique: 'DirectPointing', phase: 1 },
  1.9: { technique: 'DirectClaiming', phase: 1 },
  2.0: { technique: 'DirectHiddenPair', phase: 1 },
  2.3: { technique: 'NakedSingle', phase: 1 },
  2.5: { technique: 'DirectHiddenTriplet', phase: 1 },
  2.6: { technique: 'Pointing', phase: 2 },
  2.8: { technique: 'Claiming', phase: 2 },
  3.0: { technique: 'NakedPair', phase: 2 },
  3.2: { technique: 'XWing', phase: 2 },
  3.4: { technique: 'HiddenPair', phase: 2 },
  3.6: { technique: 'NakedTriplet', phase: 2 },
  3.8: { technique: 'Swordfish', phase: 2 },
  4.0: { technique: 'HiddenTriplet', phase: 2 },
  4.2: { technique: 'XYWing', phase: 2 },
  4.4: { technique: 'XYZWing', phase: 2 },
};

/**
 * Ratings for display, always with one decimal.
 *
 * JS normalises numeric literals and object keys, so 1.0 prints as "1" and 4.0
 * as "4" — which in a log of SE ratings reads as a different scale entirely.
 * Only presentation is affected; lookups resolve through the same
 * normalisation on both sides.
 */
const fmtRating = (r) => Number(r).toFixed(1);

// Reject unknown ratings up front rather than crashing on the first hit, or —
// worse — banking entries with a bogus technique name that the benchmark would
// silently skip.
const unknown = [...wanted].filter((r) => !(r in RATINGS));
if (unknown.length > 0) {
  console.error(`unknown rating(s): ${unknown.join(', ')}`);
  console.error(`known: ${Object.keys(RATINGS).map(fmtRating).join(' ')}`);
  process.exit(1);
}

const corpusPath = (phase) => `benchmarks/corpus/phase${phase}.jsonl`;

/** Which corpus files this run touches, derived from the requested ratings. */
const phases = [...new Set([...wanted].map((r) => RATINGS[r]?.phase).filter(Boolean))];

/** One corpus file as it is on disk right now. */
function readCorpusFile(phase) {
  const path = corpusPath(phase);
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

/**
 * Dedupe across BOTH corpus files, not just the ones being written.
 *
 * A puzzle's rating decides its file, so a puzzle already banked in phase1
 * must not be re-added to phase2 (or vice versa) if a later run rates it
 * differently. Reading every phase for the `seen` set costs one file read and
 * removes a whole class of duplicate.
 */
const allExisting = [1, 2].flatMap((phase) => readCorpusFile(phase));
const seen = new Set(allExisting.map((e) => e.puzzle));

const have = new Map();
for (const entry of allExisting) {
  have.set(entry.se_rating, (have.get(entry.se_rating) ?? 0) + 1);
}

const startCounts = new Map(phases.map((phase) => [phase, readCorpusFile(phase).length]));

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

/** Rewrite each touched corpus file with everything confirmed so far. */
function flush() {
  // Re-read rather than merging into a startup snapshot.
  //
  // A snapshot taken when the run began goes stale the moment anything else
  // writes — a git pull, a merge, an earlier run whose work was committed —
  // and merging into it silently reverts that work. That is how XWing went
  // from 24 puzzles back to 22 between runs: the second harvester started
  // first, finished later, and rewrote the file with a view of the world from
  // before the first one's commit.
  //
  // The lock stops two harvesters overlapping. This stops a single harvester
  // undoing work that landed by any other route.
  for (const phase of phases) {
    const mine = added.filter((e) => RATINGS[e.se_rating].phase === phase);
    // Nothing new for this phase yet: leave the file untouched rather than
    // rewriting it identically.
    if (mine.length === 0) continue;

    const byPuzzle = new Map();
    for (const entry of [...readCorpusFile(phase), ...mine]) {
      byPuzzle.set(entry.puzzle, entry);
    }

    const merged = [...byPuzzle.values()].sort(
      (a, b) => a.se_rating - b.se_rating || a.puzzle.localeCompare(b.puzzle),
    );
    writeFileSync(corpusPath(phase), merged.map((e) => JSON.stringify(e)).join('\n') + '\n');
  }
}

// Stopping a run cleanly.
//
// Signals DO NOT WORK here, and it is worth being explicit about why. The
// harvest loop is entirely synchronous — generate, solve and rate all block —
// so Node never returns to the event loop, and a JS signal handler is only
// ever invoked from the event loop. A `process.on('SIGTERM', ...)` registered
// here is therefore never called while the loop is running. Verified with a
// minimal repro: a SIGTERM to a process in a tight synchronous loop does not
// reach the handler at all, and the process runs to completion. Only SIGKILL
// stops it, and SIGKILL cannot be trapped, so the run gets no chance to
// release its lock.
//
// So the stop signal is a FILE. The loop checks for it between batches, which
// bounds the delay to one batch (200 puzzles, a few seconds) and needs no
// cooperation from the event loop:
//
//   touch .harvest-stop
//
// The signal handlers below are kept as a best-effort fallback for the moments
// the process IS at the event loop (start-up, and the SE subprocess call).
const STOP_FILE = '.harvest-stop';

// A stale sentinel from a previous run would stop this one immediately.
if (existsSync(STOP_FILE)) unlinkSync(STOP_FILE);

/** Flush, release the lock and exit. Shared by every stop path. */
function shutdown(reason) {
  flush();
  lock.release();
  // Deliberately NOT removing STOP_FILE. The overnight wrapper polls the same
  // file to decide whether to start another pass; if this process deleted it,
  // the wrapper would see it gone and immediately launch a new worker —
  // observed, and it makes the run unstoppable. Whoever created the sentinel
  // removes it.
  console.error(`\n${reason} ${added.length} puzzles kept.`);
  process.exit(0);
}

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => shutdown(`Interrupted by ${signal}.`));
}

const work = mkdtempSync(join(tmpdir(), 'tsudoku-'));
const symmetries = [ROTATIONAL_180, NO_SYMMETRY];

const remaining = () => [...wanted].filter((r) => (have.get(r) ?? 0) < quota);

console.error(
  `Targeting ${[...wanted]
    .sort((a, b) => a - b)
    .map(fmtRating)
    .join(', ')} to ${quota} each.`,
);
for (const r of [...wanted].sort()) {
  console.error(
    `  ${fmtRating(r)}  ${have.get(r) ?? 0}/${quota}  ${RATINGS[r].technique}` +
      `  -> phase${RATINGS[r].phase}`,
  );
}

let generated = 0;
let confirmed = 0;
let localHits = 0;
let lastProgressAt = 0;
const startedAt = Date.now();
const added = [];

while (remaining().length > 0 && generated < 200000) {
  if (existsSync(STOP_FILE)) shutdown(`Stopped via ${STOP_FILE}.`);

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
      .map((r) => `${fmtRating(r)}:${have.get(r) ?? 0}/${quota}`)
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
      se_technique: RATINGS[rating].technique,
    });
    confirmed += 1;
    // Persist as we go. Writing only at the end means an interrupted run
    // discards everything it found, which is the wrong property for a job
    // meant to run overnight — and it cost 82 puzzles once already.
    flush();
    console.error(
      `  + ${fmtRating(rating)} ${RATINGS[rating].technique.padEnd(20)} ` +
        `${have.get(rating)}/${quota}  (${generated} generated)`,
    );
  }
}

flush();

const summary = phases
  .map((phase) => `phase${phase}: ${startCounts.get(phase)} -> ${readCorpusFile(phase).length}`)
  .join(', ');

console.error(
  `\nDone. ${generated} generated, ${localHits} passed the local filter, ` +
    `${confirmed} confirmed by SE. ${summary}.`,
);
