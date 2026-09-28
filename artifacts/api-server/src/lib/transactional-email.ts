interface TransactionalEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

function senderFromEnvironment(): { name: string; email: string } {
  const raw =
    process.env["EMAIL_FROM"] ??
    process.env["RESEND_FROM"] ??
    process.env["SMTP_FROM"] ??
    process.env["SMTP_USER"] ??
    "no-reply@midanic.com";
  const match = raw.match(/^(.*?)\s*<([^>]+)>$/);
  return match
    ? {
        name: match[1].replace(/^"|"$/g, "").trim() || "Midanic",
        email: match[2].trim(),
      }
    : { name: "Midanic", email: raw.trim() };
}

async function responseError(response: Response): Promise<string> {
  const payload = await response.json().catch(() => ({})) as {
    message?: string;
    name?: string;
  };
  return payload.message ?? payload.name ?? response.statusText;
}

export async function sendTransactionalEmail(email: TransactionalEmail): Promise<void> {
  const sender = senderFromEnvironment();
  const resendApiKey = process.env["RESEND_API_KEY"];
  const brevoApiKey = process.env["SMTP_API_BREVO"] ?? process.env["BREVO_API_KEY"];

  if (resendApiKey) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        from: `${sender.name} <${sender.email}>`,
        to: [email.to],
        subject: email.subject,
        html: email.html,
        text: email.text,
      }),
    });
    if (!response.ok) {
      throw new Error(`Email delivery failed: ${await responseError(response)}`);
    }
    return;
  }

  if (brevoApiKey) {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": brevoApiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender,
        to: [{ email: email.to }],
        subject: email.subject,
        htmlContent: email.html,
        textContent: email.text,
      }),
    });
    if (!response.ok) {
      throw new Error(`Email delivery failed: ${await responseError(response)}`);
    }
    return;
  }

  throw new Error("Email delivery is not configured. Set SMTP_API_BREVO.");
}