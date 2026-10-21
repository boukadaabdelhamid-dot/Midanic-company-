import React from "react";
import type { Store } from "@workspace/erp-api-client-react";
import { resolveImg } from "@/lib/utils";
import { useLang } from "@/hooks/use-lang";

export type InvoiceLine = {
  designation: string;
  reference?: string | null;
  qty: number;
  unitPrice: number;
};

export type InvoiceParty = {
  name: string;
  address?: string | null;
  phone?: string | null;
  nif?: string | null;
  rc?: string | null;
  ai?: string | null;
};

export type InvoiceKind = "sale" | "purchase" | "proforma" | "retour";

export type InvoiceData = {
  kind: InvoiceKind;
  number: string;
  date: Date;
  store: Store | null;
  party: InvoiceParty;
  lines: InvoiceLine[];
  showTva: boolean;
  tvaRate: number;
  discountAmount?: number;
  notes?: string;
};

const fmt = (n: number) =>
  n.toLocaleString(useLang.locale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const dateFmt = (d: Date) =>
  d.toLocaleDateString(useLang.locale(), { year: "numeric", month: "2-digit", day: "2-digit" }) +
  " " +
  d.toLocaleTimeString(useLang.locale(), { hour: "2-digit", minute: "2-digit" });

export default function InvoiceTemplate({ data, currency = "دج" }: { data: InvoiceData; currency?: string }) {
  const { lang } = useLang();
  const t = (fr: string, ar: string) => useLang.translate(lang, fr, ar);
  const { store, party, lines, showTva, tvaRate, kind, number, date, notes } = data;
  const grossSubtotalTtc = lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
  const discountAmount = Math.min(grossSubtotalTtc, Math.max(0, Number(data.discountAmount ?? 0)));
  const subtotalTtc = grossSubtotalTtc - discountAmount;
  // When TVA is shown we treat unitPrice as TTC and break it down to HT + TVA.
  const ratio = 1 + tvaRate / 100;
  const subtotalHt = showTva ? subtotalTtc / ratio : subtotalTtc;
  const tvaAmount = showTva ? subtotalTtc - subtotalHt : 0;

  const titleByKind: Record<InvoiceKind, { fr: string; ar: string }> = {
    sale: { fr: "Facture de vente", ar: "فاتورة بيع" },
    purchase: { fr: "Facture d'achat", ar: "فاتورة شراء" },
    proforma: { fr: "Facture proforma", ar: "فاتورة أولية" },
    retour: { fr: "Bon de Retour", ar: "وصل إرجاع" },
  };
  const title = titleByKind[kind];
  const titleText = t(title.fr, title.ar);

  return (
    <div className="invoice-root bg-white text-[#0f172a]">
      <style>{`
        @media print {
          @page { size: A4; margin: 12mm; }
          body { background: white !important; }
          .invoice-root { box-shadow: none !important; margin: 0 !important; }
          .invoice-no-print { display: none !important; }
        }
        .invoice-root {
          width: 210mm;
          min-height: 287mm;
          padding: 14mm 14mm 18mm 14mm;
          margin: 0 auto;
          font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial;
          font-size: 12px;
          line-height: 1.45;
          position: relative;
        }
        .invoice-root h1, .invoice-root h2, .invoice-root h3 { font-weight: 700; }
        .invoice-watermark {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
          z-index: 0;
        }
        .invoice-watermark span {
          font-size: 110px;
          font-weight: 800;
          color: rgba(27, 48, 87, 0.08);
          letter-spacing: 0.15em;
          transform: rotate(-28deg);
          white-space: nowrap;
        }
        .invoice-content { position: relative; z-index: 1; }
        .invoice-table { width: 100%; border-collapse: collapse; }
        .invoice-table th, .invoice-table td {
          padding: 6px 8px;
          border-bottom: 1px solid #e2e8f0;
        }
        .invoice-table thead th {
          background: #1B3057;
          color: #fff;
          text-align: left;
          font-weight: 600;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .invoice-table tfoot td {
          font-weight: 700;
          border-top: 2px solid #1B3057;
          border-bottom: none;
        }
        .invoice-meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .invoice-block {
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 10px 12px;
          background: #f8fafc;
        }
        .invoice-block h3 {
          font-size: 10px;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 6px;
        }
        .invoice-row { display: flex; justify-content: space-between; gap: 12px; }
        .text-end { text-align: right; }
        .num { font-variant-numeric: tabular-nums; white-space: nowrap; }
      `}</style>

      {kind === "proforma" && (
        <div className="invoice-watermark"><span>PROFORMA</span></div>
      )}

      <div className="invoice-content">
        <header className="invoice-row" style={{ marginBottom: 18 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            {store?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={resolveImg(store.logoUrl)} alt="" style={{ height: 60, width: 60, objectFit: "contain", borderRadius: 6 }} />
            ) : (
              <div style={{ height: 60, width: 60, background: "#1B3057", color: "#F5F5F0", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 22 }}>
                {(store?.nameEn ?? "M").slice(0, 1)}
              </div>
            )}
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#1B3057" }}>
                {store?.nameEn ?? "Midanic"}
              </div>
              <div style={{ fontSize: 14, color: "#1B3057" }} dir="rtl">
                {store?.nameAr ?? "ميدانيك"}
              </div>
              {store?.address && <div style={{ color: "#475569" }}>{store.address}</div>}
              <div style={{ color: "#475569", fontSize: 11 }}>
                {store?.phone ? `${t("Téléphone", "الهاتف")}: ${store.phone}` : ""}
              </div>
              <div style={{ color: "#475569", fontSize: 11, display: "flex", gap: 10, flexWrap: "wrap" }}>
                {store?.nif && <span>NIF: {store.nif}</span>}
                {store?.rc && <span>RC: {store.rc}</span>}
                {store?.ai && <span>AI: {store.ai}</span>}
              </div>
            </div>
          </div>
          <div className="text-end">
            <div style={{ fontSize: 22, fontWeight: 800, color: "#1B3057" }}>{titleText}</div>
            <div style={{ marginTop: 4 }}>{t("N°", "رقم")}: <strong>{number}</strong></div>
            <div style={{ color: "#475569" }}>{dateFmt(date)}</div>
          </div>
        </header>

        <section className="invoice-meta-grid" style={{ marginBottom: 14 }}>
          <div className="invoice-block">
            <h3>{kind === "purchase" ? t("Fournisseur", "المورد") : t("Client", "الزبون")}</h3>
            <div style={{ fontWeight: 700, fontSize: 13 }}>{party.name || "—"}</div>
            {party.address && <div>{party.address}</div>}
            {party.phone && <div>{t("Téléphone", "الهاتف")}: {party.phone}</div>}
            <div style={{ fontSize: 11, color: "#475569", display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
              {party.nif && <span>NIF: {party.nif}</span>}
              {party.rc && <span>RC: {party.rc}</span>}
              {party.ai && <span>AI: {party.ai}</span>}
            </div>
          </div>
          <div className="invoice-block">
            <h3>{t("Détails", "التفاصيل")}</h3>
            <div className="invoice-row"><span>{t("Type", "النوع")}</span><span>{titleText}</span></div>
            <div className="invoice-row"><span>{t("Articles", "المنتجات")}</span><span>{lines.length}</span></div>
            <div className="invoice-row"><span>{t("Régime TVA", "حالة الضريبة")}</span><span>{showTva ? `${t("Assujetti", "خاضع للضريبة")} (${tvaRate.toFixed(2)}%)` : t("Non assujetti", "غير خاضع للضريبة")}</span></div>
          </div>
        </section>

        <table className="invoice-table">
          <thead>
            <tr>
              <th style={{ width: 36 }}>#</th>
              <th>{t("Désignation", "الوصف")}</th>
              <th style={{ width: 110 }}>{t("Réf.", "المرجع")}</th>
              <th className="text-end" style={{ width: 60 }}>{t("Qté", "الكمية")}</th>
              {showTva ? (
                <>
                   <th className="text-end" style={{ width: 90 }}>{t("P.U. HT", "سعر الوحدة دون الضريبة")}</th>
                   <th className="text-end" style={{ width: 90 }}>{t("Montant HT", "المبلغ دون الضريبة")}</th>
                </>
              ) : (
                <>
                   <th className="text-end" style={{ width: 90 }}>{t("P.U.", "سعر الوحدة")}</th>
                   <th className="text-end" style={{ width: 100 }}>{t("Montant", "المبلغ")}</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: 24, color: "#94a3b8", fontStyle: "italic" }}>
                  {t("Aucun article", "لا توجد مواد")}
                </td>
              </tr>
            ) : (
              lines.map((l, i) => {
                const lineTtc = l.qty * l.unitPrice;
                const lineHt = showTva ? lineTtc / ratio : lineTtc;
                const puHt = showTva ? l.unitPrice / ratio : l.unitPrice;
                return (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td>{l.designation}</td>
                    <td style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: "#475569" }}>{l.reference || "—"}</td>
                    <td className="text-end num">{l.qty}</td>
                    <td className="text-end num">{fmt(puHt)}</td>
                    <td className="text-end num">{fmt(lineHt)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
          <tfoot>
            {showTva ? (
              <>
                {discountAmount > 0 && (
                  <tr>
                    <td colSpan={5} className="text-end">{t("Réduction", "الخصم")}</td>
                    <td className="text-end num">−{fmt(discountAmount / ratio)} {currency}</td>
                  </tr>
                )}
                <tr>
                  <td colSpan={5} className="text-end">{t("Total HT", "المجموع دون الضريبة")}</td>
                  <td className="text-end num">{fmt(subtotalHt)} {currency}</td>
                </tr>
                <tr>
                  <td colSpan={5} className="text-end">{t("TVA", "الضريبة")} {tvaRate.toFixed(2)}%</td>
                  <td className="text-end num">{fmt(tvaAmount)} {currency}</td>
                </tr>
                <tr>
                  <td colSpan={5} className="text-end" style={{ background: "#1B3057", color: "#fff" }}>{t("Total TTC", "المجموع مع الضريبة")}</td>
                  <td className="text-end num" style={{ background: "#1B3057", color: "#fff" }}>{fmt(subtotalTtc)} {currency}</td>
                </tr>
              </>
            ) : (
              <>
                {discountAmount > 0 && (
                  <tr>
                    <td colSpan={5} className="text-end">{t("Réduction", "الخصم")}</td>
                    <td className="text-end num">−{fmt(discountAmount)} {currency}</td>
                  </tr>
                )}
                <tr>
                  <td colSpan={5} className="text-end" style={{ background: "#1B3057", color: "#fff" }}>{t("Total", "المجموع")}</td>
                  <td className="text-end num" style={{ background: "#1B3057", color: "#fff" }}>{fmt(subtotalTtc)} {currency}</td>
                </tr>
              </>
            )}
          </tfoot>
        </table>

        {notes && (
          <div style={{ marginTop: 14, fontSize: 11, color: "#475569" }}>
            {notes}
          </div>
        )}

        {kind === "proforma" && (
          <div style={{ marginTop: 14, fontSize: 11, color: "#b45309", fontStyle: "italic" }}>
            {t("Ce document est un devis non comptable. Aucune écriture n'a été générée.", "هذه وثيقة غير محاسبية، ولم يتم توليد أي قيد.")}
          </div>
        )}

        <footer style={{ marginTop: 30, paddingTop: 12, borderTop: "1px dashed #cbd5e1", fontSize: 10, color: "#64748b", display: "flex", justifyContent: "space-between" }}>
          <span>{t("Mode de paiement: paiement à la livraison", "طريقة الدفع: الدفع عند الاستلام")}</span>
          <span>{t("Devise: Dinar Algérien", "العملة: الدينار الجزائري")} ({currency})</span>
        </footer>
      </div>
    </div>
  );
}
