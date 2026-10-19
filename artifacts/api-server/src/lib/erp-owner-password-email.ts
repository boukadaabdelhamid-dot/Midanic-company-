import { sendTransactionalEmail } from "./transactional-email";

interface ErpOwnerPasswordChangedEmailOptions {
  to: string;
  companyName: string;
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

export async function sendErpOwnerPasswordChangedEmail(
  options: ErpOwnerPasswordChangedEmailOptions,
): Promise<void> {
  const companyName = escapeHtml(options.companyName);
  const subject = "Security alert: your Midanic password was changed / تنبيه أمني";
  const text = [
    "The password for your Midanic company owner account was changed by an administrator.",
    `Company: ${options.companyName}`,
    "If you did not expect this change, contact your company administrator.",
    "",
    "تم تغيير كلمة مرور حساب مالك الشركة في ميدانيك بواسطة أحد المسؤولين.",
    `الشركة: ${options.companyName}`,
    "إذا لم تكن تتوقع هذا التغيير، فتواصل مع مسؤول شركتك.",
  ].join("\n");
  const html = `<!doctype html><html lang="en"><body style="font-family:Arial,sans-serif;background:#f4f6f8;padding:32px">
    <main style="max-width:560px;margin:auto;background:#fff;border-radius:12px;padding:32px">
      <h2 style="color:#172033">Midanic security alert</h2>
      <p>The password for your company owner account was changed by an administrator.</p>
      <p><strong>Company:</strong> ${companyName}</p>
      <p>If you did not expect this change, contact your company administrator.</p>
      <hr style="border:0;border-top:1px solid #e4e7ec;margin:24px 0">
      <section dir="rtl" lang="ar">
        <h2 style="color:#172033">تنبيه أمني من ميدانيك</h2>
        <p>تم تغيير كلمة مرور حساب مالك الشركة بواسطة أحد المسؤولين.</p>
        <p><strong>الشركة:</strong> ${companyName}</p>
        <p>إذا لم تكن تتوقع هذا التغيير، فتواصل مع مسؤول شركتك.</p>
      </section>
    </main>
  </body></html>`;

  await sendTransactionalEmail({
    to: options.to,
    subject,
    html,
    text,
  });
}
