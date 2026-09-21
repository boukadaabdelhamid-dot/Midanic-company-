---
name: Railway wildcard DNS validation
description: Cloudflare proxy behavior that prevents Railway wildcard-domain ownership and TLS validation
---

Railway wildcard custom domains require both the wildcard service CNAME and the `_acme-challenge` CNAME to expose Railway's requested targets directly. Keep both records DNS-only while Railway validates ownership and issues the certificate.

**Why:** Cloudflare's proxy hides the CNAME targets. Railway then reports stale or missing DNS values and remains in `CERTIFICATE_STATUS_TYPE_VALIDATING_OWNERSHIP`, while browsers fail the TLS handshake even though the underlying service is healthy.

**How to apply:** When a `*.store.midanic.com` storefront domain fails before reaching the app, compare Railway's required records with Cloudflare and verify `proxied: false` on both records before investigating application routing.