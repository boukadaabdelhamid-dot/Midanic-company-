---
name: Mobile store-session synchronization
description: The active store in Mobile must stay synchronized with the server session token.
---

The active store is represented in two places: local Mobile state/storage and the server-issued JWT. A store switch is incomplete unless it persists both values from the selection response.

**Why:** The API authorizes transfer actions from the store encoded in the JWT, while UI guards may use the locally selected store. If only local state changes, Mobile can show destination-only actions while the API still sees the source store and returns a 403.

**How to apply:** Whenever `useSelectStore` succeeds, save the returned token before clearing or invalidating queries, then persist the returned store ID and reload store-scoped data.