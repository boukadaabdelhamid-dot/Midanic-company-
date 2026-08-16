---
name: Legacy database migration bootstrap
description: Safe startup migration behavior for databases created before tracked migrations
---

When a deployed database was created with `drizzle-kit push` before tracked migrations existed, an empty or partial Drizzle journal cannot be treated as proof that the current baseline schema is complete. Reconcile required legacy tables, columns, and constraints idempotently before marking historical migrations applied.

**Why:** The production database could have an old schema while the app's migration journal appeared current, causing startup migration failures with no useful error detail.

**How to apply:** Keep legacy reconciliation idempotent, use `NOT VALID` constraints when old rows may violate new relationships, and log the original migration error (message and stack) before terminating startup. Verify both a push-bootstrapped database and a fresh database.

An absent `drizzle.__drizzle_migrations` table must be checked with `to_regclass` first; PostgreSQL still resolves a table reference inside a `CASE` subquery even when that branch would not execute.