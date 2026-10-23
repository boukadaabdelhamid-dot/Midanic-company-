---
name: Primary product barcode integrity
description: Preserve legacy product records while preventing new duplicate primary barcodes.
---

Primary product barcodes should be unique within a store for new writes, but existing duplicate product rows must not be deleted or merged automatically. Check barcode ownership in the same transaction as creation or barcode changes, and serialize competing writes.

**Why:** Existing product rows may be referenced by sales, purchases, returns, or stock movements; a database-wide unique constraint can also fail to deploy while legacy duplicates remain.

**How to apply:** Cover product creation, barcode edits, imports, and cross-store copies. Treat any cleanup of legacy duplicates as a separate review that checks linked history and requires explicit approval before changing records.
