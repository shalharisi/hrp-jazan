# Contributing Guide

## Branch Protection Requirements

The `main` branch is protected. All pull requests targeting `main` **must** satisfy the following requirements before merging:

### Required CI status checks

| Required check | Workflow job | What it verifies |
|---|---|---|
| `check-codegen` | `.github/workflows/ci.yml` → `check-codegen` | Generated API client and Zod schemas match `openapi.yaml` |
| `typecheck` | `.github/workflows/ci.yml` → `typecheck` | Full TypeScript typecheck across all workspace packages |

Both checks run automatically on every pull request via the CI workflow. A PR cannot be merged until both pass.

### Required pull request review

At least **1 approving review** from a team member is required before a PR can be merged. Approvals are automatically dismissed when new commits are pushed to the PR branch, ensuring the reviewer always sees the final state of the code.

### Code owners

Critical areas of the codebase are protected by a [CODEOWNERS](.github/CODEOWNERS) file. When a pull request touches one of these paths, GitHub automatically requests a review from the designated team, and **that code-owner approval is required before the PR can be merged**:

| Path(s) | Owning team | Why |
|---|---|---|
| `artifacts/api-server/src/lib/compliance.ts`, `artifacts/api-server/src/routes/alerts.ts` | `@jazan-health/clinical-leads` | Patient-safety rules — booking compliance and risk alerts |
| `lib/api-spec/`, `lib/api-zod/`, `lib/api-client-react/` | `@jazan-health/backend-leads` | API contract; changes affect every consumer |
| `lib/db/` | `@jazan-health/backend-leads` | Database schema changes are irreversible in production |
| `artifacts/api-server/` | `@jazan-health/backend-leads` | API route handlers |
| `artifacts/hrp-tracker/`, `artifacts/hrp-mobile/` | `@jazan-health/frontend-leads` | Web and mobile frontends |
| `.github/` | `@jazan-health/admins` | CI workflows and branch-protection configuration |
| `*` (everything else) | `@jazan-health/maintainers` | General fallback |

To update ownership rules, edit `.github/CODEOWNERS` and open a PR — the `.github/` rule means admins must approve that change too.

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
3. Enable **Require a pull request before merging**.
   - Set **Required approving reviews** to **1**.
   - Enable **Dismiss stale pull request approvals when new commits are pushed**.
   - Enable **Require review from Code Owners**.
4. Enable **Require status checks to pass before merging**.
5. Search for and add both required checks:
   - `Check API codegen is up to date` (job id: `check-codegen`)
   - `TypeScript typecheck` (job id: `typecheck`)
6. Enable **Require branches to be up to date before merging**.
7. Save the rule.

## Local Development Checks

The same checks that CI runs are also enforced locally:

- **Pre-commit hook** — two checks run automatically before every commit via `simple-git-hooks`:
  1. `pnpm run check:codegen` — blocks commits where `openapi.yaml` has been modified without regenerating the client/schemas.
  2. `pnpm run lint` — blocks commits that contain ESLint errors or Prettier formatting violations.

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
