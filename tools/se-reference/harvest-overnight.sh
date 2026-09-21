#!/usr/bin/env bash
#
# Run the targeted harvester unattended, raising the quota as it is met.
#
# harvest-targeted.mjs exits once every requested rating hits its quota. For an
# overnight run that is the wrong behaviour — it would stop after an hour and
# leave the machine idle. This wraps it in a loop that raises the target each
# time it completes, so the corpus keeps deepening until the deadline.
#
# The rare ratings (3.8 Swordfish, 4.0 HiddenTriplet) are the real reason to
# run long: they turn up perhaps once in several thousand puzzles even with the
# local pre-filter, while 3.0 and 3.4 fill in minutes.
#
# Usage:
#   bash tools/se-reference/harvest-overnight.sh [hours] [starting-quota] [step]
#
# Example — run for 8 hours, starting at 50 and climbing by 25:
#   bash tools/se-reference/harvest-overnight.sh 8 50 25
#
# Safe to interrupt: the corpus is rewritten after each completed pass, and a
# partial pass simply leaves the previous pass's work in place.

set -uo pipefail

HOURS="${1:-8}"
QUOTA="${2:-50}"
STEP="${3:-25}"

# Ratings worth chasing. 2.6 and 4.2 are omitted: blind generation already
# produces them in bulk, so targeting them wastes the run.
RATINGS=(3.0 3.2 3.4 3.6 3.8 4.0 4.4)

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root" || exit 1

LOG="data/puzzles/harvest-overnight.log"
mkdir -p "$(dirname "$LOG")"

deadline=$(( $(date +%s) + HOURS * 3600 ))
pass=0

{
  echo "=== overnight harvest started $(date) ==="
  echo "running for ${HOURS}h, quota ${QUOTA} climbing by ${STEP}"
} >> "$LOG"

while [ "$(date +%s)" -lt "$deadline" ]; do
  pass=$((pass + 1))
  echo "--- pass $pass (quota $QUOTA) $(date +%H:%M) ---" >> "$LOG"

  node tools/se-reference/harvest-targeted.mjs "$QUOTA" "${RATINGS[@]}" >> "$LOG" 2>&1

  # A pass that completes means every rating hit quota; raise it and continue.
  QUOTA=$((QUOTA + STEP))
done

{
  echo "=== finished $(date) after $pass pass(es) ==="
  echo "corpus now: $(wc -l < benchmarks/corpus/phase2.jsonl) puzzles"
} >> "$LOG"

echo "Done. See $LOG"
