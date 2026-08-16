---
name: ERP API isolation
description: How the full source ERP API is kept separate from Midanic Platform
---

The source ERP API uses generic table and enum names such as `users`, `products`, and `user_role`; it must run as its own artifact with a PostgreSQL `erp` schema and a connection-level `search_path` of `erp,public`.

**Why:** The source ERP schema is incompatible with Midanic Platform's public schema. An asynchronous pool connect hook is not sufficient because requests can race the hook; use PostgreSQL connection options to set `search_path` before queries.

**How to apply:** Keep the active Platform API on its existing artifact/port, run the ERP API independently, and point only ERP/Web Store development proxies to the ERP API.