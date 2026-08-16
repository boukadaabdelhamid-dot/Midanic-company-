---
name: ERP control plane
description: Durable architecture for centrally controlling ERP companies, trials, stores, and support access from Midanic
---

The Midanic Super Admin panel is the source of truth for the ERP tenant lifecycle. ERP and Web Store should consume server-side tenant status rather than deciding access from browser state or local storage.

**Why:** The product requirement is total administrative control, including manual approval, seven-day trials, suspension, conversion, and manual deletion without automatic data loss.

**How to apply:** Keep tenant status and trial timestamps in PostgreSQL, enforce authorization in API middleware and tenant-scoped queries, and record any future support/impersonation entry in an audit log before enabling it.