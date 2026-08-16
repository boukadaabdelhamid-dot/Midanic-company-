---
name: Mobile sheet scrolling
description: Layout constraint required for scrollable bottom sheets on small screens.
---

Scrollable Mobile bottom sheets need a shrinking sheet, keyboard container, and scroll area; otherwise long option lists can expand beyond the viewport and appear truncated without scrolling.

**Why:** The visible-columns sheet exposed this issue on phone-sized screens because the shared modal had maxHeight but no flex-shrink constraints on its inner layout.

**How to apply:** Preserve the bounded flex layout in shared `SheetModal` when adding or reviewing long lists, pickers, filters, or column selectors.