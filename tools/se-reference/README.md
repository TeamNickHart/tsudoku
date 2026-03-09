# SE Reference

TSudoku validates its technique detection and difficulty ratings against
[SudokuExplainer](https://github.com/1to9only/SudokuExplainer) (SE), the
gold-standard Java-based Sudoku technique classifier. This directory contains
scripts to set up and run the SE CLI locally.

## Prerequisites

- **OpenJDK 11+** (17 recommended)
  - macOS: `brew install openjdk`
  - Debian/Ubuntu: `sudo apt-get install openjdk-17-jre-headless`
  - Windows: `winget install Microsoft.OpenJDK.17` or [Adoptium](https://adoptium.net)

> **macOS note:** Homebrew OpenJDK isn't on the default PATH. Add this to your
> shell profile (`~/.zshrc` or `~/.bashrc`):
>
> ```bash
> export PATH="/opt/homebrew/opt/openjdk/bin:$PATH"
> ```

## Setup

```bash
bash tools/se-reference/setup.sh
```

This will:

1. Verify Java is installed
2. Download `SudokuExplainer.jar` from the 1to9only GitHub repository
3. Run a smoke test to confirm it works

The JAR is git-ignored and must be downloaded locally by each contributor.

## Rating puzzles

```bash
# Rate a single puzzle
bash tools/se-reference/rate.sh '530070000600195000098000060800060003400803001700020006060000280000419005000080079'

# Rate puzzles from a file (one per line)
bash tools/se-reference/rate.sh puzzles.txt
```

Output format: `<puzzle> ED=<hardest>/<hardest_without_BF>/<easiest>`

## Puzzle intake pipeline

New puzzles go through a screening pipeline before entering the benchmark corpus.
This prevents wasting time on unsolvable or overly hard puzzles.

### Directory structure

```
data/puzzles/
├── unverified/          ← drop new puzzle files here
│   └── processed/       ← intake moves files here after processing (gitignored)
├── verified/
│   └── puzzles.jsonl    ← all verified puzzles (single append-only file)
└── rejected/
    └── puzzles.jsonl    ← failed puzzles with reasons
```

### Adding new puzzles

1. Create a `.txt` file in `data/puzzles/unverified/` with one 81-char puzzle per line.
   Optional header comments for metadata:

   ```
   # source: sudokuwiki.org/daily
   # claimed_rating: easy
   530070000600195000098000060...
   ```

2. Run the intake pipeline:

   ```bash
   pnpm puzzle:intake                    # process all files in unverified/
   pnpm puzzle:intake myfile.txt          # process a specific file
   SE_TIMEOUT=30 pnpm puzzle:intake       # custom timeout (default: 30s)
   ```

3. Rebuild the corpus from verified puzzles:

   ```bash
   pnpm puzzle:build-corpus
   ```

The intake script:

- Validates puzzle format (81 chars, digits 0-9 and dots)
- Deduplicates against existing verified and rejected puzzles
- Rates each puzzle via SE with a configurable timeout (default 30s)
- Appends results to `verified/puzzles.jsonl` or `rejected/puzzles.jsonl`
- Moves processed files to `unverified/processed/`

### Corpus build

`build-corpus.sh` filters `verified/puzzles.jsonl` by SE rating into phase-specific
corpus files used by the benchmark:

| Phase | Rating range | Output file                      |
| ----- | ------------ | -------------------------------- |
| 1     | 1.0–2.5      | `benchmarks/corpus/phase1.jsonl` |
| 2     | 2.6–4.4      | `benchmarks/corpus/phase2.jsonl` |
| 3     | 4.5–6.0      | `benchmarks/corpus/phase3.jsonl` |
| 4     | 6.2+         | `benchmarks/corpus/phase4.jsonl` |

## Generating a corpus directly

For ad-hoc corpus generation (without the intake pipeline):

```bash
bash tools/se-reference/generate-corpus.sh data/puzzles/phase1-seeds.txt > benchmarks/corpus/phase1.jsonl
```

## How the benchmark uses SE

The benchmark runner (`benchmarks/runner.ts`) will compare TSudoku's technique
detection output against SE ratings from the corpus. The corpus files in
`benchmarks/corpus/` contain pre-rated puzzles, but you can also generate fresh
ratings using `rate.sh` to validate against the original SE.

## SE output format

```
ED=r/p/d
  r = difficulty of the hardest technique used
  p = difficulty of the hardest technique excluding brute force
  d = difficulty of the easiest technique used
```
