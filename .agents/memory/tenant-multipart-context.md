---
name: Tenant multipart context
description: Preserving tenant database selection through asynchronous multipart upload parsing
---

Multipart parsers may invoke their completion callback after the authentication middleware's async-local tenant scope has ended. Upload handlers must re-enter the authenticated tenant database context before checking usage or writing metadata.

**Why:** Without the handoff, an authenticated tenant upload can query the shared database, miss tenant usage, and fail metadata foreign keys against the wrong user table.

**How to apply:** Carry the resolved tenant database context on the authenticated request and wrap the multipart completion callback with `runWithTenantDatabase` before calling the upload route handler.