---
name: GitHub sync path
description: Reliable repository synchronization through the connected GitHub integration
---

Use the connected GitHub integration's authenticated proxy for repository writes. For local-tree comparisons, create the Git tree snapshot with the regular shell tool and read that snapshot from CodeExecution; direct CodeExecution shell output can be terminal-wrapped or appear with misleading path prefixes, producing false deletion diffs.

**Why:** A previous comparison incorrectly reported nearly the entire GitHub tree as deleted because the execution sandbox rendered the local tree inconsistently. Treat that result as invalid unless the local and remote counts and paths are independently verified.

**How to apply:** Compare Git blob SHAs, preserve the remote commit as `base_tree`, upload only changed or added blobs, and update the branch with a non-force ref update after confirming the remote head has not changed.