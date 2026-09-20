#!/usr/bin/env bash
#
# Check whether the vendored SudokuExplainer reference has moved upstream.
#
# TSudoku's techniques are line-by-line ports of SE's Java, and "100% SE parity"
# is a claim about a *specific* SE commit. If upstream changes, the reference
# that claim is measured against has changed too, and the diff needs reading by
# hand — deliberately, not mechanically.
#
# Exit codes:
#   0 — up to date (or upstream unreachable, which is not a failure)
#   1 — upstream has new commits
#
# Usage: pnpm se:check

set -uo pipefail

SUBMODULE="tools/se-reference/SudokuExplainer-source"
PINNED_FILE="tools/se-reference/PINNED_COMMIT"

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root" || exit 0

if [ ! -d "$SUBMODULE/.git" ] && [ ! -f "$SUBMODULE/.git" ]; then
  echo "SE reference submodule is not initialized."
  echo "  git submodule update --init --recursive"
  exit 0
fi

current="$(git -C "$SUBMODULE" rev-parse --short HEAD 2>/dev/null)" || exit 0
current_date="$(git -C "$SUBMODULE" log -1 --date=short --pretty=%ad 2>/dev/null)"

# Record the pinned commit if we have not yet, so parity claims name a target.
if [ -f "$PINNED_FILE" ]; then
  pinned="$(tr -d '[:space:]' < "$PINNED_FILE")"
  if [ "$pinned" != "$current" ]; then
    echo "NOTE: checked-out SE commit ($current) differs from the pinned one ($pinned)."
    echo "      If this is intentional, update $PINNED_FILE and re-verify parity."
  fi
fi

if ! git -C "$SUBMODULE" fetch --quiet origin 2>/dev/null; then
  echo "Could not reach the SE upstream (offline?). Skipping check."
  echo "Reference pinned at $current ($current_date)."
  exit 0
fi

upstream_ref="$(git -C "$SUBMODULE" symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null || echo 'origin/main')"
behind="$(git -C "$SUBMODULE" rev-list --count "HEAD..$upstream_ref" 2>/dev/null || echo 0)"

if [ "$behind" -eq 0 ]; then
  echo "SE reference is up to date at $current ($current_date)."
  exit 0
fi

echo
echo "  SE reference has $behind new upstream commit(s)."
echo "  Local:    $current ($current_date)"
echo
git -C "$SUBMODULE" log --date=short --pretty='    %ad %h %s' "HEAD..$upstream_ref"
echo
echo "  Files changed in solver/rules (the ones that affect parity):"
changed="$(git -C "$SUBMODULE" diff --name-only "HEAD..$upstream_ref" -- 'diuf/sudoku/solver/rules' 2>/dev/null)"
if [ -z "$changed" ]; then
  echo "    (none — GUI/CLI changes only, parity is likely unaffected)"
else
  echo "$changed" | sed 's/^/    /'
fi
echo
echo "  Read the diff before porting anything. Do not apply changes mechanically:"
echo "    git -C $SUBMODULE diff HEAD..$upstream_ref"
echo
exit 1
