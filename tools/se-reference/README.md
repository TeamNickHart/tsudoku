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
