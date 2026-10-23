---
name: Shared ERP product catalogs
description: Company-level behavior for sharing product catalogs across ERP stores
---

ERP companies choose between separate catalogs and a shared catalog. In shared mode, creating a product in one ordinary store creates the same product data and prices in the company's other ordinary active stores, while stock remains independent per store. Production units are isolated: their products must not replicate to stores or to other production units. Separate mode preserves the existing store-local behavior.

Changing a company's mode affects future product creations. Existing products are linked lazily only when an ordinary product is edited in shared mode and its barcode matches exactly one product per active store; do not bulk backfill or merge ambiguous products. Propagate changed shared fields, including purchase cost/CUMP. Keep inventory, storefront exposure, and minimum-stock settings store-specific.

**Why:** the company owner defines whether stores sell the same merchandise; they asked for shared product information and prices, including purchase cost/CUMP, but independent inventory. They later confirmed that edits from any ordinary store should update linked copies, while old copies must be matched only by a unique barcode. Production-unit materials and products belong only to that unit.

**How to apply:** keep the setting on the ERP company, assign stable IDs to new shared products and their copies, and lazily link old copies only when their barcode is unique in each active ordinary store. When a linked product changes, propagate only the fields that changed, including CUMP recalculations from purchase operations; retain each store's stock, exposure, and minimum-stock settings. Never share factory products or alter ambiguous existing records.
