# TSudoku — Status & Backlog

> **Living document.** This is the honest snapshot of what works, what doesn't,
> and what's next. CLAUDE.md holds durable conventions; this file holds the
> moving parts. Update it as things land.

**Last updated:** 2026-09-19

---

## Current Focus

**Stage 1 is done.** The app is playable and deployed: enter values, take
notes, undo, ask for a hint and get the engine's real technique explanation.

**Stage 2.1 and 2.2 are merged.** `applyHint` applies eliminations; Pointing
(2.6) and Claiming (2.8) are ported from `Locking.java`; auto-notes fill from
the engine's candidates and are cleared from peers when a value is placed.

**Stage 2.3 is done.** The generator is ported and `phase2.jsonl` holds 105
SE-rated puzzles, so Pointing and Claiming are finally validated against the
oracle — **33/33 and 11/11, both 100%**. They had been shipping with no
validation at all.

**Next up: stage 2.4 — the remaining Phase 2 techniques.** NakedSet, XWing,
HiddenSet, Fisherman, XY/XYZ-Wing. `Locking.ts` is a working template, and
`applyHint` already supports eliminations.

Worth knowing before starting: the corpus is thin exactly where those
techniques live — **one puzzle each at 3.2 (XWing), 3.8 (Swordfish) and 4.0
(HiddenTriplet)**. Implementing them is only half the job; they cannot be
validated until the corpus covers them. See 2.10.

**Open questions, deliberately unresolved:**

- **Analytics and a backend** (2.7). Recorded in the backlog, not designed.
  The real decision is whether this project wants a server at all — that
  unlocks cloud saves, leaderboards and server-side chain techniques, and it
  also means hosting, cost and an attack surface the current static SPA does
  not have.
- **Auto-solving "obvious" techniques.** Wanted eventually, behind a toggle:
  after a placement, re-derive candidates and fill any cell left with a single
  candidate. Deferred because the scope decision is not obvious — measured, a
  single placement cascades **~35 naked singles on HiddenSingle puzzles** (i.e.
  it solves the board) but only **~4 on DirectHiddenPair puzzles**. So the same
  feature is "a convenience" or "the app played your game" depending on the
  puzzle. Worth deciding what cascade depth is wanted before building.
- **Whether a filled cell should lock** once entered. Options weighed: lock fully (undo is the only way back), block
  overwrite but allow erase, or leave freely editable. The tension is that
  locking fights exploration — recovering from a wrong guess would mean
  discarding correct moves made since.

---

**Deployed:** `tsudoku-play` on Vercel (Root Directory `apps/web`). Custom
domain `play.tsudoku.dev` deferred until tsudoku.dev moves to Cloudflare.

**Deliberately parked:** Phase 3/4 techniques, ML training, React Native.

---

## Where We Actually Are

Phase 1 is **complete and merged**, at **607/607 (100%) agreement with
SudokuExplainer**. The engine correctly identifies and rates every direct
technique in the SE 1.0–2.5 band.

> **Parity is measured against SE commit `b1f9ed4` (2025-01-22)** — the pinned
> reference in `tools/se-reference/PINNED_COMMIT`. Run `pnpm se:check` to see
> whether upstream has moved. SE is effectively dormant (21 commits since 2006;
> none touching `solver/rules` since January 2023), so this should stay stable.

| Package                 | State       | Notes                                                  |
| ----------------------- | ----------- | ------------------------------------------------------ |
| `@tsudoku/core`         | **Working** | Phase 1 complete, 100% SE parity (~1250 lines)         |
| `@tsudoku/game`         | **Working** | State, moves, notes, history, decorations (~720 lines) |
| `@tsudoku/solver`       | **Working** | Brute force, uniqueness, solution strings (~310 lines) |
| `apps/web`              | **Working** | Playable, deployed (~820 lines)                        |
| `@tsudoku/generator`    | Stub        | `export const VERSION` and nothing else                |
| `@tsudoku/cli`          | Stub        | same; `commander` already a declared dependency        |
| `@tsudoku/react-native` | Stub        | same; intentionally deferred until web proves out      |
| `docs/` (VitePress)     | Working     | Deploys to tsudoku.dev via Vercel                      |
| `benchmarks/`           | Working     | SE parity runner + 607-puzzle corpus                   |

### Implemented techniques

All five producers are registered in `DEFAULT_PRODUCERS` in SE difficulty order:

| Technique            | SE rating       | Corpus | Validated |
| -------------------- | --------------- | ------ | --------- |
| `HiddenSingle`       | 1.0 / 1.2 / 1.5 | 204    | Yes       |
| `DirectPointing`     | 1.7             | 100    | Yes       |
| `DirectClaiming`     | 1.9             | **0**  | **No**    |
| `DirectHiddenSet(2)` | 2.0             | 103    | Yes       |
| `NakedSingle`        | 2.3             | 100    | Yes       |
| `DirectHiddenSet(3)` | 2.5             | 100    | Yes       |

---

## The Goal

A **fun, educational Sudoku game that teaches techniques** — web first, then
React Native. The engine is the means, not the end.

This is a hobby project and it should stay fun. It's also genuinely open source
(MIT): if someone finds tsudoku.dev and wants to contribute, the project should
be legible to them.

**Web first** because it iterates fastest. React Native follows once the ideas
are proven — which is why the architecture below matters.

---

## The Architecture Split

The engine is already pure (immutable, no I/O, no framework), so it runs
unmodified on Hermes. The risk is **game logic leaking into UI components** and
having to be rewritten for the RN port.

```
@tsudoku/core          pure engine — techniques, grid, solver      [working]
        ↓
@tsudoku/game          game state — no UI, no React, no platform   [working]
        ↓
   ┌────┴────┐
apps/web       @tsudoku/react-native      thin rendering layers
[working]      [planned]
```

The boundary is **enforced, not just documented**: importing `react`,
`react-dom` or `react-native` inside `packages/game/src` is an eslint error
that fails the build.

`@tsudoku/game` owns everything that is _the game but not the pixels_: current
puzzle, pencil marks, undo/redo, mistake tracking, hint requests, lesson
progression, timer, win detection, persistence as plain data.

**The rule that keeps the RN port cheap: a UI package may not contain a
decision.** Components render state and dispatch intents (`toggleMark(cell,
digit)`). If a component asks "is this move legal?" or "what's the next hint?",
that logic belongs in `@tsudoku/game`.

Two decisions worth making early, because they're expensive to retrofit:

- **Expose a plain store/reducer**, with a thin `useGame()` adapter per
  platform — not React-specific hooks that bake in web idioms.
- **Pencil marks are not candidates.** The engine's `candidates` bitmask is
  _truth_; the player's pencil marks are a separate, possibly-wrong user
  artifact. Conflating them is the classic Sudoku-app bug. Keep them distinct
  fields — the same bitmask utilities serve both.

---

## Stage 2 — make it teach

Stage 1 proved the game is playable. Stage 2 is about the thing that makes this
project worth doing: **the app should teach a technique, not just apply it.**

Right now the app can _name_ a technique and place its digit. It cannot yet
show you _why_ — because "why" almost always means "here is a candidate that
can be eliminated, and here is the reasoning", and the engine cannot represent
an elimination end to end.

### 2.1 Fix `applyHint` for eliminations — **the gate**

`packages/core/src/models/GridImpl.ts:159`. The elimination branch computes
`newCandidates`, throws it away with `void newCandidates`, and rebuilds from
cell values only.

Harmless so far — every Phase 1 technique emits a `DirectHint`. But **every
Phase 2 technique is elimination-based**, so nothing downstream works until
this is fixed. It is a small, well-understood change and it unblocks
everything else in this stage.

Note this also needs a `Grid` that can carry _explicit_ candidates rather than
always recomputing them from values, since an elimination is precisely a
candidate that logic removed but arithmetic would put back.

### 2.2 Phase 2 techniques (SE 2.6–4.4)

The on-device band, and the techniques actually worth teaching:

| Technique           | SE  | SE Java source   |
| ------------------- | --- | ---------------- |
| Pointing            | 2.6 | `Locking.java`   |
| Claiming            | 2.8 | `Locking.java`   |
| NakedPair / Triplet | 3.0 | `NakedSet.java`  |
| X-Wing              | 3.2 | `Fisherman.java` |
| HiddenPair          | 3.4 | `HiddenSet.java` |
| Swordfish           | 3.8 | `Fisherman.java` |
| XY-Wing / XYZ-Wing  | 4.2 | `XYWing.java`    |

Port order should follow SE difficulty, since that is also roughly teaching
order. Pointing and Claiming first: they are the simplest elimination
techniques and the first ones a learner meets after singles.

### 2.3 Generator — **next up**

This is not a new feature so much as **closing a hole that already exists**.
`Pointing` and `Claiming` are implemented, registered in `DEFAULT_PRODUCERS`
and shipping with **zero benchmark validation**, because `phase2.jsonl` is
empty — and the runner reports PASS for a technique with no puzzles, so the gap
is silent.

They were validated another way (8,756 eliminations across the Phase 1 corpus,
none unsound), but that proves the _logic_ is right, not that the _SE difficulty
ratings_ match. Only Phase 2 puzzles can show that.

#### What it ports

SE's `diuf/sudoku/generator/Generator.java` is 185 lines and already depends on
`BruteForceAnalysis`, which is ported. The algorithm:

1. Solve an **empty** grid with randomised digit order — a random solution _is_
   a random completed board.
2. Shuffle a list of the 81 cell indexes.
3. Repeatedly pick a cell, clear it (plus its symmetric partners), and keep the
   removal only if the puzzle still has **exactly one solution** — which is
   `countSolutions`, already ported.
4. Stop when no further cell can be removed.

#### The one real gap

`solveRandom` is the same recursive `analyse` already ported, except SE takes a
`Random` and rotates the digit order:

```java
firstValue = rnd.nextInt(9);
value = ((value0 + firstValue) % 9) + 1;
```

The TSudoku port **omitted that branch**, so it always solves ascending and
would return the identical grid every time. Restoring it is small, and it is a
prerequisite: without it there is no random solution to carve a puzzle from.

Seeding the RNG explicitly is worth doing — a reproducible corpus is far easier
to debug and to diff than one that changes every run.

#### Symmetry

`Symmetry.java` (179 lines) supplies the point-reflection patterns that make
puzzles look hand-made — rotational, diagonal, mirror, and none. Worth porting
for aesthetics, but **not on the critical path**: "no symmetry" generates valid
puzzles and is the simplest case to start from.

#### Then: rate and bucket

Generation produces _puzzles_; the corpus needs _rated_ puzzles. The existing
intake pipeline (`tools/se-reference/intake.sh`) already rates via the real SE
CLI and sorts into `verified/` or `rejected/`, and `build-corpus.sh` buckets by
rating into `phaseN.jsonl`. So the generator feeds machinery that already
exists rather than needing new plumbing.

#### What this unblocks

- Phase 2 techniques get real SE-rating validation instead of a silent PASS
- The two **Phase 1 corpus holes** get filled — `DirectClaiming` (1.9) and full
  house (1.0) both have zero puzzles today, so the app cannot teach either
- Puzzle supply for the app stops being 30 hand-picked entries
- Model training becomes possible at all (deliberately gated behind this)

#### Ordering

1. Add randomised digit order to `BruteForceAnalysis` (the gap above)
2. Port `Generator.generate` with no symmetry
3. Generate, rate through the existing SE intake, and fill `phase2.jsonl`
4. Fill the two Phase 1 holes
5. Port `Symmetry` for better-looking puzzles
6. Wire `tsudoku gen` in the CLI

### 2.8 Render performance — **confirmed, not yet fixed**

Values entered deep into a game lag noticeably: "enter a value and a fraction
of a second later the view updates". Measured once in a browser at **332ms**
for a single entry on a fully-noted board, against ~11ms for the same action on
an empty one. The spike was not reproducible on later attempts from a hidden
browser pane, where `requestAnimationFrame` does not fire and React batches
updates out of reach of a synchronous timer — so the number is real but the
measurement method needs to be better before and after any fix.

**The game layer is not the cause.** Profiled directly: `boardView` is
0.06–0.09ms, `toGrid` 0.045ms, `digitCounts` 0.007ms, and all of them stay flat
as history grows (102 moves made no difference). Undo, which replays the whole
history, is 0.064ms.

**The likely cause is React, and it is confirmable by inspection:** there is
**no memoization anywhere** in the web app. No `React.memo` on `Cell` or
`Board`, so every state change re-renders all 81 cells, each noted cell
rebuilding a 9-element note grid. `useDragSelect`'s `cellProps(index)` also
returns a fresh object per cell per render, so even adding `memo` would not
help until those handler identities are stable.

**What to do:**

1. Get a reliable measurement first — React DevTools Profiler, or
   `performance.mark` around commits, with the pane visible. Fixing an
   unmeasured performance problem is how you end up with memoization that
   costs more than it saves.
2. `React.memo` on `Cell`, keyed on the `CellView` it receives.
3. Stabilise handler identity in `useDragSelect` so memo can actually bail out.
4. Re-measure. Only keep what demonstrably helped.

### 2.9 CI: skip irrelevant work for docs-only changes

Every PR runs the full suite — build, typecheck, lint, format, 3 test shards,
the SE benchmark, and a web build — even when the change touches only
`docs/`, `README.md` or `STATUS.md`. That is slow and wasteful for the many
documentation PRs this project produces.

Markdown changes should still be validated (prettier, and link checking would
be a real addition), but there is no reason to re-run the engine benchmark for
a typo fix.

The mechanism is `dorny/paths-filter` or GitHub's own `paths`/`paths-ignore` on
the workflow. The wrinkle worth knowing: `ci-success` is a required status
check, so skipped jobs must still report success or every docs PR blocks on a
check that never runs. That is the part to get right, not the filtering itself.

### 2.10 Corpus at scale — background generation, laddering, publishing

The harvest that filled `phase2.jsonl` makes the shape of this clear. Recorded
now because two of the three ideas need care.

#### Background generation — straightforward, do it

A long-running local process generating and rating puzzles is the obvious way
to reach hundreds per difficulty. `harvest.sh` already does the work; it needs
a wrapper that runs continuously, appends to `data/puzzles/verified/`, and
dedupes. A `launchd` job is the macOS-native option.

Throughput measured: generation is ~0.1s per puzzle, SE rating ~0.04s, and the
yield into a given phase band is about 12%. So roughly **1000 generated per
hour of wall clock**, giving ~120 Phase 2 puzzles per hour unattended. Reaching
"hundreds at every level" is a weekend, not a project.

The real constraint is **not** throughput but distribution — see below.

#### Laddering one solution into several puzzles — appealing, but the premise is wrong

The idea: carve an easy puzzle, remove more clues for a medium, more again for
hard. It would be a large efficiency win, since the expensive part (the
uniqueness check) is shared.

**Measured, difficulty is not monotonic in clue count.** From the sample of 20:

| Clues | Ratings observed  |
| ----- | ----------------- |
| 22    | 5.6, 7.1          |
| 23    | **1.5**, 2.8      |
| 24    | **1.5**, 6.6, 6.7 |
| 26    | **1.2**, 7.1      |

A 26-clue puzzle rated 1.2 and another rated 7.1. Removing clues _tends_ to
make a puzzle harder, but which specific clues you remove matters far more than
how many — a puzzle stays easy while it still yields to singles, and jumps
sharply once it does not.

So the ladder cannot assume "fewer clues = next difficulty up". What _would_
work is generating a ladder speculatively and **rating every rung**, keeping
whichever rungs land in bands that need filling. That still shares the
generation cost and is worth doing — it just cannot skip the SE rating step,
which was the appeal.

#### Publishing the corpus — cheap, and the most externally valuable thing here

The puzzles are already in the repo under `benchmarks/corpus/`, so anyone can
take them. Worth doing anyway:

- A documented, stable download (GitHub Releases is free and versioned; a CDN
  bucket is unnecessary at this size — 105 puzzles is ~12KB)
- A **licence decision**. The Open Decisions list in CLAUDE.md already asks
  whether the corpus should be CC0. It should be settled before publishing,
  not after.
- SE-verified puzzles _with their technique labels_ is a genuinely useful
  artefact that does not obviously exist elsewhere. It is the most likely
  reason someone else would find this project.

#### How many puzzles exist, and what to expect

The counted answer: there are **6,670,903,752,021,072,936,960** valid completed
grids (Felgenhauer & Jarvis, 2005), or **5,472,730,538** once symmetry is
factored out. Puzzles — distinct minimal clue sets — are far more numerous
still and have never been counted. Supply is not a constraint at any scale this
project will reach.

Difficulty, though, is severely lopsided. Measured over 800 generated puzzles,
the per-rating hit rate and the time to bank 1000 of each:

| SE  | Technique     | Hit rate | Generated per hit | Hours to 1000 |
| --- | ------------- | -------- | ----------------- | ------------- |
| 2.6 | Pointing      | 4.12%    | 24                | **0.7**       |
| 4.2 | XYWing        | 4.62%    | 22                | **0.6**       |
| 2.8 | Claiming      | 1.38%    | 73                | 2.0           |
| 3.0 | NakedPair     | 0.88%    | 114               | 3.2           |
| 3.4 | HiddenPair    | 0.75%    | 133               | 3.7           |
| 4.4 | XYZWing       | 0.75%    | 133               | 3.7           |
| 3.6 | NakedTriplet  | 0.25%    | 400               | 11.1          |
| 3.2 | XWing         | 0.12%    | 800               | **22.2**      |
| 3.8 | Swordfish     | 0.12%    | 800               | **22.2**      |
| 4.0 | HiddenTriplet | 0.12%    | 800               | **22.2**      |

At ~10 puzzles/second end to end, 1000 of _every_ Phase 2 rating is roughly
**90 hours** of wall clock — a few unattended days, entirely feasible. But the
last three ratings account for two thirds of that, and the rare-rating figures
rest on a single observation each, so treat them as order-of-magnitude.

Note the two **Phase 1 holes behave the same way**: 1.0 (full house) and 1.9
(DirectClaiming) did not appear once in 800 puzzles. They are not missing
because of an oversight in the original intake; they are simply rare.

**1000 per level is more than needed.** ~100 per technique already satisfies
the benchmark's purpose and the app's teaching levels. Beyond that the value is
ML training data, which is gated behind other work anyway. A quota of 100–200
reaches useful coverage in a few hours rather than days.

#### Can generation target a specific technique?

Yes, and it is the single highest-value improvement to this pipeline — it turns
22 hours into minutes for the rare ratings.

The trick is that **TSudoku can already detect these techniques itself**.
Rather than generate blindly and ask SE afterwards, the daemon can filter
_before_ paying for an SE call:

1. Generate a candidate.
2. Solve it locally with `DEFAULT_PRODUCERS`, recording which techniques fire.
3. Discard immediately unless the wanted technique appears.
4. Only then spend an SE rating call to confirm.

The local solve is ~2ms against ~40ms for an SE round trip, so the filter is
nearly free and rejects ~99% of candidates for a rare rating before the
expensive step.

The catch, and it is a real one: this only works for techniques TSudoku has
implemented. XWing, Swordfish and HiddenTriplet — precisely the three rarest —
are **not implemented yet**, so they cannot be pre-filtered until 2.4 lands.
Which is a neat circularity: implementing them makes it cheap to generate the
puzzles needed to validate them.

A weaker but immediately available version: generate, solve locally, and reject
anything the current producers solve _completely_. That alone removes the
easy puzzles that dominate the sample.

#### The actual constraint: distribution, not volume

`phase2.jsonl` came out badly skewed — 33 at 2.6 and 37 at 4.2, but **one
puzzle each at 3.2 (XWing), 3.8 (Swordfish) and 4.0 (HiddenTriplet)**. Random
generation simply does not produce those ratings often.

More volume alone will not fix this; it will produce more 2.6s and 4.2s at the
same ratio. Filling the thin ratings needs targeted work — generate, rate,
discard anything already well covered — which is exactly what a background
process should be doing rather than blind accumulation.

### 2.4 The tutor layer

This is where the decoration model pays off. The machinery already exists:
`hintDecorations()` turns a hint into targets with semantic roles, and the UI
already renders them. A tutorial step is the same shape.

What is missing is _sequencing_ — a lesson is an ordered list of steps, each
with decorations and a caption, advanced by the learner. Deterministic; no AI
needed at runtime.

### 2.4a Teaching order is not SE rating order

A data point from the only player this project currently has: X-Wing, XY-Wing
and XYZ-Wing are comfortable; Swordfish is the hard one; the "rectangle"
techniques are shaky.

That **contradicts SE's ordering**. SE puts Swordfish at 3.8, _easier_ than
XY-Wing at 4.2. The human experience is the reverse, and the reason is
structural rather than personal: **SE's rating measures search cost for a
solver, not cognitive load for a person.** A Swordfish spans three rows and
three columns and has to be held in the head at once; an XY-Wing is three cells
with a clear local story.

So the teaching sequence should not simply be `TECHNIQUE_DIFFICULTY` sorted
ascending. Some specific consequences:

- **Swordfish should be taught as "X-Wing, but 3x3"**, not as an unrelated
  technique at its own level. Same logic, more spatial load — and if X-Wing
  already clicks, that framing does most of the work. Jellyfish (5.2) is the
  same pattern again at 4x4 and belongs in the same lesson family.
- **"Rectangle" is doing damage as a word.** Pointing and Claiming are _not_
  rectangles — they are locked candidates, a digit confined to one line within
  a box or one box within a line. Purely linear. Unique Rectangle (Phase 3) is
  an actual rectangle _and_ a different kind of argument: it reasons from "a
  valid puzzle has exactly one solution, so this pattern cannot occur", which
  is uniqueness reasoning rather than constraint reasoning. Lessons should name
  that difference rather than let the shared word imply a shared idea.
- **Lesson order wants its own data.** This is exactly the "human difficulty
  vs SE rating" signal deprioritised in 2.7, and one player has now supplied a
  point of it. Worth revisiting once there are a handful of players — where
  people actually stall is more useful than where SE says they should.

Nothing here blocks 2.4. It changes how the techniques are _presented_ once
the tutor layer exists, not whether they are ported.

### 2.5 Notes UX

The model supports more than the UI exposes:

- **Multi-select** — `applyToSelection` works, but the UI only shift-clicks.
  Drag-select is the natural gesture.
- **Auto-notes** — fill every cell's included notes from the engine's real
  candidates. One button, high value, and it makes the stale-note highlight
  much more interesting.
- **Excluded notes** are enterable but have no dedicated affordance beyond the
  mode toggle.

### 2.6 CLI, as it becomes useful

- `tsudoku rate <puzzle>` — SE-comparable rating without the Java round-trip
- `tsudoku explain <puzzle>` — dump a full solve path; **this is how lesson
  content gets authored**
- `tsudoku gen` — once the generator exists

### Stage 2 ordering

1. `applyHint` eliminations — gates everything
2. Pointing + Claiming — the first elimination techniques, and a real test of 1
3. Generator + corpus for Phase 2
4. Remaining Phase 2 techniques
5. Tutor layer + first lessons
6. Notes UX and CLI, opportunistically
7. Analytics and invite-only access (2.7) — last, and gated on wanting a backend

Opportunistic, not blocking: render performance (2.8) and CI path filtering
(2.9). Both are small and independent of the technique work.

### 2.7 Analytics and invite-only access — **backlogged, after Phase 2 + generator**

Not to be built yet. Recorded so the design decisions are not re-litigated
later, and so nothing built in the meantime forecloses them.

**What it is for**, in priority order:

1. **Errors and crashes.** Useful with three players — one report is
   actionable. Worth doing properly whenever it happens.
2. **Product analytics.** Retention, session length, where players abandon,
   which features get used. Needs volume to mean anything, which is the
   argument for waiting rather than the argument against doing it.

Explicitly _not_ in scope for now: instrumenting whether the teaching works, or
calibrating human difficulty against SE ratings. Both are interesting and both
want a schema designed around lessons that do not exist yet.

**Access model.** Invite-only to start: email sign-in links, users invited by
the maintainer are opted in to data collection as a condition of the
invitation. That avoids a consent dialog nobody reads while still being
honest, and it means the small early player base produces usable data. A public
opt-in comes later, and should show people exactly what is collected — that
transparency screen is a feature in its own right, not a checkbox.

**Identity.** Auth identity and analytics identity are **separate IDs with no
stored mapping**. Events carry a random on-device ID; the server never links it
to an account. This matters for the wording as much as the data: once a server
knows an email _and_ holds that person's event stream, "anonymous" is only true
if the join is impossible by construction. Keeping them unlinked means the
claim survives someone reading the source, which a project courting
contributors should care about.

**The architectural consequence, stated plainly.** The app is currently a
static SPA on a CDN — no server, no database, no secrets. Magic-link sign-in
needs all four: somewhere to store users and sessions, an email provider, and a
session mechanism. That is the largest structural change on this roadmap,
larger than the generator, and it is the real reason this is backlogged rather
than the analytics itself.

Leaning Upstash for session storage (serverless, HTTP, key TTL is session
semantics). Note QStash is Upstash's _message queue_, not a session store —
Upstash Redis is the right product there. Tinybird is a reasonable fit for the
event sink if this grows into real analytical querying; for errors alone it is
heavier than needed.

**Access is already gated today**, and it was by default. `tsudoku-play` has
Vercel Authentication enabled: an unauthenticated request for the page _or_ for
the JS bundle redirects to Vercel's login rather than serving bytes. Verified
by requesting `/assets/index-*.js` directly and landing on the login page.

That is worth knowing because the obvious alternative does not work. The app is
a static SPA, so a passphrase checked in the client is not a gate: Vercel
injects env vars at build time, so the value is baked into the bundle and
readable in devtools — and the bundle, engine and all 30 puzzles have already
been downloaded before any prompt could render. A client-side check is an
honest "not public yet" sign, not access control. Deployment Protection is
the only option that stops bytes reaching an unauthorized browser, and it is a
project setting rather than code.

The practical consequence: sharing with an invited player before 2.7 means
either adding them to the Vercel team, or switching to shared-password
protection (Pro plan), or generating a share link.

**Sequencing.** After Phase 2 and the generator. Instrumenting a game whose
shape is still changing means designing a schema twice.

### Explicitly not now

- **Phase 4 chain techniques** (SE 6.2+) — server-side, expert-facing, far from
  what a teaching app needs.
- **Phase 3 uniqueness techniques** — after Phase 2 proves out.
- **ML / model training** — blocked on the generator by deliberate rule. 607
  puzzles across 6 rating buckets is not a training set.
- **React Native** — after the web app proves the ideas. The architecture is
  ready; the content is not.

---

## When To Generate

The corpus is 607 unique puzzles covering **6 of 8** Phase 1 ratings. Every
bucket is capped at ~100, and two were never filled.

**For play, the existing corpus is fine.** ~100 puzzles per technique level is
a year of daily play without repeats. Don't build the generator for volume.

Three triggers say otherwise:

| Trigger            | Status          | Why it matters                                   |
| ------------------ | --------------- | ------------------------------------------------ |
| Coverage holes     | **Tripped now** | DirectClaiming and full house have 0 puzzles     |
| Phase 2 validation | **Trips at #4** | `phase2/3/4.jsonl` are all empty                 |
| Gameplay volume    | Not yet         | 607 unique puzzles is plenty to play and iterate |

So the generator exists for **validation and coverage**, not play volume.

### The silent-pass problem

`benchmarks/runner.ts` filters corpus entries to implemented techniques. A
technique with **zero** corpus puzzles therefore contributes zero failures and
the benchmark reports **PASS**.

This is live right now: DirectClaiming has never been validated against SE, and
CI is green. Every Phase 2 technique will have the same hole as it lands. The
"benchmark is a CI gate" guarantee is only as good as the corpus behind it.

_Tracked as a follow-up: make unvalidated techniques a visible failure._

---

## Where AI Fits

The engine already emits grounded, precise explanations for every hint:

> `Pointing: 5 in box 4 is confined to column 1, placing 5 in R9C2`

…along with `involvedCells` and `involvedCandidates`. **The deterministic tutor
is mostly already built.** That reframes where AI earns its place.

Guiding principle: **AI at build time, determinism at runtime.** Costs stay near
zero, correctness stays in the engine where it's already proven.

| Use                              | Verdict        | Reasoning                                                                |
| -------------------------------- | -------------- | ------------------------------------------------------------------------ |
| Authoring lesson content offline | **Best value** | Zero runtime cost/risk, reviewed before shipping, attacks the real gap   |
| "Why am I stuck?" coaching       | **Worth it**   | Mostly a deterministic lookup; AI only phrases the diagnosis             |
| Rewording hints at runtime       | **Skip/defer** | Pays per call to restate what's already correct, and can introduce error |

For "why am I stuck?", build the deterministic diagnosis first — the engine
knows every applicable hint and its difficulty, and the corpus is grouped by
technique, so "you need an X-Wing here, and here's the lesson" is a _lookup_.
An AI layer on top is optional polish.

> Per-call cost estimates are not recorded here because they'd be guesses. Look
> up current model pricing before committing to any runtime AI feature.

---

## Known Issues

- **`applyHint` can't apply eliminations** — see [2.1](#21-fix-applyhint-for-eliminations--the-gate). Gates all of Phase 2.
- **Benchmark silently passes techniques with no corpus** — see above.
- **DirectClaiming is unvalidated** — implemented, registered, zero test puzzles.
- **`pnpm benchmark --technique <name>` doesn't exist.** Referenced by
  PORTING.md step 7 and by the PR template; the runner only parses `--phases=`.
- **`Solver.getNextHint` re-runs all producers from scratch** on every call, and
  a full solve calls it ~53 times. That's the 1.8ms/puzzle figure — fine for
  now, worth knowing before optimizing.
- **Nothing is published to npm yet, deliberately.** `NPM_TOKEN` is unset and
  publishing is a manual workflow (`publish.yml`), so nothing reaches npm
  without a deliberate click. See RELEASE.md. Note `changeset publish` ships
  _every_ non-private package — four of the five are still stubs, so consider
  marking them `"private": true` before a first release. `apps/web` is already
  private, so it is not affected.

- **Two Vercel projects watch this repo** — `tsudoku` (docs → tsudoku.dev) and
  `tsudoku-play` (the app). Every PR gets two previews. Don't enable Vercel's
  "only build when root directory changes" on the app: it depends on `core`,
  `game` and `solver`, so an engine change must trigger a rebuild.
- **`PLAN.md` describes CI jobs that don't exist** (`coverage`, nyc, Codecov)
  and an `apps/showcase` that was never created. Treat it as historical intent,
  not a description of the repo.

---

## Recent Progress

Newest first. Keep entries short — what changed and why it mattered.

### 2026-09-20 (late)

- **Board rendering fixed, twice.** Both were valid CSS producing wrong
  geometry — the kind of bug a green build cannot catch.
  1. Cells drew their grid lines as CSS borders, which sit _inside_ the
     element's box, so a cell on a box boundary had 2px less content than its
     neighbours. Measured a 69/70/71px spread, which pushed digits and note
     sub-grids visibly off-grid. Replaced with overlays that take no layout
     space; content boxes are now a single uniform value.
  2. Even then, box boundaries rendered as _broken_ lines. Drawing rules per
     cell meant a boundary was nine independent segments, and sub-pixel offsets
     (279.992 vs 280 across one boundary) put them on different device pixels.
     Grid lines are now 16 full-span elements drawn once on the board, so a
     line is either fully drawn or not drawn at all.
- Lesson worth keeping: measuring the DOM found both. The first board looked
  fine in a screenshot, and the second only showed up once a real screenshot
  was compared against expectations.

### 2026-09-20 (evening)

- **Phase 2 is open.** `applyHint` now applies eliminations — it preserves each
  cell's candidate mask instead of recomputing from values, which was right for
  a placement and exactly wrong for an elimination.
- **Pointing and Claiming ported** from SE's `Locking.java`. Validated beyond
  unit tests: across all 607 corpus puzzles the two producers proposed **8,756
  eliminations**, and checked against brute-forced solutions, **none** removed a
  digit that actually belonged.
- **Auto-notes** (`fillNotes`) — fills empty cells with the engine's real
  candidates, one history entry per cell so it undoes gradually.
- **Drag to select, tap to toggle.** Two bugs found only by driving a browser:
  `pointerenter` never fires during a touch drag (implicit pointer capture), so
  the obvious implementation works with a mouse and silently fails on a phone;
  and listeners registered in an effect dropped the opening moves of a fast
  drag, since effects run after React commits.
- Confirmed the web app is **already good on mobile** at 375x812 — tap to
  select, tap a digit to enter. React Native deferred: the architecture is
  ready, the design isn't settled, and building both now would double
  iteration cost during the phase where the UI is still being discovered.

### 2026-09-20

- **Deployed.** `tsudoku-play` on Vercel, production green, verified by playing
  it in a browser: entered a digit, asked for a hint, got "HiddenSingle: 1 can
  only go in R3C1 in box 1" from the engine running client-side.
- **First deploy failed** with `Cannot find module '@tsudoku/core'`. Not an npm
  publishing problem — the build command built only `@tsudoku/web`, so its
  workspace dependencies never produced the `dist/index.d.ts` files TypeScript
  needed. It passed locally only because `dist/` was already there. Fixed by
  using `turbo build --filter=@tsudoku/web`, which walks the dependency graph.
- **CI was green while the deploy was broken**, which was the real defect.
  `pnpm build` builds everything, so it cannot catch a _filtered_ build that
  omits a dependency. Added a `build-web` job running Vercel's exact command
  from a clean checkout, asserting the artifact exists.

### 2026-09-19 (evening)

- **`apps/web` is playable.** Vite + React + TypeScript + Tailwind + shadcn/ui.
  Renders the board, enters values, three input modes (value / note / strike),
  undo/redo, error detection, and a hint panel wired to the real engine.
  Verified in a browser, not just compiled.
- **The teaching mechanic already works.** Pencil a note for 4, enter a 4
  elsewhere in the row, and the note turns orange — `staleNotes` firing with no
  tutorial code written.
- **Decorations round-trip end to end**: engine hint → `hintDecorations()` →
  semantic role → CSS token → ring on exactly the cell the hint named.
- 212KB built, 62KB gzipped, for the whole engine + solver + UI.
- Fixed the root eslint config, which had no `apps/*` entry in
  `parserOptions.project` and so could not parse a single app file.

### 2026-09-19 (later still)

- **`@tsudoku/game` built** — the framework-free state layer. Plain data, plain
  reducer, no React. Holds the puzzle and solution as 81-char strings and
  derives a `Grid` on demand: state is **815 bytes** where a serialized `Grid`
  is **40,280**, and it round-trips through JSON intact.
- **History is moves, not snapshots.** Undo replays from the givens, which keeps
  history a plain serializable list and gives a complete move log for free —
  useful later for "show me where I went wrong".
- **Pencil marks stay separate from candidates**, as designed. `cellView`
  exposes `staleMarks` — marks the board has since ruled out — which is exactly
  the teaching moment a tutor wants to point at.
- **A lint rule now enforces the boundary**: importing React (or react-dom or
  react-native) inside `packages/game/src` is a build error, not a convention.
  Verified it actually fires.
- 35 tests, including one that solves a whole puzzle by following hints alone
  and asserts no errors are ever introduced.

### 2026-09-19 (later)

- **Brute-force analysis ported** to `@tsudoku/solver` — a line-by-line port of
  SE's `BruteForceAnalysis.java`. Solves via SE's forward/reverse trick: both
  directions agree iff the puzzle has exactly one solution. Verified against all
  607 corpus puzzles (all solved, all structurally valid, all givens preserved,
  1.0ms/puzzle) plus uniqueness on a 60-puzzle sample.
- **`NoDoubles` ported alongside it**, because SE's own docstring warns the
  analysis is "extremely slow" on a grid with a doubled value. It was: a
  contradictory grid took **3.1s**, and the structural pre-check took the
  solver test suite from **6343ms to 52ms**.
- **Board geometry centralised** in `models/board.ts` (`SIZE`, `BOX_WIDTH`,
  `BOX_HEIGHT`, `CELL_COUNT`, `rowOf`/`colOf`/`boxOf`/`indexOf`). Groundwork for
  variant board sizes; the engine stays 9x9. Techniques deliberately keep their
  literal `9`s, since each mirrors a `9` in the SE Java source.

### 2026-09-19

- **Release process reworked into two workflows.** `version.yml` (automatic)
  opens version PRs and never publishes; `publish.yml` (manual dispatch only)
  publishes, behind a dry-run default, a typed confirmation, and the quality
  gates as a hard `needs:` dependency. npm publishing stays off until
  `NPM_TOKEN` is deliberately set.
- **CI and release moved to Node 24** (#5). Actions had begun warning that Node
  20 is deprecated on its runners, and local dev was already on 24. `engines`
  intentionally stays at `>=20` — that's a statement about consumers, not CI.

### 2026-09-16

- **Phase 1 merged to main** (#1) after six months unmerged — 607/607 SE parity.
- **Three pre-existing CI failures fixed**, all hidden by the hiatus:
  - `pnpm format` was failing on the vendored SE submodule (CI never saw it,
    since CI checks out without submodules).
  - The Release workflow had failed on _every_ push since March: `npm whoami`
    ran unconditionally with no `NPM_TOKEN` set (#2).
  - Changesets was broken repo-wide — `.changeset/config.json` ignored a
    `showcase` package that never existed, so even `changeset status` threw.
    Fixing it also revealed the action was attempting **OIDC trusted publishing**
    on every push to main; only the config error had been stopping it (#4).
- **Docs refocused** around the teaching-app goal (#3): STATUS.md created,
  README rewritten, CLAUDE.md corrected, PORTING.md's contradiction of the
  Cardinal Rule resolved.
