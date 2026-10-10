# Midanic

A SaaS platform with a React/Vite frontend, Express 5 API server, and PostgreSQL database.

## Run & Operate

- `pnpm install --frozen-lockfile` — restore all workspace dependencies after import
- Replit's **Run** button starts the `Project` workflow, which starts the managed services `artifacts/api-server: API Server`, `artifacts/midanic-web: web`, `artifacts/erp: web`, and `artifacts/web-store: web`, plus the existing `ERP API` workflow. You can start these individually instead when working on one app.
- Previews: `/` (platform), `/erp/` (ERP), `/store/` (storefront). Development health checks: `/api/healthz`, `/erp/api/healthz`, `/store/api/healthz`. The ERP and storefront dev servers proxy their own `/api` requests to the ERP API.
- Outside the managed workflows, each service needs its configured `PORT`; Vite also needs `BASE_PATH` (`/`, `/erp/`, or `/store/`). Do not start these packages with bare `pnpm dev` at the workspace root.
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- The platform and ERP APIs apply their existing development database migrations on startup; a separate schema push is not needed for a fresh import.
- Required env: `DATABASE_URL` (runtime-managed by Replit PostgreSQL) and `SESSION_SECRET` (secret). External email, R2 upload storage, and production administrator bootstrap require their respective service credentials/configuration; do not invent values.
- Development startup seeds demonstration accounts. Do not treat those credentials or the local ERP upload directory as production-ready.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/midanic-web` — main platform frontend
- `artifacts/api-server` — platform API
- `artifacts/erp` and `artifacts/erp-api-server` — ERP frontend and API
- `artifacts/web-store` — customer storefront
- `lib/db` and `lib/erp-db` — platform and ERP database packages

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
