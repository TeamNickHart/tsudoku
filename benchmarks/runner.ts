/**
 * SE Parity Benchmark Runner
 *
 * Compares TSudoku's technique detection and difficulty ratings
 * against a corpus of puzzles with known SE ratings.
 *
 * Usage:
 *   pnpm benchmark               # all phases with corpus data
 *   tsx runner.ts --phases=1      # phase 1 only (quick)
 *   tsx runner.ts --phases=1,2    # phases 1 and 2
 *
 * Exit codes:
 *   0 — all implemented techniques meet agreement threshold
 *   1 — one or more techniques below threshold
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGrid, applyHint, Solver } from '@tsudoku/core';
import type { Grid, Hint, Technique } from '@tsudoku/core';
import { TECHNIQUE_DIFFICULTY } from '@tsudoku/core';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CORPUS_DIR = join(__dirname, 'corpus');
const AGREEMENT_THRESHOLD = 0.95;
const RATING_TOLERANCE = 0.05;

/** Set of technique names that TSudoku currently has producers for. */
const IMPLEMENTED_TECHNIQUES = new Set<string>(Object.keys(TECHNIQUE_DIFFICULTY) as Technique[]);

const ALL_PHASES = [1, 2, 3, 4] as const;

interface CorpusEntry {
  puzzle: string;
  se_rating: number;
  se_technique: string;
}

interface TechniqueResult {
  total: number;
  agreed: number;
  disagreed: number;
  errors: string[];
}

function parsePhases(args: string[]): number[] {
  for (const arg of args) {
    if (arg.startsWith('--phases=')) {
      const value = arg.slice('--phases='.length);
      return value
        .split(',')
        .map(Number)
        .filter((n) => !isNaN(n));
    }
  }
  return [...ALL_PHASES];
}

function loadCorpus(filename: string): CorpusEntry[] {
  const filepath = join(CORPUS_DIR, filename);
  if (!existsSync(filepath)) {
    return [];
  }
  const lines = readFileSync(filepath, 'utf-8').split('\n').filter(Boolean);
  return lines.map((line) => JSON.parse(line) as CorpusEntry);
}

function solvePuzzle(puzzle: string): {
  hardestDifficulty: number;
  hardestTechnique: string;
  steps: number;
} {
  const solver = new Solver();
  let grid: Grid = createGrid(puzzle);
  let hardestDifficulty = 0;
  let hardestTechnique = '';
  let steps = 0;
  const maxSteps = 500;

  while (steps < maxSteps) {
    const hint: Hint | null = solver.getNextHint(grid);
    if (hint === null) break;

    if (hint.difficulty > hardestDifficulty) {
      hardestDifficulty = hint.difficulty;
      hardestTechnique = hint.technique;
    }

    grid = applyHint(grid, hint);
    steps++;
  }

  return { hardestDifficulty, hardestTechnique, steps };
}

function ratingsAgree(tsudokuRating: number, seRating: number): boolean {
  return Math.abs(tsudokuRating - seRating) <= RATING_TOLERANCE;
}

function run(): void {
  const phases = parsePhases(process.argv.slice(2));
  const corpusFiles = phases.map((p) => `phase${p}.jsonl`);

  let totalEntries = 0;
  let totalAgreed = 0;
  let totalDisagreed = 0;
  let totalSkipped = 0;
  let hasFailed = false;

  const techniqueResults = new Map<string, TechniqueResult>();

  console.log('TSudoku SE Parity Benchmark');
  console.log('═'.repeat(60));
  console.log(`Phases: ${phases.join(', ')}`);
  console.log(`Implemented techniques: ${[...IMPLEMENTED_TECHNIQUES].join(', ')}`);
  console.log();

  for (const file of corpusFiles) {
    const entries = loadCorpus(file);
    if (entries.length === 0) {
      console.log(`  ${file}: no corpus data (skipped)`);
      continue;
    }

    // Filter to only entries whose technique we've implemented
    const testable = entries.filter((e) => IMPLEMENTED_TECHNIQUES.has(e.se_technique));
    const skipped = entries.length - testable.length;
    totalSkipped += skipped;

    console.log(
      `  ${file}: ${entries.length} puzzles loaded, ${testable.length} testable, ${skipped} skipped (unimplemented technique)`,
    );

    for (const entry of testable) {
      totalEntries++;

      const result = solvePuzzle(entry.puzzle);
      const agreed = ratingsAgree(result.hardestDifficulty, entry.se_rating);

      // Track per-technique results
      const key = entry.se_technique;
      if (!techniqueResults.has(key)) {
        techniqueResults.set(key, { total: 0, agreed: 0, disagreed: 0, errors: [] });
      }
      // Safe: just set above if missing
      const techResult = techniqueResults.get(key)!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
      techResult.total++;

      if (agreed) {
        techResult.agreed++;
        totalAgreed++;
      } else {
        techResult.disagreed++;
        totalDisagreed++;
        const shortPuzzle = entry.puzzle.slice(0, 20) + '...';
        techResult.errors.push(
          `  ${shortPuzzle} SE=${entry.se_rating} TSudoku=${result.hardestDifficulty} (${result.hardestTechnique})`,
        );
      }
    }
  }

  console.log();

  if (totalEntries === 0) {
    console.log(
      `No testable corpus data found (${totalSkipped} entries skipped — unimplemented techniques).`,
    );
    console.log(
      'Generate corpus with: bash tools/se-reference/generate-corpus.sh data/puzzles/phase1-seeds.txt > benchmarks/corpus/phase1.jsonl',
    );
    console.log();
    console.log('Status: PASS (no testable corpus data)');
    process.exit(0);
  }

  // Per-technique report
  console.log('Per-Technique Agreement');
  console.log('─'.repeat(60));

  const sortedTechniques = [...techniqueResults.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  for (const [technique, result] of sortedTechniques) {
    const pct = result.total > 0 ? (result.agreed / result.total) * 100 : 0;
    const status = pct >= AGREEMENT_THRESHOLD * 100 ? 'PASS' : 'FAIL';
    const icon = status === 'PASS' ? ' ' : '!';

    console.log(
      `${icon} ${technique.padEnd(25)} ${result.agreed}/${result.total} (${pct.toFixed(1)}%) ${status}`,
    );

    if (result.errors.length > 0 && result.errors.length <= 10) {
      for (const err of result.errors) {
        console.log(err);
      }
    } else if (result.errors.length > 10) {
      for (const err of result.errors.slice(0, 5)) {
        console.log(err);
      }
      console.log(`  ... and ${result.errors.length - 5} more`);
    }

    if (pct < AGREEMENT_THRESHOLD * 100) {
      hasFailed = true;
    }
  }

  console.log();
  console.log('─'.repeat(60));

  const overallPct = totalEntries > 0 ? (totalAgreed / totalEntries) * 100 : 0;
  console.log(
    `Overall: ${totalAgreed}/${totalEntries} (${overallPct.toFixed(1)}%) [${totalSkipped} skipped]`,
  );
  console.log(`Agreement threshold: ${AGREEMENT_THRESHOLD * 100}%`);
  console.log();

  if (hasFailed) {
    console.log('Status: FAIL');
    process.exit(1);
  } else {
    console.log('Status: PASS');
    process.exit(0);
  }
}

run();
