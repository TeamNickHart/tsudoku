# Potential Improvements Over SE

Notes on places where we could improve on SE's algorithm — but haven't,
because the cardinal rule is to port faithfully first. Each item here is a
candidate for future discussion after SE parity is achieved.

---

## DirectPointing / DirectClaiming — naked single detection

**SE file:** `Locking.java` → `lookForFollowingHiddenSingles()`

SE's direct locking only looks for **induced hidden singles** in other regions.
It does NOT detect cases where removing a locked candidate from a cell in the
elimination line reduces it to a **naked single** (candidateCount → 1). This is
a valid deduction that SE misses in direct mode.

**Impact:** Some puzzles that could be solved with DirectPointing (1.7) at a
given step may instead require a harder technique in SE's solve path, because
SE doesn't see the naked-single induction.

**Status:** Noted. Our port now mirrors SE's approach (hidden single induction
only). Could revisit post-parity if we want to extend detection.

## DirectHiddenSet — naked single detection

**SE file:** `HiddenSet.java` → `createHiddenSetHint()` (isDirect branch)

Similarly, SE's direct hidden set only looks for induced hidden singles (other
digits whose positions in the region drop to 1 after removing the set cells).
It does NOT check if cells within the set become naked singles after removing
non-set candidates.

**Status:** Noted. Our port now mirrors SE's approach. Could revisit post-parity.
