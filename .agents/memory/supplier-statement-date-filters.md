---
name: Supplier statement date filters
description: Preserve accurate account and running balances when limiting supplier statement rows to a date range.
---

Apply date filters after calculating operation running balances from the complete history. Keep the supplier's current account balance independent of the selected period.

**Why:** A filtered statement should show fewer operations without changing the canonical current balance or making each visible row's historical balance incorrect.

**How to apply:** When adding date constraints to supplier statement APIs, calculate full-history balances first and filter only the returned operations. Treat unified customer-supplier ledgers the same way.
