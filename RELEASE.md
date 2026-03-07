# Release Process

TSudoku uses [Changesets](https://github.com/changesets/changesets) for versioning,
changelogs, and npm publishing. The process is automated via GitHub Actions but
requires some manual steps to initiate.

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

### Step 2: Changesets Bot Opens a Version PR

When changesets are merged to `main`, the `release.yml` workflow runs the
Changesets action, which:

1. Detects pending changesets
2. Opens a **"Version Packages"** PR that:
   - Bumps `version` in each affected `package.json`
   - Updates `CHANGELOG.md` in each affected package
   - Deletes the consumed `.changeset/*.md` files
3. This PR stays open and accumulates changes until you're ready to release

### Step 3: Review and Merge the Version PR

When you're ready to publish:

1. Review the Version PR — check version bumps and changelogs look correct
2. Merge it to `main`
3. CI runs all quality gates on the merge commit

### Step 4: Automated Publish

On merge of the Version PR, `release.yml` runs again and this time:

1. Detects no pending changesets (they were consumed)
2. Runs `pnpm changeset publish` which:
   - Builds all packages
   - Publishes changed packages to npm with provenance attestation
   - Creates git tags for each published version
3. The workflow creates a GitHub Release for each published package

---

## Quality Gates (enforced before any publish)

All of these must pass in CI before the Version PR can be merged:

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

### Publish fails with 403

The `NPM_TOKEN` doesn't have publish access to the `@tsudoku` scope, or the
scope doesn't exist on npmjs.org. Create the scope first by publishing any
package manually once.

### Provenance attestation fails

Make sure the GitHub Actions workflow has `id-token: write` permission and
`NPM_CONFIG_PROVENANCE=true` is set in the environment.
