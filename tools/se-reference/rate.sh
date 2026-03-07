#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
JAR_PATH="$SCRIPT_DIR/SudokuExplainer.jar"

if [ ! -f "$JAR_PATH" ]; then
  echo "ERROR: SudokuExplainer.jar not found. Run setup.sh first:" >&2
  echo "  bash tools/se-reference/setup.sh" >&2
  exit 1
fi

if [ $# -eq 0 ]; then
  echo "Usage: rate.sh <puzzle-string-or-file>" >&2
  echo "" >&2
  echo "Examples:" >&2
  echo "  bash tools/se-reference/rate.sh '530070000600195000098000060800060003400803001700020006060000280000419005000080079'" >&2
  echo "  bash tools/se-reference/rate.sh puzzles.txt" >&2
  exit 1
fi

INPUT="$1"

if [ -f "$INPUT" ]; then
  # Input is a file path
  java -cp "$JAR_PATH" diuf.sudoku.test.serate \
    --input="$INPUT" --output=- --format="%g ED=%r/%p/%d"
else
  # Input is a puzzle string
  TMPFILE=$(mktemp)
  echo "$INPUT" > "$TMPFILE"
  java -cp "$JAR_PATH" diuf.sudoku.test.serate \
    --input="$TMPFILE" --output=- --format="%g ED=%r/%p/%d"
  rm -f "$TMPFILE"
fi
