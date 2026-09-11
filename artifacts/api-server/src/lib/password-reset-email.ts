interface PasswordResetEmailOptions {
  to: string;
  resetUrl: string;
}

function senderFromEnvironment(): { name: string; email: string } {
  const raw = process.env["EMAIL_FROM"]
    ?? process.env["RESEND_FROM"]
    ?? process.env["SMTP_FROM"]
    ?? process.env["SMTP_USER"]
    ?? "no-reply@midanic.com";
  const match = raw.match(/^(.*?)\s*<([^>]+)>$/);
  return match
    ? { name: match[1].replace(/^"|"$/g, "").trim() || "Midanic", email: match[2].trim() }
    : { name: "Midanic", email: raw.trim() };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

function html(resetUrl: string): string {
  const safeResetUrl = escapeHtml(resetUrl);
  return `<!doctype html><html lang="en"><body style="font-family:Arial,sans-serif;background:#f4f6f8;padding:32px">
    <main style="max-width:520px;margin:auto;background:#fff;border-radius:12px;padding:32px">
      <h2 style="color:#172033">Midanic · إعادة تعيين كلمة المرور</h2>
      <p>We received a request to reset your Midanic password.</p>
      <p dir="rtl">تلقينا طلبًا لإعادة تعيين كلمة مرور حسابك في ميدانيك.</p>
      <p><a href="${safeResetUrl}" style="display:inline-block;background:#347ff0;color:#fff;text-decoration:none;padding:12px 22px;border-radius:7px">Reset password / إعادة التعيين</a></p>
      <p style="color:#667085;font-size:13px">This link expires in one hour and can only be used once.</p>
    </main>
  </body></html>`;
}

export async function sendPasswordResetEmail(options: PasswordResetEmailOptions): Promise<void> {
  const sender = senderFromEnvironment();
  const resendApiKey = process.env["RESEND_API_KEY"];
  const brevoApiKey = process.env["BREVO_API_KEY"];

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
        to: [options.to],
        subject: "Reset your Midanic password / إعادة تعيين كلمة المرور",
        html: html(options.resetUrl),
        text: `Reset your Midanic password: ${options.resetUrl}\n\nThis link expires in one hour and can only be used once.`,
      }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({})) as { message?: string; name?: string };
      throw new Error(`Password reset email failed: ${payload.message ?? payload.name ?? response.statusText}`);
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
        to: [{ email: options.to }],
        subject: "Reset your Midanic password / إعادة تعيين كلمة المرور",
        htmlContent: html(options.resetUrl),
        textContent: `Reset your Midanic password: ${options.resetUrl}\n\nThis link expires in one hour and can only be used once.`,
      }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({})) as { message?: string };
      throw new Error(`Password reset email failed: ${payload.message ?? response.statusText}`);
    }
    return;
  }

  if (!resendApiKey && !brevoApiKey) {
    if (process.env["NODE_ENV"] !== "production") {
      console.info(`[password-reset] Email provider is not configured. Reset link: ${options.resetUrl}`);
      return;
    }
    throw new Error("Password reset email delivery is not configured. Set RESEND_API_KEY or BREVO_API_KEY.");
  }
}
