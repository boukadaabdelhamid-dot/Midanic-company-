---
name: Mobile product form parity
description: Product create/edit parity in Mobile follows the generated API contract and avoids unsupported ERP-only controls.
---

Product create/edit parity should cover every product field and interaction supported by the generated Mobile API hooks, while unsupported ERP-only operations remain explicitly out of scope.

**Why:** The ERP Web source is not available in this workspace, and adding guessed endpoints or bypassing generated contracts would make Mobile diverge from the real API.

**How to apply:** When comparing future product dialogs, verify fields against the current OpenAPI-generated requests first; add UI only when the existing Mobile client can submit and persist it safely.