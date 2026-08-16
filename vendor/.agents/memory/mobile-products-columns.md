---
name: Mobile product columns
description: ERP Articles column behavior and the API limitation around the Vitrine column.
---

The Articles column chooser includes separate Exposé, État, and Vitrine columns; the current generated Product contract exposes isExposed and isActive but no independent Vitrine field.

**Why:** ERP screenshots show Vitrine as a separate eye-status column, while Mobile must not change the API or invent an unsupported persistence field.

**How to apply:** Keep the visual Vitrine column derived from the available exposure state unless the API contract later adds a real Vitrine property; never present it as independently editable while it shares isExposed.