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

Company administrator privileges do not imply ownership of the Platform credentials. Local-password administrators must remain independent of the owner's password rotation, even when their tenant token carries the owner's Platform ID for routing.

**Why:** A full-permission local administrator can receive the same tenant-admin role as an owner. Inferring credential ownership from that role revoked the administrator's newly issued sessions after the owner's password changed.

**How to apply:** Distinguish credential ownership using a server-signed source established during successful authentication, and retain that distinction across store switches. Tokens without that distinction retain the legacy fail-closed owner checks; do not exempt every tenant administrator or assign local administrators the owner's latest generation.

Password-reset tokens belong to the company's database, not a global account lookup. Resolve the company through its trusted domain before issuing, validating, or consuming an ERP reset token; never try other company databases as a fallback.

**Why:** A reset-token hash cannot identify which isolated company owns the token. Shared-database fallback can silently change the wrong account or make a valid company reset fail. Linked owners still require Platform password synchronization after the company-local token has been verified.

**How to apply:** Keep reset emails on the verified company domain, fail explicitly when company resolution or Platform synchronization is unavailable, and invalidate the affected account's outstanding sessions and reset links consistently across all password-change entry points.