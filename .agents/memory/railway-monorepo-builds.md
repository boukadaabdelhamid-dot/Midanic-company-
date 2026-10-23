---
name: Railway monorepo builds
description: Durable constraints for building Midanic's independent Railway services from one repository
---

Each Railway service must build from the Midanic repository root and target its own Dockerfile. Dockerfiles must copy the workspace source and lockfile directly; they must not clone a historical repository during the build.

**Why:** The repository contains shared workspace packages and separate Platform, ERP API, ERP Web, and Web Store artifacts. Building from an artifact subdirectory or cloning an older repository produces missing workspace configuration or deploys the wrong service.

**How to apply:** Configure Railway Root Directory as `/`, use the service-specific Dockerfile path, and pass frontend `VITE_API_URL` values as build arguments.

Production build inputs must be versioned application files, not workspace uploads in `attached_assets`.

**Why:** Replit's uploaded attachments can exist locally while being globally Git-ignored, so a local build can pass even though GitHub-backed Railway builds cannot copy or import those files.

**How to apply:** Keep required small branding assets with application source, leave unrelated uploaded attachments out of Docker images, and verify that every Docker COPY source is available in the repository snapshot.