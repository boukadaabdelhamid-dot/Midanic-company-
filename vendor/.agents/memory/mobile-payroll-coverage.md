---
name: Mobile payroll coverage
description: Scope and data-source rules for the employee Paie tab in Mobile.
---

The employee Paie tab is implemented from the existing generated payroll API: adjustments (advance, deduction, bonus), payroll runs, payslips, and payroll generation. It mirrors the ERP sections without adding a Mobile-only endpoint.

**Why:** The Mobile scope excludes API and ERP Web changes, so payroll parity must use the already exposed contract and respect the `payroll` permission section.

**How to apply:** Keep the Paie tab visible to users with payroll view permission, gate mutations with payroll create/delete permissions, invalidate the generated payroll query keys after writes, and lock adjustments with a non-null `payslipId` in the UI. Do not invent print/export behavior without a real API capability.