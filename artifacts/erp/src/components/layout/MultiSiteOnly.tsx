import type { ReactNode } from "react";
import { Redirect } from "wouter";
import { useCompanySites } from "@/hooks/use-company-sites";
import { useLang } from "@/hooks/use-lang";
import { Button } from "@/components/ui/button";

export function MultiSiteOnly({ children }: { children: ReactNode }) {
  const { hasMultipleSites, isPending, isError, refetch } = useCompanySites();
  const { lang } = useLang();
  const text = (fr: string, ar: string, en: string) => lang === "ar" ? ar : lang === "en" ? en : fr;
  if (isPending) return <p className="p-6 text-sm text-muted-foreground">{text("Chargement…", "جارٍ التحميل…", "Loading…")}</p>;
  if (isError) return (
    <div className="space-y-3 p-6" role="alert">
      <p>{text("Impossible de charger les sites de l’entreprise.", "تعذر تحميل مواقع الشركة.", "Could not load company locations.")}</p>
      <Button variant="outline" onClick={() => void refetch()}>{text("Réessayer", "إعادة المحاولة", "Retry")}</Button>
    </div>
  );
  if (!hasMultipleSites) return <Redirect to="/home" />;
  return <>{children}</>;
}
