---
name: Mobile image upload
description: Multipart image uploads need different file construction on Expo Web and native platforms.
---

When Mobile runs through Expo Web, browser FormData requires a fetched Blob with a filename; the native `{ uri, type, name }` object is only appropriate for native fetch implementations.

**Why:** The upload endpoint correctly requires a multipart `file` field, but Expo Web otherwise sends the URI descriptor as a non-file value and receives HTTP 400.

**How to apply:** Keep platform-specific FormData construction in the Mobile image helper, and preserve server error details when reporting failed uploads.