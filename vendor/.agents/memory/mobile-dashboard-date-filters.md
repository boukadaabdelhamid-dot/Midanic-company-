---
name: Mobile dashboard date filters
description: Date-range interaction used by Dashboard sales, profit, and product-sales tabs.
---

The Dashboard period control follows ERP presets and exposes `...` for a custom range. Custom ranges use native Mobile start/end date pickers, enforce start/end ordering, and continue passing the existing `dateFrom`/`dateTo` query parameters to the current dashboard endpoints.

**Why:** Plain `YYYY-MM-DD` text inputs are difficult to use on a phone and do not match the ERP interaction shown in the reference screenshots.

**How to apply:** Keep the preset bar shared across date-aware dashboard tabs. Use the existing `DateField` component for custom dates; do not add a new endpoint or change the General tab unless the API gains a date-aware contract.