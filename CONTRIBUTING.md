# Contributing Guide

## Branch Protection Requirements

The `main` branch is protected. All pull requests targeting `main` **must** have the following CI status checks pass before merging:

| Required check | Workflow job | What it verifies |
|---|---|---|
| `check-codegen` | `.github/workflows/ci.yml` → `check-codegen` | Generated API client and Zod schemas match `openapi.yaml` |
| `typecheck` | `.github/workflows/ci.yml` → `typecheck` | Full TypeScript typecheck across all workspace packages |

Both checks run automatically on every pull request via the CI workflow. A PR cannot be merged until both pass.

### Configuring Branch Protection (repository admin)

Branch protection rules must be set in GitHub repository settings. Run the automated setup workflow to apply them, or configure them manually.

#### Option A — Automated setup (recommended)

1. Go to **Actions → Setup Branch Protection** in the GitHub repository.
2. Click **Run workflow** and confirm.
3. The workflow uses `GITHUB_TOKEN` with admin scope to apply the rules via the GitHub REST API.

> **Note:** `GITHUB_TOKEN` must have `administration: write` permission. If the workflow lacks this permission, configure the rules manually (Option B).

#### Option B — Manual setup

1. Go to **Settings → Branches** in the GitHub repository.
2. Add a branch protection rule for `main` (or edit the existing one).
3. Enable **Require status checks to pass before merging**.
4. Search for and add both required checks:
   - `Check API codegen is up to date` (job id: `check-codegen`)
   - `TypeScript typecheck` (job id: `typecheck`)
5. Enable **Require branches to be up to date before merging**.
6. Save the rule.

## Local Development Checks

The same checks that CI runs are also enforced locally:

- **Pre-commit hook** — `pnpm run check:codegen` runs automatically before every commit via `simple-git-hooks`. It blocks commits where `openapi.yaml` has been modified without regenerating the client/schemas.

To install the hook in a fresh clone:

```bash
pnpm install   # triggers the prepare script which calls simple-git-hooks
```

- **Typecheck** — run `pnpm run typecheck` before pushing to catch type errors early.

## Workflow: adding or changing API endpoints

1. Edit `lib/api-spec/openapi.yaml`.
2. Run `pnpm --filter @workspace/api-spec run codegen` to regenerate client hooks and Zod schemas.
3. Update route handlers in `artifacts/api-server/src/routes/`.
4. Run `pnpm run typecheck` to confirm everything compiles.
5. Open a pull request — CI will re-verify steps 2 and 4.
