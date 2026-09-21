---
name: ERP tenant database reconciliation
description: Safe recovery for active ERP tenants created before dedicated database provisioning became mandatory
---

Active or converted legacy ERP tenants can still have no dedicated tenant database even when their account and domain are active. Startup reconciliation should provision records marked `unprovisioned` and safely resume records left in `provisioning`.

**Why:** Tenant-domain validation fails closed when the database is not ready, so every ERP action appears broken even though account and domain status are active. Provisioning is idempotent and can safely repair these legacy records.

**How to apply:** Reconcile only active/converted tenants in `unprovisioned` or interrupted `provisioning` states. Retry transient ERP API startup races, mark success as `ready`, and preserve a terminal error as `failed` for manual retry. Never reprovision already-ready databases.