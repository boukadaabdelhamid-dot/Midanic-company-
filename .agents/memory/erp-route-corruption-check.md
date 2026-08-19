---
name: ERP route corruption check
description: A troubleshooting guard for ERP API route files whose source begins mid-expression
---

When an ERP API route reports a parser error at the first line, inspect the beginning of the file and its import/router declarations before chasing later syntax errors. A file can be committed with its prefix truncated, causing misleading errors at unrelated closing braces.

**Why:** The ERP API route files can remain syntactically damaged across otherwise normal repository commits, so compiler diagnostics may identify only the first downstream token rather than the underlying corruption.

**How to apply:** Compare the route's opening structure with sibling routes, restore imports, router initialization, helper declarations, and the opening handler together, then run the package build and typecheck.