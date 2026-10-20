import React from "react";
import type { Payslip } from "@workspace/erp-api-client-react";
import { useLang } from "@/hooks/use-lang";

const fmt = (n: string | number) =>
  Number(n).toLocaleString(useLang.locale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function PayslipTemplate({ payslip, currency = "دج" }: { payslip: Payslip; currency?: string }) {
  const { lang } = useLang();
  const t = (fr: string, ar: string) => useLang.translate(lang, fr, ar);
  const base = Number(payslip.baseSalary);
  const bonus = Number(payslip.bonusAmount);
  const advances = Number(payslip.advancesAmount);
  const deductions = Number(payslip.deductionsAmount);
  const net = Number(payslip.netAmount);

  return (
    <div className="payslip-root bg-white text-[#0f172a]">
      <style>{`
        @media print {
          @page { size: A4; margin: 15mm; }
          body { background: white !important; }
          .payslip-root { box-shadow: none !important; margin: 0 !important; }
          .payslip-no-print { display: none !important; }
        }
        .payslip-root {
          width: 190mm;
          min-height: 140mm;
          padding: 10mm;
          margin: 0 auto;
          font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial;
          font-size: 12px;
          line-height: 1.5;
          border: 1px solid #e2e8f0;
        }
        .payslip-table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        .payslip-table th, .payslip-table td { padding: 6px 10px; border-bottom: 1px solid #e2e8f0; }
        .payslip-table thead th {
          background: #1B3057; color: #fff; text-align: left; font-weight: 600;
          font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em;
        }
        .payslip-table tfoot td { font-weight: 700; border-top: 2px solid #1B3057; border-bottom: none; }
        .payslip-meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px; }
        .payslip-block { border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 10px; background: #f8fafc; }
        .payslip-block h3 { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
        .payslip-row { display: flex; justify-content: space-between; gap: 12px; }
      `}</style>
      <div className="flex items-center justify-between border-b pb-3">
        <h1 className="text-lg font-bold">{t("Bulletin de paie", "قسيمة الراتب")}</h1>
        <div className="text-right text-xs text-muted-foreground">
          <div>{t("Période :", "الفترة:")} {payslip.periodStart ?? "—"} → {payslip.periodEnd ?? "—"}</div>
          <div>{t("N°", "رقم")} {String(payslip.id).padStart(5, "0")}</div>
        </div>
      </div>

      <div className="payslip-meta-grid">
        <div className="payslip-block">
          <h3>{t("Employé", "الموظف")}</h3>
          <div className="payslip-row"><span>{t("Nom", "الاسم")}</span><strong>{payslip.employeeName ?? "—"}</strong></div>
          <div className="payslip-row"><span>{t("Poste", "المنصب")}</span><span>{payslip.position ?? "—"}</span></div>
          <div className="payslip-row"><span>{t("Matricule", "رقم الموظف")}</span><span>{payslip.matricule ?? "—"}</span></div>
        </div>
        <div className="payslip-block">
          <h3>{t("Informations administratives", "معلومات إدارية")}</h3>
          <div className="payslip-row"><span>N° CNAS</span><span>{payslip.cnasNumber ?? "—"}</span></div>
          <div className="payslip-row"><span>{t("Compte bancaire", "الحساب البنكي")}</span><span>{payslip.bankAccount ?? "—"}</span></div>
        </div>
      </div>

      <table className="payslip-table">
        <thead>
          <tr><th>{t("Désignation", "الوصف")}</th><th style={{ textAlign: "right" }}>{t("Montant", "المبلغ")} ({currency})</th></tr>
        </thead>
        <tbody>
          <tr><td>{t("Salaire de base", "الراتب الأساسي")}</td><td style={{ textAlign: "right" }}>{fmt(base)}</td></tr>
          <tr><td>{t("Prime de rendement", "منحة الأداء")}</td><td style={{ textAlign: "right" }}>{fmt(bonus)}</td></tr>
          <tr><td>{t("Avances", "السلف")}</td><td style={{ textAlign: "right" }}>-{fmt(advances)}</td></tr>
          <tr><td>{t("Retenues", "الخصومات")}</td><td style={{ textAlign: "right" }}>-{fmt(deductions)}</td></tr>
        </tbody>
        <tfoot>
          <tr><td>{t("Net à payer", "صافي المستحق")}</td><td style={{ textAlign: "right" }}>{fmt(net)} {currency}</td></tr>
        </tfoot>
      </table>
    </div>
  );
}
