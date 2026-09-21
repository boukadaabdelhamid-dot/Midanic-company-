---
name: External deployment uploads
description: Object upload behavior when the API runs outside Replit
---

Replit Object Storage's signing sidecar is local to Replit and cannot be called by an API running on Railway or another external host. Upload code must select a backend based on runtime capability instead of assuming `127.0.0.1:1106` exists.

**Why:** The production site used an external deployment, so image uploads failed while the same endpoint worked in the Replit development workflow.

**How to apply:** Keep the Replit sidecar path for Replit deployments and use the shared Cloudflare R2 bucket for Railway services. Reuse R2 credentials through Railway reference variables instead of duplicating secret values, and keep stored image URLs relative to the serving API.