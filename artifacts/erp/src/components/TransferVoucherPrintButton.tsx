import { Button } from "@/components/ui/button";
import { useLang } from "@/hooks/use-lang";
import type { StockTransferDetail, StoreLite } from "@workspace/erp-api-client-react";
import { Printer } from "lucide-react";

function escapeHtml(value: unknown): string {
  return String(value ?? "—").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

export default function TransferVoucherPrintButton({
  transfer,
  currentStoreId,
}: {
  transfer: StockTransferDetail;
  currentStoreId: number | null;
}) {
  const { lang } = useLang();
  const tr = (fr: string, ar: string) => useLang.translate(lang, fr, ar);
  const isArabic = lang === "ar";

  function handlePrint() {
    const printWindow = window.open("", "_blank", "width=900,height=900");
    if (!printWindow) {
      window.alert(tr(
        "Autorisez les fenêtres contextuelles pour imprimer le bon.",
        "يرجى السماح بالنوافذ المنبثقة لطباعة بون التحويل.",
      ));
      return;
    }

    const locale = isArabic ? "ar-DZ" : lang === "en" ? "en-GB" : "fr-DZ";
    const formatDate = (value?: string | null) => value
      ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
      : "—";
    const storeName = (store?: StoreLite | null) =>
      isArabic ? store?.nameAr || store?.nameEn || "—" : store?.nameEn || store?.nameAr || "—";
    const storeCard = (store: StoreLite | undefined, labelFr: string, labelAr: string) => {
      const details: [string, string | null | undefined][] = [
        [tr("Adresse", "العنوان"), store?.address],
        [tr("Téléphone", "الهاتف"), store?.phone],
        ["NIF", store?.nif],
        ["RC", store?.rc],
        ["AI", store?.ai],
      ];
      const presentDetails = details.filter(([, value]) => typeof value === "string" && value.trim().length > 0);
      return `<div class="store-card">
        <div class="label">${escapeHtml(tr(labelFr, labelAr))}</div>
        <div class="store-name">${escapeHtml(storeName(store))}</div>
        ${presentDetails.length
          ? presentDetails.map(([label, value]) => `<div class="store-line"><span class="store-field-label">${escapeHtml(label)}:</span> ${escapeHtml(value)}</div>`).join("")
          : `<div class="store-empty">${escapeHtml(tr("Coordonnées non renseignées", "لم تُسجّل معلومات المتجر"))}</div>`}
      </div>`;
    };
    const statusFr: Record<string, string> = {
      requested: transfer.directSend ? "Créé" : "Demandé",
      approved: "Approuvé",
      rejected: "Rejeté",
      prepared: "Préparé",
      in_transit: transfer.directSend ? "Envoyé" : "En transit",
      received: "Reçu",
      cancelled: "Annulé",
    };
    const statusAr: Record<string, string> = {
      requested: transfer.directSend ? "تم الإنشاء" : "طلب",
      approved: "مقبول",
      rejected: "مرفوض",
      prepared: "محضّر",
      in_transit: transfer.directSend ? "تم الإرسال" : "في الطريق",
      received: "مستلم",
      cancelled: "ملغى",
    };
    const status = tr(statusFr[transfer.status] ?? transfer.status, statusAr[transfer.status] ?? transfer.status);
    const side = currentStoreId === transfer.sourceStoreId
      ? tr("Copie du magasin source", "نسخة المتجر المصدر")
      : currentStoreId === transfer.destinationStoreId
        ? tr("Copie du magasin destinataire", "نسخة المتجر المستقبِل")
        : tr("Copie du transfert", "نسخة التحويل");
    const items = transfer.items ?? [];
    const totalQuantity = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const allReceiptQuantitiesRecorded = items.length > 0 && items.every((item) => item.receivedQuantity != null);
    const totalReceivedQuantity = items.reduce((sum, item) => sum + Number(item.receivedQuantity ?? 0), 0);

    const rows = items.map((item, index) => {
      const productName = isArabic
        ? item.sourceProductNameAr || item.sourceProductNameEn || `#${item.sourceProductId}`
        : item.sourceProductNameEn || item.sourceProductNameAr || `#${item.sourceProductId}`;
      const quantity = new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(item.quantity);
      const receivedQuantity = item.receivedQuantity == null
        ? null
        : new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(item.receivedQuantity);
      const difference = item.receivedQuantity == null ? null : item.quantity - item.receivedQuantity;
      const differenceNote = difference == null || difference === 0
        ? ""
        : difference > 0
          ? `${tr("Manquant", "الناقص")}: ${new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(difference)}`
          : `${tr("Excédent", "زيادة")}: ${new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(Math.abs(difference))}`;
      return `<tr>
        <td class="number">${index + 1}</td>
        <td>${escapeHtml(productName)}</td>
        <td class="code">${escapeHtml(item.matchKey)}</td>
        <td class="quantity">${escapeHtml(quantity)}</td>
        <td class="count-cell">${receivedQuantity == null ? "" : escapeHtml(receivedQuantity)}</td>
        <td class="note-cell">${escapeHtml(differenceNote)}</td>
      </tr>`;
    }).join("");

    const html = `<!doctype html>
      <html lang="${isArabic ? "ar" : lang === "en" ? "en" : "fr"}" dir="${isArabic ? "rtl" : "ltr"}">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>${escapeHtml(tr("Bon de transfert inter-magasins", "سند تحويل بين المتاجر"))} #${transfer.id}</title>
        <style>
          @page { size: A4 landscape; margin: 12mm; }
          * { box-sizing: border-box; }
          body { margin: 0; color: #172033; font-family: Arial, "Segoe UI", sans-serif; font-size: 12px; }
          h1 { margin: 0; font-size: 22px; }
          .sheet { width: 100%; }
          .topline { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; border-bottom: 2px solid #1b3057; padding-bottom: 12px; }
          .brand { color: #1b3057; font-size: 11px; font-weight: 700; letter-spacing: .08em; margin-bottom: 5px; }
          .copy { border: 1px solid #d7deea; border-radius: 4px; padding: 6px 9px; white-space: nowrap; color: #42516a; }
          .reference { margin-top: 6px; color: #42516a; font-size: 14px; font-weight: 700; }
          .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 20px; margin: 18px 0; }
          .meta-item { border-bottom: 1px solid #e1e6ef; padding-bottom: 7px; }
          .stores { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 18px 0; }
          .store-card { border: 1px solid #d7deea; border-radius: 5px; padding: 10px; min-height: 78px; }
          .store-name { font-size: 14px; font-weight: 700; margin: 4px 0 6px; }
          .store-line { margin-top: 3px; font-size: 10px; overflow-wrap: anywhere; }
          .store-field-label { color: #65718a; font-weight: 600; }
          .store-empty { color: #7b8496; font-size: 10px; }
          .label { color: #65718a; font-size: 10px; margin-bottom: 3px; }
          .value { font-weight: 600; }
          table { width: 100%; border-collapse: collapse; margin-top: 7px; }
          th, td { border: 1px solid #cfd6e2; padding: 8px 7px; text-align: start; vertical-align: top; }
          th { background: #eef2f8; font-size: 10px; }
          tbody tr { break-inside: avoid; }
          .number, .quantity { text-align: center; white-space: nowrap; }
          .code { font-family: ui-monospace, Consolas, monospace; font-size: 10px; }
          .count-cell { min-width: 85px; height: 34px; }
          .note-cell { min-width: 110px; }
          tfoot td { font-weight: 700; background: #f7f8fb; }
          .notes { margin-top: 16px; border: 1px solid #d7deea; min-height: 38px; padding: 8px; white-space: pre-wrap; }
          .signatures { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; margin-top: 34px; }
          .signature { min-height: 70px; border-top: 1px solid #69758b; padding-top: 7px; color: #49556b; font-size: 10px; }
          .footer { margin-top: 18px; color: #7b8496; font-size: 9px; text-align: center; }
          @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        <main class="sheet">
          <header class="topline">
            <div>
              <div class="brand">MIDANIC ERP</div>
              <h1>${escapeHtml(tr("Bon de transfert inter-magasins", "سند تحويل بين المتاجر"))}</h1>
              <div class="reference">#${transfer.id}</div>
            </div>
            <div class="copy">${escapeHtml(side)}</div>
          </header>
          <section class="stores">
            ${storeCard(transfer.sourceStore, "Magasin source", "المتجر المصدر")}
            ${storeCard(transfer.destinationStore, "Magasin destination", "المتجر الوجهة")}
          </section>
          <section class="meta">
            <div class="meta-item"><div class="label">${escapeHtml(tr("Date de création", "تاريخ الإنشاء"))}</div><div class="value">${escapeHtml(formatDate(transfer.createdAt))}</div></div>
            <div class="meta-item"><div class="label">${escapeHtml(tr("État", "الحالة"))}</div><div class="value">${escapeHtml(status)}</div></div>
            <div class="meta-item"><div class="label">${escapeHtml(tr("Préparé le", "تاريخ التحضير"))}</div><div class="value">${escapeHtml(formatDate(transfer.preparedAt))}</div></div>
            <div class="meta-item"><div class="label">${escapeHtml(tr("Envoyé le", "تاريخ الإرسال"))}</div><div class="value">${escapeHtml(formatDate(transfer.shippedAt))}</div></div>
          </section>
          <div class="label">${escapeHtml(tr("Articles à vérifier", "الأصناف المطلوب عدّها"))}</div>
          <table>
            <thead><tr>
              <th class="number">N°</th>
              <th>${escapeHtml(tr("Produit", "المنتج"))}</th>
              <th>${escapeHtml(tr("Référence / code-barres", "المرجع / الباركود"))}</th>
              <th class="quantity">${escapeHtml(tr("Quantité envoyée", "الكمية المرسلة"))}</th>
              <th class="quantity">${escapeHtml(tr("Quantité reçue", "الكمية المستلمة"))}</th>
              <th>${escapeHtml(tr("Écart / observation", "الفرق / ملاحظة"))}</th>
            </tr></thead>
            <tbody>${rows || `<tr><td colspan="6">${escapeHtml(tr("Aucun article", "لا توجد أصناف"))}</td></tr>`}</tbody>
            <tfoot><tr>
              <td colspan="3">${escapeHtml(tr("Total des unités", "مجموع الوحدات"))}</td>
              <td class="quantity">${escapeHtml(new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(totalQuantity))}</td>
              <td class="quantity">${allReceiptQuantitiesRecorded ? escapeHtml(new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(totalReceivedQuantity)) : ""}</td>
              <td>${allReceiptQuantitiesRecorded && totalReceivedQuantity < totalQuantity
                ? escapeHtml(`${tr("Manquant", "الناقص")}: ${new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(totalQuantity - totalReceivedQuantity)}`)
                : ""}</td>
            </tr></tfoot>
          </table>
          ${transfer.notes ? `<section class="notes"><div class="label">${escapeHtml(tr("Notes", "ملاحظات"))}</div>${escapeHtml(transfer.notes)}</section>` : ""}
          <section class="signatures">
            <div class="signature">${escapeHtml(tr("Préparé par", "جهّز التحويل"))}</div>
            <div class="signature">${escapeHtml(tr("Remis par", "سلّم التحويل"))}</div>
            <div class="signature">${escapeHtml(tr("Reçu et compté par", "استلم وعدّ الأصناف"))}</div>
          </section>
          <div class="footer">${escapeHtml(tr("Document de comptage — conserver une copie avec le transfert.", "سند لمطابقة الكميات — تُحفظ نسخة مع التحويل."))}</div>
        </main>
      </body>
      </html>`;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onafterprint = () => printWindow.close();
    window.setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 300);
  }

  return (
    <Button type="button" size="sm" variant="outline" onClick={handlePrint} data-testid="button-print-transfer">
      <Printer className="h-4 w-4 mr-1" />
      {tr("Imprimer le bon de transfert", "طباعة بون التحويل")}
    </Button>
  );
}
