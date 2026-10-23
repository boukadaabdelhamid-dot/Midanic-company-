---
name: ERP store setup
description: Store count selection and owner controls for Platform-managed ERP companies
---

For a new Platform-managed ERP company, use the store count submitted with the ERP request to provision that many active stores before the owner signs in. Name them with numbered defaults so the owner can rename them. Company owners cannot create or delete stores after setup; they can only rename existing stores.

Do not add or remove stores for existing companies or imported databases as a side effect of this behavior. Preserve their current store records and names.

When the company has only one active location (one ordinary store or one production unit), hide the store switcher, store-management navigation, and product-transfer navigation. Keep the location name visible and allow the owner to rename it in Settings. Count all active company locations, not an employee's accessible memberships. A factory plus a store is two locations and retains multi-site controls subject to permissions.

**Why:** the owner asked for stores to appear immediately based on the selected count and to leave the owner with naming only; existing company data must remain safe. They approved hiding irrelevant store/transfer controls for single-location companies while preserving them for employees of multi-location companies.

**How to apply:** connect the validated request count to initial tenant provisioning, enforce creation/deletion restrictions in the API as well as the UI, and keep the existing-store path non-destructive. Use the company-wide active-location list to drive single-site navigation, rather than inferring company size from personal store access; retain a database-backed Settings rename path.
