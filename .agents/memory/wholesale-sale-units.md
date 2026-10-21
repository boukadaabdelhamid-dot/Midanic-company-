---
name: Wholesale sale units
description: Confirmed ERP behavior for selling products by a multi-piece unit.
---

Wholesale units are enabled per product and use the product's configured pieces-per-unit factor. The feature applies only to Bon de vente unless the user expands the scope. Sale quantity is entered in units, the displayed unit price is the piece price multiplied by the factor, and inventory/accounting quantities are persisted in base pieces. Store the factor on each order line so existing and historical orders retain their original meaning. Existing records default to factor 1.

**Why:** the user explicitly chose unit-or-piece selection in Bon de vente, with ten units of ten pieces counting as one hundred pieces, and asked to keep the feature scoped there.

**How to apply:** preserve the Bon-only boundary, use the saved order-line factor when displaying or editing prior sales, and do not change POS, online sales, or purchases without confirmation.
