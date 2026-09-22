---
name: Railway redeploy verification
description: Deployment verification for the legacy Plattin Railway repository and source watch rules
---

The legacy Plattin ERP service is deployed from its own `plattino` repository, not the main Midanic repository. Its Railway source watch rules previously monitored only the frontend Dockerfile, so API-only commits could be marked `SKIPPED` while production continued running old backend code.

**Why:** A successful GitHub push or a skipped deployment does not prove that the custom company domain is running the changed API. This can leave authorization and data-routing fixes absent from the customer-facing service.

**How to apply:** When changing Plattin ERP behavior, update the `plattino` repository, verify the deployment commit belongs to that repository, and confirm the deployment status is `SUCCESS` before testing the custom domain. Prefer correcting source watch patterns so normal backend changes trigger builds without a Dockerfile-only workaround.