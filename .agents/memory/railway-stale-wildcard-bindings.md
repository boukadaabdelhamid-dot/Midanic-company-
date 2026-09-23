---
name: Railway stale wildcard bindings
description: Recovery path when Railway retains an old DNS target for an existing wildcard custom domain
---

When Railway reports an old `currentValue` and remains in certificate `ISSUING` after authoritative DNS already serves the new required CNAME, the existing wildcard binding may be stale. Recreate that custom-domain binding in Railway's dashboard, then apply the newly returned wildcard and `_acme-challenge` CNAME values in Cloudflare with proxying disabled.

**Why:** The connected Railway MCP exposes domain status, listing, and add/generate operations but may not expose custom-domain deletion. Adding the same wildcard is rejected as a duplicate, so changing Cloudflare DNS alone may not force Railway to refresh the binding.

**How to apply:** Delete only the wildcard custom-domain entry in Railway Networking, add the same wildcard again, update both DNS-only records, and wait for `CERTIFICATE_STATUS_TYPE_VALID` before testing the tenant hostname.