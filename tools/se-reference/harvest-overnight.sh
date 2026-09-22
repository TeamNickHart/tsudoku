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
# To stop it, either works:
#
#   touch .harvest-stop                    # simplest, and what the wrapper uses
#   pkill -TERM -f harvest-overnight       # equivalent; the wrapper traps it
#
# The sentinel file is the mechanism that actually stops the WORKER. Its
# harvest loop is entirely synchronous, so Node never returns to the event loop
# and signals are never delivered to its JS handlers — `kill -TERM` on the
# worker does nothing, and only SIGKILL stops it, which strands its lock. The
# worker checks for this file between batches instead, and exits cleanly within
# a few seconds.
#
# Signals still work on the WRAPPER, because bash services them normally. Use
# TERM there, not INT: a backgrounded shell ignores SIGINT, and an ignored
# signal cannot be trapped.
#
# Safe to interrupt at any point: the harvester flushes after every
# confirmation, so at most one puzzle is ever in flight.

set -uo pipefail

HOURS="${1:-8}"
QUOTA="${2:-50}"
STEP="${3:-25}"

# Every Phase 2 rating, including 2.6, 2.8 and 4.2.
#
# Those three were once omitted on the theory that blind generation produces
# them in bulk. That reasoning does not survive contact with the corpus: they
# are the three THINNEST ratings (2.6 at 33, 2.8 at 11, 4.2 at 37) precisely
# because no targeted run has ever chased them. The local pre-filter discards
# anything not on this list, so an omitted rating is never banked at all —
# "generated in bulk" only helps if something keeps the results.
#
# They are also the cheapest to fill (hit rates 4.12%, 1.38% and 4.62%), so
# including them costs little and closes the widest gaps.
#
# Override by editing this line, or pass ratings after the positional args.
RATINGS=(2.6 2.8 3.0 3.2 3.4 3.6 3.8 4.0 4.2 4.4)

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root" || exit 1

STOP_FILE=".harvest-stop"
LOG="data/puzzles/harvest-overnight.log"
mkdir -p "$(dirname "$LOG")"

rm -f "$STOP_FILE"

deadline=$(( $(date +%s) + HOURS * 3600 ))
pass=0
worker_pid=""
stopping=0

# Without this, stopping the run is a fight: killing the worker just makes the
# loop start another, so the only thing that worked was killing the wrapper
# first and the worker second — which is not an interface anyone should have to
# remember. Now a single Ctrl-C (or kill) stops both.
stop() {
  stopping=1
  if [ -n "$worker_pid" ] && kill -0 "$worker_pid" 2>/dev/null; then
    echo "Stopping worker $worker_pid..." | tee -a "$LOG"

    # Ask via the sentinel file, NOT a signal.
    #
    # The worker's harvest loop is entirely synchronous, so Node never returns
    # to the event loop and a signal is never delivered to its JS handler at
    # all — `kill -INT` and `kill -TERM` both do nothing, which is why this
    # used to fall through to `kill -9`. That killed the worker mid-write and
    # stranded its lock directory, needing a manual `rm -rf .corpus.lock`.
    #
    # The worker checks for this file between batches and exits cleanly,
    # flushing and releasing the lock on its way out.
    touch "$STOP_FILE"

    for _ in $(seq 1 60); do
      kill -0 "$worker_pid" 2>/dev/null || break
      sleep 1
    done

    # Last resort. If this fires the worker was wedged somewhere unexpected;
    # its incremental flush means confirmed puzzles are still on disk, but the
    # lock may need clearing by hand.
    if kill -0 "$worker_pid" 2>/dev/null; then
      echo "Worker did not stop; forcing. Check for a stale .corpus.lock." | tee -a "$LOG"
      kill -9 "$worker_pid" 2>/dev/null
    fi
  fi
  rm -f "$STOP_FILE"
  echo "=== stopped $(date) after $pass pass(es) ===" >> "$LOG"
  exit 0
}
trap stop INT TERM HUP

{
  echo "=== overnight harvest started $(date) ==="
  echo "running for ${HOURS}h, quota ${QUOTA} climbing by ${STEP}"
} >> "$LOG"

while [ "$(date +%s)" -lt "$deadline" ]; do
  pass=$((pass + 1))
  echo "--- pass $pass (quota $QUOTA) $(date +%H:%M) ---" >> "$LOG"

  # --progress gives the log a heartbeat. Without it the only mid-run output
  # is a carriage-return counter, which vanishes when redirected — so the log
  # would sit silent for long stretches and look stalled.
  # Backgrounded and waited on, rather than run in the foreground: a foreground
  # child makes the shell defer the trap until it exits, which for a worker
  # stuck in an SE call can be half a minute.
  node tools/se-reference/harvest-targeted.mjs --progress=1000 "$QUOTA" "${RATINGS[@]}" \
    >> "$LOG" 2>&1 &
  worker_pid=$!

  # Poll rather than `wait`. Bash defers a trap until the current builtin
  # returns, and `wait` on a long-running child does not return for minutes —
  # so a trapped Ctrl-C would sit unhandled the whole time. Polling gives the
  # shell a chance to run the handler between sleeps.
  while kill -0 "$worker_pid" 2>/dev/null; do
    sleep 2
  done
  worker_pid=""

  [ "$stopping" -eq 1 ] && break

  # The worker exits on the sentinel without removing it, precisely so this
  # check can see it. Without this the wrapper would start a fresh pass and the
  # run could not be stopped by the sentinel at all.
  if [ -e "$STOP_FILE" ]; then
    echo "=== stopping: $STOP_FILE present ===" >> "$LOG"
    rm -f "$STOP_FILE"
    break
  fi

  # A pass that completes means every rating hit quota; raise it and continue.
  QUOTA=$((QUOTA + STEP))
done

{
  echo "=== finished $(date) after $pass pass(es) ==="
  echo "corpus now: $(wc -l < benchmarks/corpus/phase2.jsonl) puzzles"
} >> "$LOG"

echo "Done. See $LOG"
