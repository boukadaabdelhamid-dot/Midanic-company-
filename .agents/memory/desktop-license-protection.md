---
name: Desktop license protection
description: Durable rule for protecting the standalone Windows customer build
---

Customer-facing desktop builds must stop when the local license guard cannot be imported.

**Why:** A silent import fallback allowed the application to run without activation when the protection file was absent, defeating the licensing requirement.

**How to apply:** Keep the license guard bundled and hidden-imported during PyInstaller builds, and treat a missing or unloadable guard as a startup error rather than continuing unprotected.