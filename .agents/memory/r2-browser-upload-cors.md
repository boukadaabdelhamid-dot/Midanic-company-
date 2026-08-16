---
name: R2 browser upload CORS
description: Cross-origin requirements for direct browser uploads to the external R2 bucket
---

Cloudflare R2 buckets used for direct browser uploads must define CORS rules for the production origins, including `PUT`, `GET`, and `HEAD`, plus the request headers used by the uploader.

**Why:** The API can successfully generate a presigned URL and R2 credentials can be valid, yet browsers report only `Failed to fetch` when the bucket has no CORS configuration.

**How to apply:** When adding or replacing an external object-storage bucket, configure CORS for every real web origin before debugging application upload code; test both the preflight and the actual `PUT` with an `Origin` header.