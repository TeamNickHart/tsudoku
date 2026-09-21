#!/usr/bin/env bash
#
# Generate puzzles, rate them with the real SE CLI, and keep the ones that land
# in a target difficulty band.
#
# Random minimal puzzles do NOT distribute evenly across difficulty: a sample
# of 20 came out bimodal, 10 at <=2.0 and 8 at >=5.6, with only 2 in the
# 2.6-4.4 Phase 2 band. Clue count does not predict it either — 26 clues
# produced both a 1.2 and a 7.1. So there is no clever targeting to do; the
# approach is volume plus filtering on SE's own rating.
#
# Usage:
#   bash tools/se-reference/harvest.sh <batches> <min> <max> [seed]
#
# Example — harvest Phase 2 puzzles:
#   bash tools/se-reference/harvest.sh 20 2.6 4.4
#
# Writes JSONL to stdout, progress to stderr.

set -uo pipefail

BATCHES="${1:?usage: harvest.sh <batches> <min> <max> [seed]}"
MIN="${2:?}"
MAX="${3:?}"
SEED="${4:-$RANDOM}"
BATCH_SIZE=50

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root" || exit 1

# rating_to_technique — the same SE rating -> technique map the intake uses.
# shellcheck source=lib.sh
source "$repo_root/tools/se-reference/lib.sh"

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

kept=0
generated=0

for ((b = 0; b < BATCHES; b++)); do
  batch_seed=$((SEED + b))

  node -e "
    const { generate, NO_SYMMETRY, ROTATIONAL_180 } =
      require('$repo_root/packages/generator/dist/index.cjs');
    let s = $batch_seed;
    const rng = () => { s |= 0; s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const syms = [ROTATIONAL_180, NO_SYMMETRY];
    for (let i = 0; i < $BATCH_SIZE; i++) {
      process.stdout.write(generate({ symmetry: syms[i % syms.length], rng }).puzzle + '\n');
    }
  " > "$work/batch.txt" || continue

  generated=$((generated + BATCH_SIZE))

  bash tools/se-reference/rate.sh "$work/batch.txt" 2>/dev/null > "$work/rated.txt" || continue

  # SE emits "<puzzle> ED=<hardest>/<hardest_no_bruteforce>/<easiest>"
  while read -r line; do
    puzzle="${line%% *}"
    rating="${line##*ED=}"
    rating="${rating%%/*}"
    [ -z "$rating" ] && continue

    if awk -v r="$rating" -v lo="$MIN" -v hi="$MAX" 'BEGIN{exit !(r>=lo && r<=hi)}'; then
      technique="$(rating_to_technique "$rating")"
      printf '{"puzzle":"%s","se_rating":%s,"se_technique":"%s"}\n' \
        "$puzzle" "$rating" "$technique"
      kept=$((kept + 1))
    fi
  done < "$work/rated.txt"

  echo "  batch $((b + 1))/$BATCHES — generated $generated, kept $kept" >&2
done

echo "Done: $kept puzzles in [$MIN, $MAX] from $generated generated (seed $SEED)." >&2
