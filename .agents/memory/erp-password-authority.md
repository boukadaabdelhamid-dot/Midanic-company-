---
name: ERP password authority
description: Password synchronization and login rules for ERP accounts linked to the Midanic Platform
---

Linked ERP accounts must use the Platform password as their sole authentication authority. ERP may mirror the hash locally for provisioning and compatibility, but login must not accept that local hash when the Platform account is linked. Password changes initiated in ERP must update Platform first and then mirror the result locally; local-only employee accounts remain independent.

**Why:** Keeping a local hash as a successful fallback makes a linked account accept both the previous ERP password and the current Platform password after either side changes.

**How to apply:** Any new login, password-change, reset, SSO exchange, or staff-management path must preserve Platform authority for users with `platformUserId`, fail closed when Platform synchronization is unavailable, and keep local-only staff on the local bcrypt path.