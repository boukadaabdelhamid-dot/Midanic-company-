---
name: Expense report drill-down
description: Product rules for opening itemized expenses from monthly reports
---

When a user opens a monthly Charges amount, show the itemized operating expenses for that month, limited to the report's selected date range and current store. The detail total must reconcile with the monthly amount and use the same exclusions for inventory purchases and return/PO records.

**Why:** the user wants to inspect all charges behind the reported amount for the selected period.

**How to apply:** preserve the report's store/date context when opening details, and keep summary and detail filters consistent so the itemized list explains the displayed total.

Reconciliation checks should execute the actual PostgreSQL expense queries against an isolated, disposable database rather than reimplementing their predicates in JavaScript.

**Why:** PostgreSQL timestamp precision, month grouping, and inclusive range boundaries can produce mismatches that simplified database doubles hide, especially at exact next-month midnight.

**How to apply:** include precise day/month boundary fixtures and compare each monthly Charges value with its actual itemized response; never use existing tenant data as accounting test fixtures.
