# TSudoku — Status & Backlog

> **Living document.** This is the honest snapshot of what works, what doesn't,
> and what's next. CLAUDE.md holds durable conventions; this file holds the
> moving parts. Update it as things land.

**Last updated:** 2026-09-19

---

## Current Focus

**Next up:** `@tsudoku/game` — the framework-free state layer — then a React
web app to play against the existing corpus.

**In flight:** nothing blocking. Board geometry is centralised and brute-force
analysis is ported, so game state can store a real `solution` field.

**Deliberately parked:** Phase 3/4 techniques, ML training, React Native.

---

## Where We Actually Are

Phase 1 is **complete and merged**, at **607/607 (100%) agreement with
SudokuExplainer**. The engine correctly identifies and rates every direct
technique in the SE 1.0–2.5 band.

Everything downstream of `@tsudoku/core` is an empty stub.

| Package                 | State         | Notes                                                           |
| ----------------------- | ------------- | --------------------------------------------------------------- |
| `@tsudoku/core`         | **Working**   | Phase 1 complete, 100% SE parity                                |
| `@tsudoku/solver`       | Stub          | `export const VERSION` and nothing else                         |
| `@tsudoku/generator`    | Stub          | same                                                            |
| `@tsudoku/cli`          | Stub          | same; `commander` already a declared dependency                 |
| `@tsudoku/react-native` | Stub          | same; intentionally deferred until web proves out               |
| `@tsudoku/game`         | Doesn't exist | Planned — see [The Architecture Split](#the-architecture-split) |
| `@tsudoku/web`          | Doesn't exist | Planned                                                         |
| `docs/` (VitePress)     | Working       | Deploys to tsudoku.dev via Vercel                               |
| `benchmarks/`           | Working       | SE parity runner + 607-puzzle corpus                            |

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
@tsudoku/game          game state — no UI, no React, no platform   [planned]
        ↓
   ┌────┴────┐
@tsudoku/web   @tsudoku/react-native      thin rendering layers    [planned]
```

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

## Backlog

Ordered by _what unblocks the game_, not by SE phase number.

### 1. Fix `applyHint` for eliminations — **hard gate**

`packages/core/src/models/GridImpl.ts`. The elimination branch computes
`newCandidates`, discards it with `void newCandidates`, and rebuilds from cell
values only. Harmless today (every Phase 1 technique emits a `DirectHint`) but
**Phase 2 is entirely elimination-based**. Nothing in Phase 2 works until this
is fixed.

### 2. `@tsudoku/game` — framework-free state layer

Per the split above. Build it alongside the first UI so the API is driven by
real usage, not speculation.

### 3. Web UI — playable against the existing corpus

Grid rendering, digit entry, pencil marks, undo/redo, hint button wired to the
existing engine explanations. 607 puzzles is plenty to build and iterate on.

### 4. Phase 2 techniques **+ generator, together**

Phase 2 is the on-device band (SE ≤ 4.4) and the techniques actually worth
teaching: Pointing, Claiming, NakedSet, HiddenSet, Fisherman (X-Wing,
Swordfish, Jellyfish), XY-Wing, XYZ-Wing.

The generator ships _with_ Phase 2 rather than after it, because Phase 2 has no
validation corpus — see [When To Generate](#when-to-generate).

### 5. Fill the corpus holes

DirectClaiming (1.9) and full house (1.0) have zero puzzles. Needed for both
validation and teaching content.

### 6. CLI commands, as the need arises

Built to serve testing/training, not speced up front. Highest value first:

- `tsudoku rate <puzzle>` — SE-comparable rating without the Java round-trip
- `tsudoku explain <puzzle>` — dump the full solve path; this is how lesson
  content gets authored
- `tsudoku gen` — once the generator exists

### 7. Tutor → lessons → React Native

Deterministic tutor layer, then lesson content, then the RN port.

### Explicitly not now

- **Phase 4 chain techniques** (SE 6.2+) — server-side, expert-facing, far from
  what a teaching app needs.
- **Phase 3 uniqueness techniques** — after Phase 2 proves out.
- **ML / model training** — blocked on the generator by deliberate rule. 607
  puzzles across 6 rating buckets is not a training set.

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

- **`applyHint` can't apply eliminations** — backlog #1, blocks Phase 2.
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
  marking them `"private": true` before a first release.
- **`PLAN.md` describes CI jobs that don't exist** (`coverage`, nyc, Codecov)
  and an `apps/showcase` that was never created. Treat it as historical intent,
  not a description of the repo.

---

## Recent Progress

Newest first. Keep entries short — what changed and why it mattered.

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
