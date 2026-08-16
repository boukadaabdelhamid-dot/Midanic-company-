---
name: Admin settings persistence
description: Durable rules for storing and applying administrator panel appearance settings.
---

Admin appearance settings belong in the database and must be reloaded from the API after a full refresh; browser storage may only be used for temporary UI state. Human-facing admin text is stored as separate en/fr/ar values and the active page language selects the displayed value. Uploaded background images must be stored as object-storage URLs, never as binary data in PostgreSQL.

**Why:** The administrator expects branding changes and translations to survive reloads and deployments, while large image files should remain outside the relational database.

**How to apply:** Keep settings behind super-admin authorization, validate theme/colors/layout values server-side, choose en/fr/ar text from the current i18n language, and reuse the existing object-storage upload flow for background images.