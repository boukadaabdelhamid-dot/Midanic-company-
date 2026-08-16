---
name: ERP product history permissions
description: Authorization constraint for product purchase, sales, summary, and movement history in the mobile ERP.
---

Product history is an administrator-only ERP capability. Non-admin staff can view product information, but the purchase, sales, summary, and movement history tabs must remain disabled and must not treat a forbidden response as an empty history.

**Why:** The existing history endpoint is protected by administrator authorization, so requesting it for ordinary staff creates a misleading empty-state experience and can turn a permission error into false business data.

**How to apply:** Gate the history query and related tabs on the resolved admin role. If an authorized request fails, show an explicit error state rather than an empty purchase/sales/movement list.