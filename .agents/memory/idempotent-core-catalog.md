---
name: Idempotent core catalog
description: Keep required public products and their release metadata present in older databases
---

Core catalog repair must run independently from first-user seeding. A database can already contain an administrator while still missing products, versions, or downloads introduced later.

**Why:** The original seed returned early when the admin existed, leaving the ERP product absent from an older database even though the application expected it.

**How to apply:** Use slug-based, idempotent checks for required products and add missing related versions/download records without duplicating existing data. Keep this separate from predictable development credentials.