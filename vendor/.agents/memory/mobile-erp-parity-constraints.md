---
name: Mobile ERP parity constraints
description: Durable constraints for validating ERP parity work in the Expo mobile client.
---

Mobile ERP screens can be typechecked and bundled successfully while the browser preview still stops at server setup when no authenticated session and configured ERP URL are present.

**Why:** The preview environment does not provide a ready staff session, so screenshots cannot validate authenticated Articles, Inventory, or Product Detail states.

**How to apply:** Validate authenticated behavior through generated hooks and typechecks, and treat unauthenticated setup-screen screenshots as a startup check rather than proof of feature-level visual parity.