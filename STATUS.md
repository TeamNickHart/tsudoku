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

**Next up: stage 2.3 — the generator**, which Phase 2 needs for a validation
corpus. `phase2.jsonl` is still empty, so Pointing and Claiming are registered
but not benchmark-validated (see the silent-pass problem below).

**Open questions, deliberately unresolved:**

- **Analytics and a backend** (2.7). Recorded in the backlog, not designed.
  The real decision is whether this project wants a server at all — that
  unlocks cloud saves, leaderboards and server-side chain techniques, and it
  also means hosting, cost and an attack surface the current static SPA does
  not have.
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

### 2.3 Generator — ships with Phase 2, not after

Phase 2 has **no validation corpus** (`phase2.jsonl` is empty), so each
technique lands unvalidated without it. Worse, the benchmark currently reports
PASS for a technique with zero puzzles, so the gap is silent.

The generator also fills the two Phase 1 holes — DirectClaiming (1.9) and full
house (1.0) — which the app needs before it can teach those lessons.

### 2.4 The tutor layer

This is where the decoration model pays off. The machinery already exists:
`hintDecorations()` turns a hint into targets with semantic roles, and the UI
already renders them. A tutorial step is the same shape.

What is missing is _sequencing_ — a lesson is an ordered list of steps, each
with decorations and a caption, advanced by the learner. Deterministic; no AI
needed at runtime.

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
