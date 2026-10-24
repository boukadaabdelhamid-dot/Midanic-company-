---
name: Seeded demo domain conflicts
description: Prevent built-in ERP demo data from claiming another tenant's hostname or subdomain.
---

The seeded evaluation tenant cannot assume its reserved subdomain and hostname are free. On a long-lived shared database, an existing tenant may already own either value.

**Why:** API startup previously aborted when demo repair tried to claim an occupied unique domain, which can leave public customer request forms without their API.

**How to apply:** Demo seeding should assign default domains only when both are available. If either is occupied, preserve the current tenant ownership and let the API start without claiming the conflicting domain. Never delete or reassign a real company domain to restore demo access.
