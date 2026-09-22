---
name: ERP control plane
description: Durable architecture for centrally controlling ERP companies, trials, stores, and support access from Midanic
---

The Midanic Super Admin panel is the source of truth for the ERP tenant lifecycle, feature flags, and store limits. ERP and Web Store should consume server-side tenant state rather than deciding access from browser state or local storage.

**Why:** The product requirement is total administrative control, including manual approval, seven-day trials, suspension, conversion, and manual deletion without automatic data loss.

**How to apply:** Keep tenant status, feature flags, and entitlements in Platform PostgreSQL; expose live tenant usage through authenticated service endpoints owned by ERP; enforce authorization in API middleware and tenant-scoped queries; record any future support/impersonation entry in an audit log before enabling it.