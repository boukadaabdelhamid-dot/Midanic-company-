---
name: ERP API isolation
description: How the full source ERP API is kept separate from Midanic Platform
---

The source ERP API uses generic table and enum names such as `users`, `products`, and `user_role`; it must run as its own artifact with a PostgreSQL `erp` schema and a connection-level `search_path` of `erp,public`.

**Why:** The source ERP schema is incompatible with Midanic Platform's public schema. An asynchronous pool connect hook is not sufficient because requests can race the hook; use PostgreSQL connection options to set `search_path` before queries.

**How to apply:** Keep the active Platform API on its existing artifact/port, run the ERP API independently, and point only ERP/Web Store development proxies to the ERP API.

When importing ERP updates from the older monolithic repository, treat its ERP routes and UI as the functional baseline, but transplant them into the isolated ERP packages rather than replacing the current architecture.

**Why:** The monolithic version has broader ERP feature coverage, while the current project owns the required tenant-domain validation, Platform SSO authority, store isolation, and dedicated `erp` schema.

**How to apply:** Preserve the current auth, tenant-domain, store-context, database, artifact-routing, and customer-isolation layers; selectively restore missing business routes and matching contracts from the monolith.