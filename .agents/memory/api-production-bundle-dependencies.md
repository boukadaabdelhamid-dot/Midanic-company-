---
name: API production bundle dependencies
description: Runtime dependency handling for the API Docker image
---

The API production image copies the esbuild output and frontend assets, but does not install or copy workspace `node_modules`. Any runtime dependency that esbuild leaves external will cause `ERR_MODULE_NOT_FOUND` in the container.

**Why:** The object-storage integration exposed this when `@google-cloud/storage` was listed in the API build's broad external package list.

**How to apply:** When adding a server dependency, either bundle it in `artifacts/api-server/build.mjs` or deliberately add its runtime package tree to the final Docker image, then inspect the built bundle for external imports and start the API before release.