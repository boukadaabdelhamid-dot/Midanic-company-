---
name: Tenant product types
description: Default product type behavior for newly provisioned company ERP databases
---

New company tenant databases must start with an empty product-type catalog. Product types are company-managed data, not required system defaults. The standalone shared development database may retain seeded examples.

**Why:** The user expects a new customer's ERP product-type list to be empty.

**How to apply:** Skip default product-type seeding when bootstrap runs in a tenant database context. Do not delete or rewrite existing tenant product types automatically; existing companies may have intentionally edited or used them.
