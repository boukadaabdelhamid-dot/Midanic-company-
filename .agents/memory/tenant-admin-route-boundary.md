---
name: Tenant-admin route boundary
description: Tenant-facing ERP administration must use tenant-aware authorization and must not seed the global platform admin into tenant data.
---

Tenant company owners authenticate with the JWT role `tenant_admin`, even though their local ERP database user may have the database role `admin`. Tenant-facing store, staff, permission, and caisse-administration routes must therefore use the tenant-aware authorization boundary and scope records to the authenticated tenant; `requireAdmin`/`isAdmin` remain reserved for global platform administration.

**Why:** Using the global-admin middleware made company pages silently render empty after 403 responses, while the tenant bootstrap also seeded `Midanic Admin` into every company database.

**How to apply:** When adding ERP company-management or company-caisse routes, use tenant-aware middleware and tenant membership filters. For shared helpers that distinguish global admin from company admin, explicitly include `tenant_admin` only for tenant-local operations. Keep the global development/platform admin seed out of isolated tenant databases.
