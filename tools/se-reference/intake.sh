#!/usr/bin/env bash
set -euo pipefail

# Intake pipeline: rates unverified puzzles via SE and sorts them into
# verified/ or rejected/ with full metadata.
#
# Usage:
#   bash tools/se-reference/intake.sh                    # process all files in unverified/
#   bash tools/se-reference/intake.sh myfile.txt          # process specific file in unverified/
#   SE_TIMEOUT=30 bash tools/se-reference/intake.sh       # custom timeout (default: 30s)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
RATE_SCRIPT="$SCRIPT_DIR/rate.sh"
SE_TIMEOUT="${SE_TIMEOUT:-30}"

UNVERIFIED_DIR="$REPO_ROOT/data/puzzles/unverified"
PROCESSED_DIR="$UNVERIFIED_DIR/processed"
VERIFIED_FILE="$REPO_ROOT/data/puzzles/verified/puzzles.jsonl"
REJECTED_FILE="$REPO_ROOT/data/puzzles/rejected/puzzles.jsonl"

# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

# Gate check
check_se_prerequisites "$SCRIPT_DIR"
detect_timeout_cmd

# Ensure output directories and files exist
mkdir -p "$PROCESSED_DIR"
touch "$VERIFIED_FILE"
touch "$REJECTED_FILE"

# Build dedup set from existing verified + rejected puzzles
declare -A KNOWN_PUZZLES
while IFS= read -r line || [ -n "$line" ]; do
  if [[ "$line" =~ \"puzzle\":\"([^\"]+)\" ]]; then
    KNOWN_PUZZLES["${BASH_REMATCH[1]}"]=1
  fi
done < "$VERIFIED_FILE"
while IFS= read -r line || [ -n "$line" ]; do
  if [[ "$line" =~ \"puzzle\":\"([^\"]+)\" ]]; then
    KNOWN_PUZZLES["${BASH_REMATCH[1]}"]=1
  fi
done < "$REJECTED_FILE"

echo "Loaded ${#KNOWN_PUZZLES[@]} known puzzles for dedup" >&2

# Collect files to process
FILES=()
if [ $# -gt 0 ]; then
  for arg in "$@"; do
    filepath="$UNVERIFIED_DIR/$arg"
    if [ ! -f "$filepath" ]; then
      echo "ERROR: File not found: $filepath" >&2
      exit 1
    fi
    FILES+=("$filepath")
  done
else
  for f in "$UNVERIFIED_DIR"/*.txt; do
    [ -f "$f" ] && FILES+=("$f")
  done
fi

if [ ${#FILES[@]} -eq 0 ]; then
  echo "No files to process in $UNVERIFIED_DIR/" >&2
  exit 0
fi

TODAY=$(date +%Y-%m-%d)
TOTAL_VERIFIED=0
TOTAL_REJECTED=0
TOTAL_SKIPPED=0
TOTAL_INVALID=0

for INPUT_FILE in "${FILES[@]}"; do
  FILENAME=$(basename "$INPUT_FILE")
  echo "" >&2
  echo "=== Processing: $FILENAME ===" >&2

  # Parse header comments for metadata
  FILE_SOURCE="$FILENAME"
  FILE_CLAIMED_RATING="unknown"
  while IFS= read -r line || [ -n "$line" ]; do
    [[ "$line" != \#* ]] && break
    if [[ "$line" =~ ^#\ *source:\ *(.*) ]]; then
      FILE_SOURCE="${BASH_REMATCH[1]}"
    elif [[ "$line" =~ ^#\ *claimed_rating:\ *(.*) ]]; then
      FILE_CLAIMED_RATING="${BASH_REMATCH[1]}"
    fi
  done < "$INPUT_FILE"

  # Count puzzles for progress
  PUZZLE_COUNT=0
  while IFS= read -r line || [ -n "$line" ]; do
    [[ -z "$line" || "$line" == \#* ]] && continue
    puzzle=$(echo "$line" | tr -d '[:space:]')
    [ ${#puzzle} -eq 81 ] && PUZZLE_COUNT=$((PUZZLE_COUNT + 1))
  done < "$INPUT_FILE"

  FILE_NUM=0
  FILE_VERIFIED=0
  FILE_REJECTED=0
  FILE_SKIPPED=0
  FILE_INVALID=0

  while IFS= read -r line || [ -n "$line" ]; do
    # Skip empty lines and comments
    [[ -z "$line" || "$line" == \#* ]] && continue

    # Trim whitespace
    puzzle=$(echo "$line" | tr -d '[:space:]')

    # Validate format: 81 chars, digits 0-9 and dots only
    if [ ${#puzzle} -ne 81 ]; then
      echo "  SKIP: Invalid length (${#puzzle}): ${puzzle:0:30}..." >&2
      FILE_INVALID=$((FILE_INVALID + 1))
      continue
    fi

    if [[ ! "$puzzle" =~ ^[0-9.]+$ ]]; then
      echo "  SKIP: Invalid characters: ${puzzle:0:30}..." >&2
      FILE_INVALID=$((FILE_INVALID + 1))
      continue
    fi

    FILE_NUM=$((FILE_NUM + 1))
    short_puzzle="${puzzle:0:20}..."

    # Dedup check
    if [ -n "${KNOWN_PUZZLES[$puzzle]+x}" ]; then
      printf "  [%d/%d] %s SKIP (duplicate)\n" "$FILE_NUM" "$PUZZLE_COUNT" "$short_puzzle" >&2
      FILE_SKIPPED=$((FILE_SKIPPED + 1))
      continue
    fi

    printf "  [%d/%d] Rating %s" "$FILE_NUM" "$PUZZLE_COUNT" "$short_puzzle" >&2

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
      echo " TIMEOUT after ${SE_TIMEOUT}s" >&2
      echo "{\"puzzle\":\"$puzzle\",\"reason\":\"timeout\",\"source\":\"$FILE_SOURCE\",\"claimed_rating\":\"$FILE_CLAIMED_RATING\",\"intake_date\":\"$TODAY\"}" >> "$REJECTED_FILE"
      KNOWN_PUZZLES["$puzzle"]=1
      FILE_REJECTED=$((FILE_REJECTED + 1))
    elif [ $rate_exit -ne 0 ]; then
      echo " FAIL (${elapsed}s)" >&2
      echo "{\"puzzle\":\"$puzzle\",\"reason\":\"rating_failed\",\"source\":\"$FILE_SOURCE\",\"claimed_rating\":\"$FILE_CLAIMED_RATING\",\"intake_date\":\"$TODAY\"}" >> "$REJECTED_FILE"
      KNOWN_PUZZLES["$puzzle"]=1
      FILE_REJECTED=$((FILE_REJECTED + 1))
    elif [[ "$se_output" =~ ED=([0-9.]+)/([0-9.]+)/([0-9.]+) ]]; then
      rating="${BASH_REMATCH[1]}"
      pearl="${BASH_REMATCH[2]}"
      diamond="${BASH_REMATCH[3]}"
      technique=$(rating_to_technique "$rating")

      printf " ED=%s/%s/%s %s (%ds)\n" "$rating" "$pearl" "$diamond" "$technique" "$elapsed" >&2
      echo "{\"puzzle\":\"$puzzle\",\"se_rating\":$rating,\"se_pearl\":$pearl,\"se_diamond\":$diamond,\"se_technique\":\"$technique\",\"source\":\"$FILE_SOURCE\",\"claimed_rating\":\"$FILE_CLAIMED_RATING\",\"intake_date\":\"$TODAY\"}" >> "$VERIFIED_FILE"
      KNOWN_PUZZLES["$puzzle"]=1
      FILE_VERIFIED=$((FILE_VERIFIED + 1))
    else
      echo " FAIL: parse error (${elapsed}s)" >&2
      echo "{\"puzzle\":\"$puzzle\",\"reason\":\"parse_error\",\"source\":\"$FILE_SOURCE\",\"claimed_rating\":\"$FILE_CLAIMED_RATING\",\"intake_date\":\"$TODAY\"}" >> "$REJECTED_FILE"
      KNOWN_PUZZLES["$puzzle"]=1
      FILE_REJECTED=$((FILE_REJECTED + 1))
    fi
  done < "$INPUT_FILE"

  # Move processed file
  mv "$INPUT_FILE" "$PROCESSED_DIR/"
  echo "  Moved $FILENAME → unverified/processed/" >&2
  echo "  Results: $FILE_VERIFIED verified, $FILE_REJECTED rejected, $FILE_SKIPPED skipped, $FILE_INVALID invalid" >&2

  TOTAL_VERIFIED=$((TOTAL_VERIFIED + FILE_VERIFIED))
  TOTAL_REJECTED=$((TOTAL_REJECTED + FILE_REJECTED))
  TOTAL_SKIPPED=$((TOTAL_SKIPPED + FILE_SKIPPED))
  TOTAL_INVALID=$((TOTAL_INVALID + FILE_INVALID))
done

echo "" >&2
echo "=== Intake complete ===" >&2
echo "  Verified: $TOTAL_VERIFIED" >&2
echo "  Rejected: $TOTAL_REJECTED" >&2
echo "  Skipped (duplicate): $TOTAL_SKIPPED" >&2
echo "  Invalid: $TOTAL_INVALID" >&2
