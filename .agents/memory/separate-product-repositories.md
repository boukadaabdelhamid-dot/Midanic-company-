---
name: Separate product repositories
description: Durable repository boundary for the Midanic platform and driving-school desktop app
---

The Midanic platform and the driving-school desktop application are separate GitHub products and must remain separate Git repositories, even when the desktop source is present under the workspace for local development.

**Why:** The workspace once contained desktop-client inside the platform repository history, which made a normal push risk sending desktop files to the platform repository.

**How to apply:** Verify the repository root, remote URL, branch, and changed-file scope before every push. Push platform files only to `platforme-midanic`; push driving-school files only to `medanic-driving-school`.