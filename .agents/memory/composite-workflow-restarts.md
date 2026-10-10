---
name: Composite workflow restarts
description: How restarting the Replit Run workflow interacts with already-running artifact services
---

When the project Run workflow starts artifact-owned services, stop existing child workflows before manually restarting the composite in the same session. A composite restart can launch a second server before the prior child listener has exited, producing misleading port-in-use failures even though the original app remains reachable.

**Why:** Repeatedly restarting a composite while children were already running left healthy old listeners occupying ports and new child workflow runs marked failed.

**How to apply:** Prefer starting the Run workflow from a stopped state. If it reports port conflicts, inspect listeners, stop the child workflows, then start the composite once; verify the proxied app and health endpoints rather than relying solely on a stale workflow status.