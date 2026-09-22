---
name: Railway custom-domain targets
description: How to distinguish valid Railway custom-domain DNS from a routing or application-data problem
---

Railway custom domains can require random `*.up.railway.app` CNAME targets that differ from the service's human-readable generated domain. Treat Railway's domain-status required value as authoritative, not the service-domain label shown in the service description.

**Why:** A custom domain may resolve to a random Railway target and still be correctly attached; replacing it with the human-readable service domain can break certificate ownership or routing.

**How to apply:** Check the live DNS CNAME and Railway `domainStatus` together before changing Cloudflare records. If DNS is propagated and the service serves the current asset, investigate application routing or database contents instead.