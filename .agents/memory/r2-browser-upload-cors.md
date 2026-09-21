---
name: R2 browser upload CORS
description: Cross-origin requirements for direct browser uploads to the external R2 bucket
---

Cloudflare R2 buckets used for direct browser uploads must define CORS rules for the production origins, including `PUT`, `GET`, and `HEAD`, plus the request headers used by the uploader.

**Why:** The API can successfully generate a presigned URL and R2 credentials can be valid, yet browsers report only `Failed to fetch` when the bucket has no CORS configuration.

**How to apply:** Allow the origin that actually serves the admin UI. Until the custom dashboard domain is active, this includes `midanic-platform-production.up.railway.app`; keep `app.midanic.com` ready for the cutover. Manage the list through Railway and verify preflight returns `204`.