---
name: Mobile customer balance
description: Customer list balance field naming differs between the ERP response and the generated Mobile type.
---

ERP contact responses can expose the balance as `current_balance`, `currentBalance`, or (for customer details) `profile.currentBalance`; supplier responses may use the same naming variation. Mobile should normalize all supported shapes before formatting a balance.

**Why:** List and detail endpoints do not share the same response shape, and the generated summary type does not currently declare every balance field. Reading only one location makes a valid balance look like zero.

**How to apply:** Use one boundary helper for customer and supplier lists/details, checking top-level camelCase/snake_case fields and the customer's nested profile.