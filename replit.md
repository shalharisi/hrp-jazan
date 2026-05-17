# منظومة تتبع الحمل عالي الخطورة – تجمع جازان الصحي 2026

[![CI](https://github.com/shalharisi/hrp-jazan/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/shalharisi/hrp-jazan/actions/workflows/ci.yml)

High-Risk Pregnancy Tracking Platform for Jazan Health Cluster 2026 — a bilingual (Arabic RTL / English) clinical management system replacing the Excel/Microsoft Forms workflow.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, served at /api)
- `pnpm --filter @workspace/hrp-tracker run dev` — run the frontend (port 22604, served at /)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/scripts run generate-guide` — regenerate the user guide Word + PDF files (output: `دليل_المستخدم_منظومة_جازان.docx` and `دليل_المستخدم_منظومة_جازان.pdf` at workspace root); append `--no-pdf` to skip PDF generation
- `pnpm --filter @workspace/scripts run generate-guide-with-screenshots` — same as above but also captures live screenshots from the running app and saves them as PNGs to `scripts/screenshots/` for version-control diffing; supports `--output-screenshots-dir=<path>` and `--base-url=<url>` overrides
- `pnpm --filter @workspace/scripts run capture-screenshots` — capture screenshots only (no guide build), saved to `scripts/screenshots/`; supports `--output-screenshots-dir=<path>` and `--base-url=<url>` overrides
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite (hrp-tracker), Tailwind CSS v4, shadcn/ui, Recharts, Wouter
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (zod/v4), drizzle-zod
- API codegen: Orval (from OpenAPI spec → @workspace/api-client-react)
- Build: esbuild (CJS bundle)
- Font: Tajawal (Google Fonts) for Arabic

## Where things live

- `lib/api-spec/openapi.yaml` — source of truth for all API endpoints
- `lib/db/src/schema/` — Drizzle ORM table definitions (sectors, hospitals, health-centers, patients, pregnancies, appointments)
- `lib/api-client-react/src/generated/` — generated React Query hooks (do not edit manually)
- `lib/api-zod/src/generated/` — generated Zod schemas for server validation
- `lib/ui/src/components/` — canonical shadcn/ui component implementations; this is the single source of truth for all shared UI primitives
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/api-server/src/lib/compliance.ts` — working-days booking compliance logic
- `artifacts/hrp-tracker/src/` — React frontend
- `artifacts/hrp-tracker/src/lib/i18n-context.tsx` — bilingual translation context (ar/en)
- `artifacts/hrp-tracker/src/components/layout/app-layout.tsx` — sidebar layout with language toggle
- `artifacts/hrp-tracker/src/components/ui/` — re-export stubs only (`export * from "@workspace/ui"`) — do not add component logic here
- `artifacts/hrp-tracker/src/assets/logo.jpg` — Jazan Health Cluster logo

## Architecture decisions

- Contract-first API: OpenAPI spec drives both server validation (Zod) and client hooks (React Query via Orval)
- Compliance logic lives server-side in `compliance.ts`: counts working days excluding Fri (5) and Sat (6); ≤2 days = compliant, >2 = non_compliant, no appointment = pending
- Alert logic is server-computed on every request (no scheduled jobs): VTE without Enoxaparin, critical without appointments, missed appointments
- Sector → Hospital mapping is stored in the DB (sectors.hospital_id FK), not hardcoded
- Arabic RTL is the default language; dir="rtl" is set on the HTML element; preference is stored in localStorage

## Product

- Patient registration with National ID (10-digit unique)
- Multiple pregnancy episodes per patient
- Risk classification: منخفض (low) / متوسط (medium) / عالي (high) / حرج (critical)
- Booking compliance tracking: ≤2 working days (Fri/Sat excluded)
- KPI dashboard with charts (sector distribution, risk level, compliance, hospital attendance)
- Alerts for: VTE cases without Enoxaparin prescription, critical cases without booked appointments, missed appointments
- Bilingual UI: Arabic (RTL, Tajawal font) / English toggle
- User guide page (دليل المستخدم)

## Reference data

- 6 hospitals: جازان العام, صبيا العام, أبو عريش العام, صامطة العام, بيش العام, مستشفى الملك فهد المركزي (KFCH)
- 8 sectors mapping to hospitals
- ~165 health centers across all sectors

## User preferences

- Arabic UI is primary (RTL), English is secondary
- Working days exclude Friday and Saturday (Saudi weekend)
- No emojis in UI labels (except compliance status indicators ✅/❌/⏳)
- Logo: artifacts/hrp-tracker/src/assets/logo.jpg

## Branch protection

The `main` branch requires both CI jobs to pass before any PR can be merged:

- `check-codegen` — verifies generated API client and Zod schemas match `openapi.yaml`
- `typecheck` — full TypeScript typecheck across all workspace packages

These rules are configured via `.github/workflows/setup-branch-protection.yml` (run it once from GitHub Actions → Run workflow). Manual setup instructions are in `CONTRIBUTING.md`.

## Pre-commit hook

A `simple-git-hooks` pre-commit hook runs `pnpm run check:codegen` automatically before every commit. It exits non-zero if `openapi.yaml` has been modified without re-running codegen, blocking the commit until the generated files are brought back in sync.

To install the hook in a fresh clone, run:

```bash
pnpm install   # triggers the `prepare` script which calls simple-git-hooks
```

## Gotchas

- After editing OpenAPI spec, always run `pnpm --filter @workspace/api-spec run codegen` before editing routes — the pre-commit hook enforces this automatically
- DB schema changes require `pnpm --filter @workspace/db run push`
- The `@assets` Vite alias points to workspace-root `attached_assets/` — for images, copy to `artifacts/hrp-tracker/src/assets/` instead to avoid Vite fs.strict issues
- API routes must handle path prefix `/api/` — artifact.toml routes to port 8080 at path `/api`
- **shadcn/ui components belong in `lib/ui`** — never add component logic to `artifacts/*/src/components/ui/`; those files must stay as one-line re-export stubs (`export * from "@workspace/ui"`). The CI `check-ui-stubs` job enforces this.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
