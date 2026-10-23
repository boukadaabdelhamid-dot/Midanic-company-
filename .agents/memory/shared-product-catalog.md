---
name: Shared ERP product catalogs
description: Company-level behavior for sharing product catalogs across ERP stores
---

ERP companies choose between separate catalogs and a shared catalog. In shared mode, creating a product in one ordinary store creates the same product data and prices in the company's other ordinary active stores, while stock remains independent per store. Production units are isolated: their products must not replicate to stores or to other production units. Separate mode preserves the existing store-local behavior.

Changing a company's mode affects future product creations only. Do not automatically backfill, overwrite, or merge existing products; shared mode must not make inventory shared. Keep storefront exposure and minimum-stock settings store-specific rather than copying them from the source store.

**Why:** the company owner defines whether stores sell the same merchandise; they asked for shared product information and prices, but independent inventory, without changing existing records. They separately specified that production-unit materials and products belong only to that unit.

**How to apply:** keep the setting on the ERP company, copy product details and all sale-price tiers only between ordinary stores when creating new products, initialize stock independently, retain each store's exposure/minimum-stock settings, and handle synchronization of later edits or existing catalogs as separately confirmed work.
