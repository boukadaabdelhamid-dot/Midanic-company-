---
name: Smart purchase cross-store availability
description: Rules for suppressing Smart Purchase suggestions when matching stock exists at another store.
---

For an ordinary retail store, Smart Purchase must not recommend buying a product when an active store in the same company has positive stock of that product. Match shared-catalog copies by their stable catalog ID and retain exact reference/barcode matching for legacy or separate-catalog records, including additional barcodes. Do not match across companies or production units. Products with no stock elsewhere remain eligible for purchase suggestions.

**Why:** The user asked to avoid recommending products that are already available in another store, while preserving each store’s independent stock and the production unit’s separation.

**How to apply:** Keep this exclusion in the server-side Smart Purchase query, scoped to active ordinary stores in the same tenant. Treat positive stock as available; a matching record with zero stock does not suppress a purchase need.
