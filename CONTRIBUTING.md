# Contributing Guide

## Connecting to GitHub (first-time setup)

The CI badge and GitHub Actions workflows are ready to go, but the project needs to be pushed to a GitHub repository first. Follow these steps **once** from your local machine or in the Replit shell.

### 1 — Create the repository

The repository already exists at **https://github.com/shalharisi/hrp-jazan** and the code has been pushed. This step is complete.

### 2 — Add the remote and push

The `origin` remote is already configured and `main` has been pushed. This step is complete.

### 3 — Activate branch protection (one-time)

Once the first push has completed:

1. Go to **Actions → Setup Branch Protection** in the GitHub repository.
2. Click **Run workflow** → **Run workflow** to confirm.

This applies the PR review rules and required status checks described in the *Branch Protection Requirements* section below.

### 4 — Provision teams and secrets (one-time, org admin)

See the *Provisioning GitHub Teams* section below to create the `@jazan-health/*` teams that CODEOWNERS references, and add the `ORG_ADMIN_PAT` and `GH_PAT` repository secrets.

---

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

### Provisioning GitHub Teams (one-time, repository admin)

CODEOWNERS rules are enforced via five teams under the `@jazan-health` organisation. These teams must exist in GitHub before review requests are sent.

1. Create a Personal Access Token (PAT) with **`admin:org`** scope in your GitHub account settings.
2. Store it as a repository secret named **`ORG_ADMIN_PAT`**.
3. Go to **Actions → Create GitHub Teams** and click **Run workflow**.

The workflow creates all five teams (if they do not already exist) and adds `@Shalharisi` as the initial maintainer of each:

| Team slug | Responsibility |
|---|---|
| `maintainers` | Project leads — fallback reviewers for all paths |
| `backend-leads` | API, database, and server-side engineers |
| `frontend-leads` | Web and mobile UI engineers |
| `clinical-leads` | Clinical informatics / patient-safety reviewers |
| `admins` | Organisation and repository administrators |

After the teams are created, add the appropriate members using the **Add Members to GitHub Team** workflow described in the next section, then run the **Setup Branch Protection** workflow (see below) so CODEOWNERS rules take effect.

### Adding Members to Each Team

Use the **Add Members to GitHub Team** workflow to populate each team with real staff. The workflow requires the same `ORG_ADMIN_PAT` secret used above.

1. Go to **Actions → Add Members to GitHub Team** and click **Run workflow**.
2. Choose the **team slug** from the dropdown.
3. Enter one or more **GitHub usernames**, comma-separated (e.g. `ahmedali,sara-dev,khaled99`).
4. Choose the **role**: `member` (reviewer only) or `maintainer` (can also manage the team itself).
5. Repeat for each team until all five are populated with at least one real staff member.

The workflow is idempotent — running it again for the same user/team simply updates their membership without creating duplicates.

**Post-run checklist** — after running the workflow for each team, confirm:
- [ ] `maintainers` — at least one real member listed at `https://github.com/orgs/jazan-health/teams/maintainers/members`
- [ ] `backend-leads` — at least one real member listed at `https://github.com/orgs/jazan-health/teams/backend-leads/members`
- [ ] `frontend-leads` — at least one real member listed at `https://github.com/orgs/jazan-health/teams/frontend-leads/members`
- [ ] `clinical-leads` — at least one real member listed at `https://github.com/orgs/jazan-health/teams/clinical-leads/members`
- [ ] `admins` — at least one real member listed at `https://github.com/orgs/jazan-health/teams/admins/members`

#### Team roster

Fill in this table with the actual GitHub handles for each role and commit it back to `CONTRIBUTING.md` after populating the teams:

| Team slug | Role | GitHub handles |
|---|---|---|
| `maintainers` | Project leads — fallback reviewers for all paths | @Shalharisi |
| `backend-leads` | API, database, and server-side engineers | @Shalharisi |
| `frontend-leads` | Web and mobile UI engineers | @Shalharisi |
| `clinical-leads` | Clinical informatics / patient-safety reviewers | @Shalharisi |
| `admins` | Organisation and repository administrators | @Shalharisi |

> **Verification:** Open a draft PR that modifies `.github/CODEOWNERS` (even a whitespace change). The **Validate CODEOWNERS** CI check will attempt to resolve every `@jazan-health/<team>` entry via the GitHub API. All five checks must show `✓` before the entry is considered live. Add a `GH_PAT` secret (classic PAT with `read:org` scope) to the repository so the validator can look up org teams — see the *CODEOWNERS team validation* section below.

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

### CODEOWNERS team validation and the `GH_PAT` secret

The `Validate CODEOWNERS` workflow checks that every `@org/team` entry in `.github/CODEOWNERS` resolves to a real GitHub team.  GitHub's built-in `GITHUB_TOKEN` does **not** carry `read:org` scope, so team lookups fail when using the default token on organisations that restrict token permissions.

To make team validation reliable, add a repository secret named `GH_PAT`:

| Step | Detail |
|---|---|
| 1. Create the PAT | **Classic PAT** — enable the `read:org` scope under *Organisation* permissions. **Fine-grained PAT** — set *Members* to *Read-only* under *Organisation permissions*. |
| 2. Store the secret | Repository → **Settings → Secrets and variables → Actions → New repository secret** → Name: `GH_PAT`, Value: `<your PAT>`. |
| 3. Done | The workflow automatically uses `GH_PAT` when present and falls back to `GITHUB_TOKEN` otherwise. |

> **When is this needed?**  Only when `.github/CODEOWNERS` contains `@org/team` entries (as this repository does).  Individual `@username` entries resolve via the public `/users/{handle}` API and do not require extra scope.

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

## Workflow: adding a new shadcn/ui component

`lib/ui` is the **single source of truth** for all shared UI primitives. Follow these steps whenever you add a new shadcn/ui component:

1. **Add the component implementation to `lib/ui/src/components/`.**  
   Run the shadcn CLI targeting `lib/ui`, or create the file manually there.
2. **Export it from the `@workspace/ui` barrel** (`lib/ui/src/index.ts`).
3. **Add a one-line re-export stub in each artifact that needs it**, e.g.:

   ```ts
   // artifacts/hrp-tracker/src/components/ui/my-new-component.tsx
   export * from "@workspace/ui";
   ```

   Every file in `artifacts/*/src/components/ui/` **must** be exactly this stub.  
   The CI `check-ui-stubs` job will fail if any file in those directories contains component logic instead of the stub.

4. **Do not copy-paste component code into artifact directories.**  
   If a component is only used in one artifact and is truly app-specific (e.g. it depends on the app's own i18n context or domain types), place it in `artifacts/<name>/src/components/` — **not** inside `components/ui/`.

5. Run `pnpm run typecheck` to confirm everything compiles.
6. Open a pull request — CI will verify the stub constraint automatically.
