---
name: Midanic API routing
description: The Midanic web and API are separate artifacts, so local and published request routing behave differently.
---

The Midanic frontend and Express API are separate artifacts. In development, Vite must proxy `/api` to the API service; otherwise its SPA fallback returns `index.html` and JSON clients fail on the leading `<`. In production, the `/api` path is expected to be routed by the artifact services rather than by the static frontend.

CRM trial/demo request tables store `product_id` as text while `products.id` is numeric. Their joins must cast the numeric product id to text in SQL; comparing the columns directly causes PostgreSQL query failures.

The frontend session restore endpoint is `/api/profile`; `/api/my/profile` does not exist. A 404 during startup causes the client to clear valid tokens and redirect an authenticated admin to the public homepage.

**Why:** The CRM failure first produced HTML with HTTP 200 because the browser request reached the frontend fallback, then exposed a second server-side failure caused by the mismatched join column types. The admin refresh issue similarly came from a client/server route mismatch.

**How to apply:** Keep same-origin frontend requests (`/api/...`), retain the Vite `/api` proxy for development, use `/api/profile` for session restoration, cast `products.id` when joining trial/demo requests, and verify `/api/healthz`, `/api/profile`, and authenticated CRM endpoints after each deployment or routing change.