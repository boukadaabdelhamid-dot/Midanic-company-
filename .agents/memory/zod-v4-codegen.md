---
name: Zod v4 codegen resolution
description: How Orval 8.23+ generates Zod v4 syntax and how we resolve it in a Zod v3 workspace
---

## Rule
Orval 8.23+ generates `zod.int()`, `zod.email()` etc. (Zod v4 API). The workspace uses `zod@^3.25.76` on the catalog, which ships v4 under the `zod/v4` sub-path. Two fixes are required:

1. **TypeScript (lib/api-zod)**: `lib/api-zod/tsconfig.json` has `"paths": { "zod": ["./src/zod-v4.ts"] }` pointing to a shim file that re-exports `export * from 'zod/v4'`.
2. **esbuild (api-server)**: `artifacts/api-server/build.mjs` uses a custom `zodV4Plugin` (onResolve filter `/^zod$/`) to redirect exact `zod` imports to `zod/v4` at bundle time.

**Why:** Using esbuild's built-in `alias: { zod: 'zod/v4' }` does prefix matching — it also remaps `zod/v4` → `zod/v4/v4`, breaking drizzle-zod and other packages that already use `zod/v4`.

**How to apply:** Any time Orval is upgraded or `lib/api-zod` schema changes are regenerated. Do NOT use the esbuild `alias` option for this.
