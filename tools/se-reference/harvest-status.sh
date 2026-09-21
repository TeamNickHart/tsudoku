#!/usr/bin/env bash
#
# Show what the harvest is doing. Read-only and safe to run at any time.
#
#   bash tools/se-reference/harvest-status.sh          once
#   watch -n30 bash tools/se-reference/harvest-status.sh   live

set -uo pipefail
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root" || exit 1

CORPUS="benchmarks/corpus/phase2.jsonl"
LOG="data/puzzles/harvest-overnight.log"

echo "TSudoku harvest — $(date '+%H:%M:%S')"
echo

# --- is it running -----------------------------------------------------------
wrapper="$(pgrep -f 'harvest-overnight' | head -1 || true)"
worker="$(pgrep -f 'harvest-targeted' | head -1 || true)"

if [ -n "$worker" ]; then
  started="$(ps -p "$worker" -o lstart= 2>/dev/null | xargs || echo '?')"
  echo "  RUNNING   worker pid $worker (since $started)"
  [ -n "$wrapper" ] && echo "            wrapper pid $wrapper — will keep raising the quota"
elif [ -n "$wrapper" ]; then
  echo "  BETWEEN PASSES — wrapper pid $wrapper is about to start another"
else
  echo "  NOT RUNNING"
fi

# A held lock with no live owner means something died badly.
if [ -d .corpus.lock ]; then
  owner="$(python3 -c "import json;print(json.load(open('.corpus.lock/owner.json'))['pid'])" 2>/dev/null || echo '')"
  if [ -n "$owner" ] && ! kill -0 "$owner" 2>/dev/null; then
    echo "  STALE LOCK held by dead pid $owner — clears itself on the next run"
  fi
fi

# --- corpus ------------------------------------------------------------------
echo
echo "  corpus: $(wc -l < "$CORPUS" | tr -d ' ') puzzles"
echo

python3 - "$CORPUS" <<'PY'
import json, sys, collections
counts = collections.Counter()
for line in open(sys.argv[1]):
    e = json.loads(line)
    counts[(e['se_rating'], e['se_technique'])] += 1
width = max(len(t) for _, t in counts) if counts else 10
for (rating, technique), n in sorted(counts.items()):
    bar = '#' * min(n, 50)
    print(f"  {rating:>4}  {technique:<{width}}  {n:>4}  {bar}")
PY

# --- recent activity ---------------------------------------------------------
if [ -f "$LOG" ]; then
  recent="$(grep -c '^  + ' "$LOG" 2>/dev/null || true)"
  echo
  echo "  confirmed this session: ${recent:-0}"
  echo "  last 5:"
  grep '^  + ' "$LOG" 2>/dev/null | tail -5 | sed 's/^/  /' || echo "    (none yet)"
fi

echo
echo "  stop with:  pkill -INT -f harvest"
