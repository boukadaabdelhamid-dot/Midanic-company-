---
name: Mobile contact history coverage
description: Which customer and supplier history records are available to Mobile from the existing API.
---

The existing API supports customer orders, customer returns, customer financial operations, supplier purchase/payment operations, and detail endpoints for orders, purchase orders, and customer returns. It does not expose a supplier-scoped supplier-return history endpoint in the generated client.

**Why:** Mobile must use generated API hooks and must not invent or add endpoints when the product scope excludes API changes.

**How to apply:** Display all supported customer and supplier records with links to their existing detail screens. Treat supplier returns as unavailable until the API exposes a supplier-scoped record or the scope explicitly permits an API addition.