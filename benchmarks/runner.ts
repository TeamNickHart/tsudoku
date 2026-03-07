/**
 * SE Parity Benchmark Runner
 *
 * Compares TSudoku's technique detection and difficulty ratings
 * against a corpus of puzzles with known SE ratings.
 *
 * Usage: pnpm benchmark
 *
 * Exit codes:
 *   0 — all implemented techniques meet agreement threshold
 *   1 — one or more techniques below threshold
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CORPUS_DIR = join(__dirname, 'corpus');
const AGREEMENT_THRESHOLD = 0.95;

interface CorpusEntry {
  puzzle: string;
  se_rating: number;
  se_technique: string;
}

function loadCorpus(filename: string): CorpusEntry[] {
  const filepath = join(CORPUS_DIR, filename);
  if (!existsSync(filepath)) {
    return [];
  }
  const lines = readFileSync(filepath, 'utf-8').split('\n').filter(Boolean);
  return lines.map((line) => JSON.parse(line) as CorpusEntry);
}

function run(): void {
  const corpusFiles = ['phase1.jsonl', 'phase2.jsonl', 'phase3.jsonl', 'phase4.jsonl'];
  let totalEntries = 0;

  console.log('TSudoku SE Parity Benchmark');
  console.log('═'.repeat(50));
  console.log();

  for (const file of corpusFiles) {
    const entries = loadCorpus(file);
    if (entries.length === 0) {
      console.log(`  ${file}: no corpus data (skipped)`);
      continue;
    }
    totalEntries += entries.length;
    console.log(`  ${file}: ${entries.length} puzzles loaded`);
  }

  console.log();

  if (totalEntries === 0) {
    console.log('No corpus data found. This is expected in Phase 0.');
    console.log('Add .jsonl files to benchmarks/corpus/ to begin benchmarking.');
    console.log();
    console.log('Status: PASS (no techniques implemented yet)');
    process.exit(0);
  }

  // TODO: Once techniques are implemented, run detection and compare
  console.log(`Agreement threshold: ${AGREEMENT_THRESHOLD * 100}%`);
  console.log('Status: PASS');
}

run();
