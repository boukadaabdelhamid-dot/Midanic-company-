---
name: ERP store setup
description: Store count selection and owner controls for Platform-managed ERP companies
---

For a new Platform-managed ERP company, use the store count submitted with the ERP request to provision that many active stores before the owner signs in. Name them with numbered defaults so the owner can rename them. Company owners cannot create or delete stores after setup; they can only rename existing stores.

Do not add or remove stores for existing companies or imported databases as a side effect of this behavior. Preserve their current store records and names.

**Why:** the owner asked for stores to appear immediately based on the selected count and to leave the owner with naming only; existing company data must remain safe.

**How to apply:** connect the validated request count to initial tenant provisioning, enforce creation/deletion restrictions in the API as well as the UI, and keep the existing-store path non-destructive.
