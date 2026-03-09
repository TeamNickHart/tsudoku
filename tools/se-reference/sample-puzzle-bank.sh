#!/usr/bin/env bash
set -euo pipefail

# Samples puzzles from the Sudoku Exchange Puzzle Bank by SE rating.
#
# Usage:
#   bash tools/se-reference/sample-puzzle-bank.sh <puzzle-bank-dir> <rating> <count>
#
# Example:
#   bash tools/se-reference/sample-puzzle-bank.sh /tmp/puzzle-bank 1.2 100
#
# Outputs one puzzle per line (81-char string) to stdout.
# Samples randomly using shuf.

BANK_DIR="${1:?Usage: sample-puzzle-bank.sh <puzzle-bank-dir> <rating> <count>}"
RATING="${2:?Usage: sample-puzzle-bank.sh <puzzle-bank-dir> <rating> <count>}"
COUNT="${3:?Usage: sample-puzzle-bank.sh <puzzle-bank-dir> <rating> <count>}"

# Search all bank files for matching rating
MATCHES=$(cat "$BANK_DIR"/*.txt 2>/dev/null | awk -v r="$RATING" '$3 == r {print $2}')

TOTAL=$(echo "$MATCHES" | wc -l | tr -d ' ')
if [ "$TOTAL" -eq 0 ]; then
  echo "ERROR: No puzzles found with rating $RATING" >&2
  exit 1
fi

echo "Found $TOTAL puzzles with rating $RATING, sampling $COUNT" >&2

# Use shuf if available (Linux), otherwise gshuf (macOS with coreutils), otherwise sort -R
if command -v gshuf &>/dev/null; then
  echo "$MATCHES" | gshuf -n "$COUNT"
elif command -v shuf &>/dev/null; then
  echo "$MATCHES" | shuf -n "$COUNT"
else
  echo "$MATCHES" | sort -R | head -n "$COUNT"
fi
