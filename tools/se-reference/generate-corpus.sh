#!/usr/bin/env bash
set -euo pipefail

# Generates a JSONL corpus from a file of 81-char puzzle strings.
# Each puzzle is rated via SE serate and output as:
#   {"puzzle":"...","se_rating":2.3,"se_technique":"NakedSingle"}
#
# Usage:
#   bash tools/se-reference/generate-corpus.sh data/puzzles/phase1-seeds.txt
#   bash tools/se-reference/generate-corpus.sh data/puzzles/phase1-seeds.txt > benchmarks/corpus/phase1.jsonl
#
# Environment variables:
#   SE_TIMEOUT — per-puzzle timeout in seconds (default: 120)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RATE_SCRIPT="$SCRIPT_DIR/rate.sh"
SE_TIMEOUT="${SE_TIMEOUT:-120}"

# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

if [ $# -eq 0 ]; then
  echo "Usage: generate-corpus.sh <puzzle-file>" >&2
  echo "" >&2
  echo "Input: text file with one 81-char puzzle string per line" >&2
  echo "Output: JSONL to stdout (one JSON object per puzzle)" >&2
  echo "" >&2
  echo "Environment variables:" >&2
  echo "  SE_TIMEOUT  Per-puzzle timeout in seconds (default: 120)" >&2
  exit 1
fi

INPUT_FILE="$1"

if [ ! -f "$INPUT_FILE" ]; then
  echo "ERROR: File not found: $INPUT_FILE" >&2
  exit 1
fi

# Use shared timeout detection from lib.sh
detect_timeout_cmd

# Count valid puzzles for progress display
PUZZLE_COUNT=0
while IFS= read -r line || [ -n "$line" ]; do
  [[ -z "$line" || "$line" == \#* ]] && continue
  puzzle=$(echo "$line" | tr -d '[:space:]')
  [ ${#puzzle} -eq 81 ] && PUZZLE_COUNT=$((PUZZLE_COUNT + 1))
done < "$INPUT_FILE"

TOTAL=0
SUCCESS=0
FAILED=0
TIMED_OUT=0

echo "Generating corpus from $INPUT_FILE ($PUZZLE_COUNT puzzles)..." >&2
echo "" >&2

while IFS= read -r line || [ -n "$line" ]; do
  # Skip empty lines and comments
  [[ -z "$line" || "$line" == \#* ]] && continue

  # Trim whitespace
  puzzle=$(echo "$line" | tr -d '[:space:]')

  # Validate length
  if [ ${#puzzle} -ne 81 ]; then
    echo "SKIP: Invalid puzzle length (${#puzzle}): $puzzle" >&2
    continue
  fi

  TOTAL=$((TOTAL + 1))
  short_puzzle="${puzzle:0:20}..."

  # Progress: announce puzzle
  printf "[%d/%d] Rating %s" "$TOTAL" "$PUZZLE_COUNT" "$short_puzzle" >&2

  # Rate via SE (with timeout if available)
  start_time=$(date +%s)
  se_output=""
  rate_exit=0

  if [ -n "$TIMEOUT_CMD" ]; then
    se_output=$($TIMEOUT_CMD "${SE_TIMEOUT}s" "$RATE_SCRIPT" "$puzzle" 2>/dev/null) || rate_exit=$?
  else
    se_output=$("$RATE_SCRIPT" "$puzzle" 2>/dev/null) || rate_exit=$?
  fi

  end_time=$(date +%s)
  elapsed=$((end_time - start_time))

  if [ $rate_exit -eq 124 ]; then
    # timeout exit code
    echo " TIMEOUT after ${SE_TIMEOUT}s" >&2
    FAILED=$((FAILED + 1))
    TIMED_OUT=$((TIMED_OUT + 1))
    continue
  elif [ $rate_exit -ne 0 ]; then
    echo " FAIL (${elapsed}s)" >&2
    FAILED=$((FAILED + 1))
    continue
  fi

  # Parse "puzzle ED=r/p/d" format
  if [[ "$se_output" =~ ED=([0-9.]+)/([0-9.]+)/([0-9.]+) ]]; then
    rating="${BASH_REMATCH[1]}"
    technique=$(rating_to_technique "$rating")

    printf " ED=%s %s (%ds)\n" "$rating" "$technique" "$elapsed" >&2
    echo "{\"puzzle\":\"$puzzle\",\"se_rating\":$rating,\"se_technique\":\"$technique\"}"
    SUCCESS=$((SUCCESS + 1))
  else
    echo " FAIL: parse error (${elapsed}s)" >&2
    FAILED=$((FAILED + 1))
  fi
done < "$INPUT_FILE"

echo "" >&2
echo "Corpus generation complete: $SUCCESS/$TOTAL succeeded, $FAILED failed ($TIMED_OUT timed out)" >&2
