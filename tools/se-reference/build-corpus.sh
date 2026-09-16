#!/usr/bin/env bash
set -euo pipefail

# Rebuilds phase-specific corpus files from verified puzzles.
# Filters verified/puzzles.jsonl by SE rating into benchmarks/corpus/phaseN.jsonl.
#
# Usage:
#   bash tools/se-reference/build-corpus.sh
#
# No SE/Java required — works purely from the verified JSONL data.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

VERIFIED_FILE="$REPO_ROOT/data/puzzles/verified/puzzles.jsonl"
CORPUS_DIR="$REPO_ROOT/benchmarks/corpus"

if [ ! -f "$VERIFIED_FILE" ]; then
  echo "ERROR: No verified puzzles file found at $VERIFIED_FILE" >&2
  echo "Run the intake pipeline first: bash tools/se-reference/intake.sh" >&2
  exit 1
fi

mkdir -p "$CORPUS_DIR"

# Clear output files
> "$CORPUS_DIR/phase1.jsonl"
> "$CORPUS_DIR/phase2.jsonl"
> "$CORPUS_DIR/phase3.jsonl"
> "$CORPUS_DIR/phase4.jsonl"

PHASE1=0
PHASE2=0
PHASE3=0
PHASE4=0

while IFS= read -r line || [ -n "$line" ]; do
  [ -z "$line" ] && continue

  # Extract se_rating from the JSON line
  if [[ "$line" =~ \"se_rating\":([0-9.]+) ]]; then
    rating="${BASH_REMATCH[1]}"
  else
    continue
  fi

  # Extract puzzle and se_technique for the slim corpus format
  if [[ "$line" =~ \"puzzle\":\"([^\"]+)\" ]]; then
    puzzle="${BASH_REMATCH[1]}"
  else
    continue
  fi

  if [[ "$line" =~ \"se_technique\":\"([^\"]+)\" ]]; then
    technique="${BASH_REMATCH[1]}"
  else
    technique="Unknown"
  fi

  # Slim corpus record (matches existing corpus format)
  record="{\"puzzle\":\"$puzzle\",\"se_rating\":$rating,\"se_technique\":\"$technique\"}"

  # Use awk for float comparison
  phase=$(awk "BEGIN { r=$rating; if (r <= 2.5) print 1; else if (r <= 4.4) print 2; else if (r <= 6.0) print 3; else print 4 }")

  case "$phase" in
    1) echo "$record" >> "$CORPUS_DIR/phase1.jsonl"; PHASE1=$((PHASE1 + 1)) ;;
    2) echo "$record" >> "$CORPUS_DIR/phase2.jsonl"; PHASE2=$((PHASE2 + 1)) ;;
    3) echo "$record" >> "$CORPUS_DIR/phase3.jsonl"; PHASE3=$((PHASE3 + 1)) ;;
    4) echo "$record" >> "$CORPUS_DIR/phase4.jsonl"; PHASE4=$((PHASE4 + 1)) ;;
  esac
done < "$VERIFIED_FILE"

echo "Corpus rebuilt from verified puzzles:" >&2
echo "  Phase 1 (SE 1.0–2.5):  $PHASE1 puzzles → benchmarks/corpus/phase1.jsonl" >&2
echo "  Phase 2 (SE 2.6–4.4):  $PHASE2 puzzles → benchmarks/corpus/phase2.jsonl" >&2
echo "  Phase 3 (SE 4.5–6.0):  $PHASE3 puzzles → benchmarks/corpus/phase3.jsonl" >&2
echo "  Phase 4 (SE 6.2+):     $PHASE4 puzzles → benchmarks/corpus/phase4.jsonl" >&2
echo "  Total: $((PHASE1 + PHASE2 + PHASE3 + PHASE4)) puzzles" >&2
