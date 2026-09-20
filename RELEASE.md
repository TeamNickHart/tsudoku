# Release Process

TSudoku uses [Changesets](https://github.com/changesets/changesets) for versioning
and changelogs. Version bookkeeping is automated; **publishing to npm is a
deliberate manual action** — it never happens as a side effect of a merge.

## Prerequisites

Before your first release, ensure these are configured:

### GitHub Repository Secrets

| Secret         | Purpose                                | How to get it                                          |
| -------------- | -------------------------------------- | ------------------------------------------------------ |
| `NPM_TOKEN`    | Publish packages to npmjs.org          | npmjs.org > Access Tokens > Generate (Automation type) |
| `GITHUB_TOKEN` | Automatic — provided by GitHub Actions | No setup needed                                        |

### npm Setup

- The `@tsudoku` scope must exist on npmjs.org
- The `NPM_TOKEN` must have publish access to the `@tsudoku` scope
- Every package has `"publishConfig": { "access": "public", "provenance": true }`

### Branch Protection (recommended)

- Require PR reviews before merging to `main`
- Require `ci-success` status check to pass
- Do not allow bypassing the above

---

## How Releases Work

Two workflows, deliberately separated:

| Workflow                    | Trigger                       | What it does                                                                                  |
| --------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------- |
| **Version** (`version.yml`) | automatic, on push to `main`  | Runs quality gates, then opens/updates the "chore: version packages" PR. **Never publishes.** |
| **Publish** (`publish.yml`) | **manual only** (Actions tab) | Runs quality gates, then publishes to npm.                                                    |

Publishing never happens as a side effect of merging. Someone has to open the
Actions tab and click it.

### Step 1: Create a Changeset

When you make a change that should be released, create a changeset:

```bash
pnpm changeset
```

This prompts you to:

1. Select which packages changed
2. Choose the semver bump type (patch / minor / major)
3. Write a summary of the change

This creates a `.changeset/*.md` file. Commit it with your PR.

### Step 2: The Version workflow opens a Version PR

When changesets land on `main`, `version.yml` runs the Changesets action, which:

1. Detects pending changesets
2. Opens a **"chore: version packages"** PR that bumps `version` in each
   affected `package.json`, updates each `CHANGELOG.md`, and deletes the
   consumed `.changeset/*.md` files
3. The PR stays open and accumulates changes until you're ready

### Step 3: Review and merge the Version PR

Check the version bumps and changelogs, then merge. Versions and changelogs are
now on `main` — but nothing has been published.

### Step 4: Publish, manually

Actions → **Publish** → _Run workflow_:

| Input     | Meaning                                                                           |
| --------- | --------------------------------------------------------------------------------- |
| `dry_run` | **Defaults to true.** Resolves and prints what would publish, without publishing. |
| `confirm` | Must be exactly `publish` for a real publish. Ignored for dry runs.               |

Run it once as a dry run to see what's about to ship. Then re-run with `dry_run`
unchecked and `confirm` set to `publish`.

The workflow refuses to publish if:

- `confirm` isn't `publish`
- `NPM_TOKEN` isn't set
- quality gates fail (a hard `needs:` dependency — a publish cannot start
  against a commit whose checks haven't passed)
- pending changesets exist (means the version PR wasn't merged, so
  `package.json` versions aren't what you think)

It also warns when any package is still at `0.0.0`, since `changeset publish`
ships every non-private package and several are still stubs.

---

## Current State: publishing is off

Nothing is on npm yet, deliberately. `NPM_TOKEN` is **not set**, so:

- The Version workflow runs normally and can open version PRs
- The Publish workflow will refuse a real publish

`@tsudoku/core` is the only package with real functionality; the other four
export a `VERSION` constant and nothing else. Publishing five packages where
four are hollow would be worse than publishing nothing.

**When you're ready for the first release:**

1. Create the `@tsudoku` scope on npmjs.org
2. Generate an Automation access token
3. Add it as the `NPM_TOKEN` repository secret
4. Consider marking the stub packages `"private": true` so only `core` ships
5. Run the Publish workflow as a dry run first

---

## Quality Gates (enforced before any publish)

Both the Version and Publish workflows run these as a `quality-gate` job that
everything else `needs:`. Publishing therefore cannot start against a commit
whose checks have not passed:

- `pnpm build` — all packages build successfully
- `pnpm typecheck` — no TypeScript errors
- `pnpm lint` — no ESLint errors
- `pnpm format` — Prettier formatting verified
- `pnpm test` — all tests pass (sharded across 3 runners)
- `pnpm benchmark` — SE parity thresholds met

---

## Manual / Emergency Release

If you need to publish outside the normal flow:

```bash
# 1. Make sure you're on main and up to date
git checkout main
git pull origin main

# 2. Verify all quality gates pass
pnpm build && pnpm typecheck && pnpm lint && pnpm format && pnpm test && pnpm benchmark

# 3. Version (applies changesets)
pnpm changeset version

# 4. Review changes, commit
git add .
git commit -m "chore: version packages"

# 5. Publish to npm (requires NPM_TOKEN or npm login)
pnpm changeset publish

# 6. Push commits and tags
git push --follow-tags
```

---

## Version Strategy

- **Pre-1.0:** All packages start at `0.0.0`. Use `0.x` minor bumps for
  breaking changes and `0.0.x` patches for fixes/features.
- **Post-1.0:** Follow semver strictly. Breaking changes = major bump.
- **Internal dependencies:** Changesets automatically bumps dependents.
  If `@tsudoku/core` gets a patch, `@tsudoku/solver` (which depends on it)
  also gets a patch bump.

---

## Troubleshooting

### "No changesets found"

You need to run `pnpm changeset` and commit the generated file before
the bot will open a Version PR.

### Publish workflow refuses to run

Check the failing step's message. The usual causes: `confirm` wasn't set to
`publish`, `NPM_TOKEN` isn't configured, or pending changesets still exist
(merge the version PR first).

### Publish fails with 403

The `NPM_TOKEN` doesn't have publish access to the `@tsudoku` scope, or the
scope doesn't exist on npmjs.org. Create the scope first by publishing any
package manually once.

### Provenance attestation fails

Make sure the GitHub Actions workflow has `id-token: write` permission and
`NPM_CONFIG_PROVENANCE=true` is set in the environment.
