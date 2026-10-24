---
name: Fractional stock precision
description: Inventory may legitimately contain fractional quantities, so avoid integer-only assumptions
---

Some products are sold in fractional quantities. Preserve legitimate fractional stock values; the long decimal tails and near-zero leftovers shown by the ERP are floating-point artifacts, not a reason to round all inventory to whole units.

**Why:** The user reported products sold with decimal quantities in an existing company.

**How to apply:** Format stock for people, and treat only machine-scale residue around zero as zero for availability and sale completion. Do not bulk-rewrite existing stock without authorization.
