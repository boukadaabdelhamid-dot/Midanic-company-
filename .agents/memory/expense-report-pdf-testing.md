---
name: Expense report PDF checks
description: Lessons for validating RTL/LTR text and pagination in browser-generated expense report PDFs
---

When checking an RTL expense-report PDF with Poppler, text extraction can reorder Latin reference fragments around Arabic description text and add directional controls or line breaks. Verify the printed PDF itself, strip bidi controls and whitespace for token checks, and avoid assuming that a mixed-direction marker stays contiguous in extracted reading order.

**Why:** text extraction follows bidirectional and column-layout rules that can differ from the visual PDF; naive exact-string assertions can report false truncation.

**How to apply:** use a real browser print-to-PDF run, check page-level repeated headers and complete row markers, and visually inspect Arabic output when judging clipping.
