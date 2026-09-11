---
name: Password reset delivery
description: Password recovery uses short-lived hashed tokens and requires a configured transactional email provider in production
---

## Rule
Password reset tokens are stored only as SHA-256 hashes, expire after one hour, are single-use, and reset completion revokes the user's refresh sessions. Production email delivery uses `RESEND_API_KEY` first, with `BREVO_API_KEY` as a compatibility fallback, plus a configured public web URL.

**Why:** Account recovery needs to remain safe even if database contents are exposed, while the app must not claim an email was sent when no provider is configured.

**How to apply:** Keep the forgot-password response generic for unknown addresses, configure `RESEND_API_KEY` and `MIDANIC_WEB_URL` (and a verified `EMAIL_FROM`) for production, and use development logs only for local testing.