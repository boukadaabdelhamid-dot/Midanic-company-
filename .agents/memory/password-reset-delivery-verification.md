---
name: Password reset delivery verification
description: The password recovery endpoint masks provider failures, so delivery must be checked in production logs or provider events.
---

The forgot-password endpoint intentionally returns a generic success response even when the email provider rejects the request, to avoid account enumeration. A successful HTTP response is therefore not evidence that a reset email was sent.

**Why:** A production test returned HTTP 200 while Railway logged a Brevo `Key not found` error.

**How to apply:** After changing password-reset email configuration, inspect the production service logs and a provider delivery event before confirming delivery. Never expose API keys in chat.

The Replit Brevo inspection connection and Railway's production `SMTP_API_BREVO` setting are separate credentials. A 401 from the Replit connector proves only that the inspection connection was rejected; it does not establish that production sends use an invalid key.

**Why:** The admin-side connection is used to inspect Brevo events, while the deployed API sends mail using its own Railway environment variable.

**How to apply:** Repair the Replit connector through its secure integration flow before querying Brevo events. Do not change the Railway mail secret based only on a connector 401.

When Brevo IP authorization is active, a blocked Railway egress IP can cause API requests to fail with 401. In this project, password-reset delivery succeeded after the blocked Railway IP was authorized.

**Why:** A successful reset-email test after the allowlist change confirmed that the production sender was being blocked by IP authorization, not necessarily by a bad API key.

**How to apply:** Before replacing Brevo credentials after a 401, inspect Brevo's unauthorized-IP list and match the source to the production service. Authorize only a verified service IP; if Railway egress is not static, expect it may change.