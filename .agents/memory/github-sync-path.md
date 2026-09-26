---
name: GitHub sync path
description: Reliable repository synchronization through the connected GitHub integration
---

Use the connected GitHub integration's authenticated proxy for repository writes. Treat the live GitHub branch and tree as the source of truth: the local `origin/main` tracking ref can be stale after proxy updates. For local-tree comparisons, create the Git tree snapshot with the regular shell tool and read that snapshot from CodeExecution; direct CodeExecution shell output can be terminal-wrapped or appear with misleading path prefixes, producing false deletion diffs.

**Why:** Proxy-based branch updates do not refresh local Git tracking, so an ahead count can substantially overstate the unpublished file changes. A previous comparison also incorrectly reported nearly the entire GitHub tree as deleted because the execution sandbox rendered the local tree inconsistently.

**How to apply:** Read the current remote ref and tree through the GitHub proxy. Compare Git blob SHAs and paths against the regular-shell local tree snapshot, preserve the remote tree as the base, upload only changed or added blobs, and require the resulting tree SHA to match the local committed tree before a non-force branch update.