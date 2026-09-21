#!/usr/bin/env bash
#
# Continuously generate, rate and bank puzzles.
#
# Writes to data/puzzles/verified/puzzles.jsonl — the canonical store — in the
# same record shape the intake pipeline produces, so `pnpm puzzle:build-corpus`
# derives the benchmark corpus from it as usual. Writing straight to
# benchmarks/corpus/ would let the two drift.
#
# ## Why it targets rather than accumulates
#
# The constraint on this corpus is distribution, not volume. Random minimal
# puzzles cluster hard: a harvest of 800 produced 33 puzzles at SE 2.6 and 37
# at 4.2, but only one each at 3.2, 3.8 and 4.0. Generating blindly would
# deepen that skew rather than fix it.
#
# So each puzzle is kept only if its rating is still under quota. Everything
# else is discarded, however valid.
#
# ## Usage
#
#   bash tools/se-reference/generate-daemon.sh [quota] [max-hours]
#
#   quota      per-rating target, default 100
#   max-hours  stop after this long, default 0 (run until interrupted)
#
# Ctrl-C is safe: puzzles are appended as they are found, never held in memory.

set -uo pipefail

QUOTA="${1:-100}"
MAX_HOURS="${2:-0}"
BATCH_SIZE=50

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root" || exit 1

# shellcheck source=lib.sh
source "$repo_root/tools/se-reference/lib.sh"

VERIFIED="data/puzzles/verified/puzzles.jsonl"
TODAY="$(date +%Y-%m-%d)"
work="$(mktemp -d)"
trap 'rm -rf "$work"; echo; echo "Stopped. $kept banked this run." >&2' EXIT

mkdir -p "$(dirname "$VERIFIED")"
touch "$VERIFIED"

kept=0
generated=0
start_epoch="$(date +%s)"
seed="$(date +%s)"

# Ratings worth chasing: everything TSudoku implements or plans through Phase 2.
TARGET_RATINGS=(1.0 1.2 1.5 1.7 1.9 2.0 2.3 2.5 2.6 2.8 3.0 3.2 3.4 3.6 3.8 4.0 4.2 4.4)

count_for_rating() {
  # `grep -c` exits non-zero on no matches *and* still prints 0, so a
  # `|| echo 0` fallback would emit "0\n0" and break every numeric test.
  local n
  n="$(grep -c "\"se_rating\":$1," "$VERIFIED" 2>/dev/null)"
  echo "${n:-0}"
}

echo "Target: $QUOTA puzzles per rating. Banking to $VERIFIED" >&2
echo "Current gaps:" >&2
for r in "${TARGET_RATINGS[@]}"; do
  n="$(count_for_rating "$r")"
  [ "$n" -lt "$QUOTA" ] && printf '  %-5s %d/%d\n' "$r" "$n" "$QUOTA" >&2
done

while true; do
  if [ "$MAX_HOURS" != "0" ]; then
    elapsed_h=$(( ($(date +%s) - start_epoch) / 3600 ))
    [ "$elapsed_h" -ge "$MAX_HOURS" ] && break
  fi

  # Stop once every target rating is satisfied.
  remaining=0
  for r in "${TARGET_RATINGS[@]}"; do
    [ "$(count_for_rating "$r")" -lt "$QUOTA" ] && remaining=$((remaining + 1))
  done
  if [ "$remaining" -eq 0 ]; then
    echo "All ratings at quota." >&2
    break
  fi

  seed=$((seed + 1))
  node -e "
    const { generate, NO_SYMMETRY, ROTATIONAL_180 } =
      require('$repo_root/packages/generator/dist/index.cjs');
    let s = $seed;
    const rng = () => { s |= 0; s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const syms = [ROTATIONAL_180, NO_SYMMETRY];
    for (let i = 0; i < $BATCH_SIZE; i++) {
      process.stdout.write(generate({ symmetry: syms[i % syms.length], rng }).puzzle + '\n');
    }
  " > "$work/batch.txt" 2>/dev/null || continue

  generated=$((generated + BATCH_SIZE))

  bash tools/se-reference/rate.sh "$work/batch.txt" 2>/dev/null > "$work/rated.txt" || continue

  while read -r line; do
    puzzle="${line%% *}"
    ed="${line##*ED=}"
    rating="${ed%%/*}"
    rest="${ed#*/}"
    pearl="${rest%%/*}"
    diamond="${rest##*/}"
    [ -z "$rating" ] && continue

    # Only ratings we actually target. SE happily produces 4.5, 6.6, 7.2 and
    # beyond; those are Phase 3/4 territory and banking them would bloat the
    # store with puzzles nothing can validate yet.
    wanted=0
    for target in "${TARGET_RATINGS[@]}"; do
      [ "$rating" = "$target" ] && wanted=1 && break
    done
    [ "$wanted" -eq 0 ] && continue

    # Under quota? Counted fresh each time: earlier puzzles in *this* batch
    # have already been appended, so a count taken once per batch would
    # overshoot.
    [ "$(count_for_rating "$rating")" -ge "$QUOTA" ] && continue

    # Already banked?
    grep -q "\"puzzle\":\"$puzzle\"" "$VERIFIED" && continue

    technique="$(rating_to_technique "$rating")"
    printf '{"puzzle":"%s","se_rating":%s,"se_pearl":%s,"se_diamond":%s,"se_technique":"%s","source":"generated","claimed_rating":"","intake_date":"%s"}\n' \
      "$puzzle" "$rating" "$pearl" "$diamond" "$technique" "$TODAY" >> "$VERIFIED"
    kept=$((kept + 1))
    printf '  banked %-5s %-20s (%d this run, %d generated)\n' \
      "$rating" "$technique" "$kept" "$generated" >&2
  done < "$work/rated.txt"
done
