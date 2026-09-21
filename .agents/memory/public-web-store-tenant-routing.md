---
name: Public Web Store tenant routing
description: Durable routing rule for anonymous storefront requests across separate ERP tenant databases
---

Anonymous Web Store requests cannot rely on a bearer token to select a tenant database. The API must resolve the company from the trusted ERP/Web Store hostname (or the browser origin when the API is on a separate public origin), validate the active Platform tenant, and enter that tenant's database before reading the store, settings, products, or public catalogue lookups.

**Why:** A shared `principal` slug and shared legacy database can make one company's Web Store appear disconnected from ERP or expose stale data from another company.

**How to apply:** Keep the hostname-to-tenant lookup and database context in the ERP API. All browser requests, including manually written fetches, must send the same store-scoping headers as generated API-client requests.