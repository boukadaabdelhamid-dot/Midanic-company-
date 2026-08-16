---
name: i18next package firewall constraint
description: Replit package firewall only serves i18next v26+; v23.x requests fail
---

## Rule
The Replit package firewall blocks i18next versions older than v26. Always use `"i18next": "^26.0.0"` in `artifacts/midanic-web/package.json`. The design subagent may request `^23.17.5` (older range it knows about) — override it to `^26.0.0`.

**Why:** pnpm install fails with "No matching version found for i18next@^23.17.5 while fetching from http://package-firewall.replit.local/npm/".

**How to apply:** After any design subagent run that touches midanic-web, grep for `"i18next"` in `artifacts/midanic-web/package.json` and ensure it's `^26.0.0` or higher before running `pnpm install`.
