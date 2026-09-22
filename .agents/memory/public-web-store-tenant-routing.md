---
name: Public Web Store tenant routing
description: Durable routing rule for anonymous storefront requests across separate ERP tenant databases
---

Company Web Store domains must call the matching company ERP origin directly: `<company>.store.midanic.com` maps to `<company>.midanic.com`. This keeps anonymous storefront reads on the exact API and database used by that company's ERP.

**Why:** A globally configured ERP API can be a different Railway service or database from the service behind the company's ERP domain. Hostname tenant resolution alone does not guarantee both domains reach the same deployed backend.

**How to apply:** Derive the company ERP origin before any build-time global API URL. Apply it to generated clients, manual fetches, and relative upload/image URLs. The ERP API must allow the matching Web Store origin through CORS.

One company domain represents one ERP and one store. Company Web Store requests must ignore and clear legacy store selectors, and the ERP API should resolve the store linked to the platform owner with the tenant store as a first-login fallback.

**Why:** Legacy query parameters or local-storage slugs can redirect a company hostname to stale internal store rows and recreate the mismatch.

**How to apply:** Use the same canonical resolver for config, products, product types, categories, and the public store listing. Never select a company store by product count.