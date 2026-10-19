---
name: ERP password authority
description: Password synchronization and login rules for ERP accounts linked to the Midanic Platform
---

Linked ERP accounts must use the Platform password as their sole authentication authority. ERP may mirror the hash locally for provisioning and compatibility, but login must not accept that local hash when the Platform account is linked. Password changes initiated in ERP must update Platform first and then mirror the result locally; local-only employee accounts remain independent.

**Why:** Keeping a local hash as a successful fallback makes a linked account accept both the previous ERP password and the current Platform password after either side changes.

**How to apply:** Any new login, password-change, reset, SSO exchange, or staff-management path must preserve Platform authority for users with `platformUserId`, fail closed when Platform synchronization is unavailable, and keep local-only staff on the local bcrypt path.

Owner session revocation belongs to Platform as a persistent, per-account generation, changed atomically with the password. ERP validates that generation without caching it; owner access tokens and SSO tickets must retain the generation they were issued with.

**Why:** A password can control several tenant databases. Local revocation fan-out can partially fail or race with password updates. Also, employee/customer tokens carry the owner's Platform ID for tenant routing, not credential ownership: revoking everything with that ID would incorrectly disconnect the whole company.

**How to apply:** Check generations only for linked owner/admin sessions, preserve them when reissuing store-selection tokens, and guard both HTTP requests and existing WebSocket deliveries. Optional-auth routes must use the same verification: “optional” allows no token, never a supplied revoked token falling through as anonymous or retaining owner privileges. Do not add a cached revocation grace period.