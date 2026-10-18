import React from "react";
import { useLang } from "@/hooks/use-lang";

type ProductExposureFilterProps = {
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
};

export default function ProductExposureFilter({
  value,
  onChange,
  compact = false,
}: ProductExposureFilterProps) {
  const { lang } = useLang();
  const t = (fr: string, ar: string) => lang === "ar" ? ar : fr;
  const id = compact ? "product-column-exposure-filter" : "product-exposure-filter";

  return (
    <div className={compact ? "w-full" : "flex flex-wrap items-center gap-2"}>
      <label htmlFor={id} className={compact ? "sr-only" : "text-sm text-muted-foreground"}>
        {t("Boutique en ligne", "المتجر الإلكتروني")}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={compact
          ? "w-full min-w-0 bg-transparent border-0 border-b border-muted-foreground/25 text-[11px] focus:outline-none focus:border-primary/60"
          : "h-9 max-w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"}
      >
        <option value="">{compact ? t("Tous", "الكل") : t("Tous les articles", "كل المنتجات")}</option>
        <option value="true">{compact ? t("Oui", "نعم") : t("Affichés en ligne", "معروضة في المتجر الإلكتروني")}</option>
        <option value="false">{compact ? t("Non", "لا") : t("Non affichés en ligne", "غير معروضة في المتجر الإلكتروني")}</option>
      </select>
    </div>
  );
}
