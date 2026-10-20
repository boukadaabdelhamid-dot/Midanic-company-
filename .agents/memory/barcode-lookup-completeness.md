---
name: Barcode lookup completeness
description: Why operational barcode lookups must not depend on a limited preloaded catalog.
---

Resolve operational barcode scans on demand in the current store, rather than treating a limited catalog page as the complete inventory. Keep codes as strings so leading zeroes survive.

**Why:** A returns scanner appeared usable but failed for products outside its preloaded catalog page. Returns may also concern products whose current stock is zero; an in-stock-only list is not sufficient evidence of absence.

**How to apply:** Search beyond pagination boundaries, include additional barcodes, require exact identifier matching, preserve store isolation, and distinguish lookup failures from a successful search with no result.
