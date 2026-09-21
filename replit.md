# Midanic

A SaaS platform with a React/Vite frontend, Express 5 API server, and PostgreSQL database.

## Run & Operate

- `pnpm install --frozen-lockfile` — restore all workspace dependencies after import
- `pnpm --filter @workspace/midanic-web run dev` — run the main Midanic web app
- `pnpm --filter @workspace/api-server run dev` — run the platform API
- `pnpm --filter @workspace/erp run dev` — run the ERP web app
- `pnpm --filter @workspace/erp-api-server run dev` — run the ERP API
- `pnpm --filter @workspace/web-store run dev` — run the storefront
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` (provided by Replit PostgreSQL) and `SESSION_SECRET`
- In Replit, use the managed artifact workflows rather than assigning ports manually.

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
