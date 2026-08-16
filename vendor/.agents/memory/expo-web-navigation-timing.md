---
name: Expo Web navigation timing
description: A non-obvious constraint for redirecting from protected Expo Router screens on direct web loads.
---

Protected Expo Router screens can render before the root navigation container is mounted when opened directly in the browser. Redirects issued during that window throw the “Attempted to navigate before mounting the Root Layout component” error.

**Why:** Direct preview URLs exposed a startup-only navigation failure even though the app loaded normally from the root route.

**How to apply:** Gate redirects on the root navigation state being ready and defer the redirect by one event-loop turn. Apply the same guard to forced logout handlers and customer/permission redirects.