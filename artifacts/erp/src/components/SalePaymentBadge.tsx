import { useLang } from "@/hooks/use-lang";

export default function SalePaymentBadge({ method }: { method: unknown }) {
  const { lang } = useLang();
  const isCredit = method === "a_terme";
  const isCash = method === "comptant";
  const label = isCredit
    ? (lang === "ar" ? "آجل" : "À terme")
    : isCash
      ? (lang === "ar" ? "نقدًا" : "Comptant")
      : (lang === "ar" ? "الدفع غير محدد" : "Paiement non renseigné");

  return (
    <span className={`inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
      isCredit ? "border-amber-200 bg-amber-50 text-amber-800"
        : isCash ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-slate-200 bg-slate-50 text-slate-600"
    }`}>
      {label}
    </span>
  );
}
