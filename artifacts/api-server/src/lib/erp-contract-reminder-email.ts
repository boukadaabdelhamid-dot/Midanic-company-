import { sendTransactionalEmail } from "./transactional-email";

type Language = "en" | "fr" | "ar";

interface ErpContractReminderOptions {
  to: string;
  companyName: string;
  contractEndsAt: string;
  daysLeft: number;
  language: string | null;
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

function getReminderCopy(language: Language, daysLeft: number) {
  if (language === "fr") {
    const duration = daysLeft === 1 ? "1 jour" : `${daysLeft} jours`;
    return {
      subject: "Rappel de renouvellement de votre contrat ERP",
      title: "Votre contrat ERP arrive à expiration",
      message: `Votre contrat ERP arrive à expiration dans ${duration}.`,
      renewal: "Renouvelez votre contrat avant cette date pour éviter toute interruption d’accès.",
      footer: "Pour renouveler votre contrat, contactez l’équipe Midanic.",
    };
  }
  if (language === "ar") {
    const duration = daysLeft === 1 ? "يوم واحد" : `${daysLeft} أيام`;
    return {
      subject: "تذكير بتجديد عقد ERP",
      title: "اقترب موعد انتهاء عقد ERP",
      message: `سينتهي عقد ERP خلال ${duration}.`,
      renewal: "جدّد عقدك قبل هذا التاريخ لتجنّب انقطاع الوصول.",
      footer: "لتجديد عقدك، تواصل مع فريق ميدانيك.",
    };
  }
  const duration = daysLeft === 1 ? "1 day" : `${daysLeft} days`;
  return {
    subject: "ERP contract renewal reminder",
    title: "Your ERP contract is expiring",
    message: `Your ERP contract expires in ${duration}.`,
    renewal: "Renew before this date to avoid an interruption in access.",
    footer: "Contact the Midanic team to renew your contract.",
  };
}

function formatContractDate(date: string, language: Language): string {
  const locale = language === "fr" ? "fr-DZ" : language === "ar" ? "ar-DZ" : "en-GB";
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00.000Z`));
}

export async function sendErpContractReminderEmail(
  options: ErpContractReminderOptions,
): Promise<void> {
  const language: Language =
    options.language === "fr" || options.language === "ar" ? options.language : "en";
  const copy = getReminderCopy(language, options.daysLeft);
  const company = escapeHtml(options.companyName);
  const expiresAt = formatContractDate(options.contractEndsAt, language);
  const direction = language === "ar" ? "rtl" : "ltr";
  const text = [
    copy.title,
    "",
    copy.message,
    `${options.companyName}: ${expiresAt}`,
    copy.renewal,
    copy.footer,
  ].join("\n");
  const html = `<!doctype html><html lang="${language}" dir="${direction}"><body style="font-family:Arial,sans-serif;background:#f4f6f8;padding:32px">
    <main style="max-width:560px;margin:auto;background:#fff;border-radius:12px;padding:32px">
      <h2 style="color:#172033">${copy.title}</h2>
      <p>${copy.message}</p>
      <p><strong>${company}</strong> · ${escapeHtml(expiresAt)}</p>
      <p>${copy.renewal}</p>
      <p style="color:#667085;font-size:13px">${copy.footer}</p>
    </main>
  </body></html>`;

  await sendTransactionalEmail({
    to: options.to,
    subject: copy.subject,
    html,
    text,
  });
}