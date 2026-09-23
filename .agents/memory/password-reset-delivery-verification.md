---
name: Password reset delivery verification
description: The password recovery endpoint masks provider failures, so delivery must be checked in production logs or provider events.
---

The forgot-password endpoint intentionally returns a generic success response even when the email provider rejects the request, to avoid account enumeration. A successful HTTP response is therefore not evidence that a reset email was sent.

**Why:** A production test returned HTTP 200 while Railway logged a Brevo `Key not found` error.

**How to apply:** After changing password-reset email configuration, inspect the production service logs and a provider delivery event before confirming delivery. Never expose API keys in chat.