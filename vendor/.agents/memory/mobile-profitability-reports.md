---
name: Mobile profitability reports
description: Scope and data-source rules for the Mobile profitability reporting screen.
---

The Mobile profitability screen uses the existing analytics and admin report hooks for monthly, product, customer, and supplier views. It derives mobile-friendly charts and metric cards from those typed responses rather than adding report endpoints or copying desktop-wide tables.

**Why:** ERP exposes the detailed report contracts already, while Mobile previously showed only a fixed 30-day summary. The app must remain Mobile-only and avoid API/codegen changes.

**How to apply:** Keep the admin-only boundary, pass explicit `from`/`to` dates to report hooks, use the analytics endpoint for the fixed 30-day summary, and present detailed rows as stacked mobile cards with manual refresh only.