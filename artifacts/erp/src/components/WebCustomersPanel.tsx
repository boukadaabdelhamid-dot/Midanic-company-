import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useListWebCustomers, useSetWebCustomerBlock, getListWebCustomersQueryKey, type WebCustomerRecord } from "@workspace/erp-api-client-react";
import { useLang } from "@/hooks/use-lang";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Search, ShieldBan, ShieldCheck } from "lucide-react";

type Target = { phone: string; customerId?: number; name?: string; isBlocked: boolean };
export function WebCustomersPanel({ canEdit }: { canEdit: boolean }) {
  const { lang } = useLang();
  const t = (fr: string, ar: string) => lang === "ar" ? ar : fr;
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [target, setTarget] = useState<Target | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const registry = useListWebCustomers({ search: query });
  const save = useSetWebCustomerBlock();
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search), 300);
    return () => clearTimeout(timer);
  }, [search]);
  const open = (record?: WebCustomerRecord) => {
    setTarget(record ? { phone: record.phone, customerId: record.customerId ?? undefined,
      name: record.name ?? undefined, isBlocked: !record.isBlocked } : { phone: "", isBlocked: true });
    setReason(""); setError("");
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!target) return;
    setError("");
    try {
      await save.mutateAsync({ data: { ...target, reason } });
      await qc.invalidateQueries({ queryKey: getListWebCustomersQueryKey() });
      setTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Impossible d'enregistrer.", "تعذّر الحفظ."));
    }
  };
  return (
    <section className="rounded-lg border bg-card p-4 space-y-3" dir={lang === "ar" ? "rtl" : "ltr"} data-testid="web-customers-panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{t("Clients Web Store", "عملاء المتجر الإلكتروني")}</h2>
          <p className="text-xs text-muted-foreground mt-1">{t(
            "Les clients sans compte sont enregistrés dans l'ERP. Le blocage empêche les nouvelles commandes Web uniquement.",
            "يُحفظ العملاء دون حساب في ERP. الحظر يمنع الطلبات الإلكترونية الجديدة فقط ولا يحذف السجل."
          )}</p>
        </div>
        {canEdit && <Button variant="outline" size="sm" onClick={() => open()} data-testid="block-web-phone">
          <ShieldBan className="h-4 w-4 me-2" />{t("Bloquer un numéro", "حظر رقم هاتف")}
        </Button>}
      </div>
      <div className="relative max-w-sm">
        <Search className="absolute start-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input className="ps-9" value={search} onChange={e => setSearch(e.target.value)}
          placeholder={t("Rechercher par nom ou téléphone", "البحث بالاسم أو رقم الهاتف")} aria-label={t("Recherche clients Web", "بحث عملاء المتجر")} />
      </div>
      {registry.isLoading && <p className="text-sm">{t("Chargement...", "جارٍ التحميل…")}</p>}
      {registry.error && <p role="alert" className="text-sm text-destructive">{t("Impossible de charger les clients.", "تعذّر تحميل العملاء.")}
        <Button variant="link" onClick={() => registry.refetch()}>{t("Réessayer", "إعادة المحاولة")}</Button></p>}
      {!registry.isLoading && !registry.error && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-start text-xs text-muted-foreground">
              {[t("Client", "العميل"), t("Téléphone", "الهاتف"), t("Commandes", "الطلبات"),
                t("État", "الحالة"), t("Motif", "السبب"), t("Actions", "الإجراءات")].map(label =>
                <th key={label} className="py-2 px-2 text-start font-medium">{label}</th>)}
            </tr></thead>
            <tbody>{registry.data?.map(record => <tr key={record.phone} className="border-b last:border-0">
              <td className="py-3 px-2">{record.name ?? t("Numéro uniquement", "رقم هاتف فقط")}</td>
              <td className="px-2 whitespace-nowrap" dir="ltr">+{record.phone}</td>
              <td className="px-2">{record.orderCount}</td>
              <td className="px-2"><Badge variant={record.isBlocked ? "destructive" : "secondary"}>
                {record.isBlocked ? t("Bloqué", "محظور") : t("Autorisé", "مسموح")}</Badge></td>
              <td className="px-2 max-w-[220px] break-words">{record.reason || "—"}</td>
              <td className="px-2">{canEdit && <Button size="sm" variant="ghost" onClick={() => open(record)}
                data-testid={`toggle-web-block-${record.phone}`}>
                {record.isBlocked ? <ShieldCheck className="h-4 w-4 me-1" /> : <ShieldBan className="h-4 w-4 me-1" />}
                {record.isBlocked ? t("Débloquer", "رفع الحظر") : t("Bloquer", "حظر")}
              </Button>}</td>
            </tr>)}</tbody>
          </table>
          {registry.data?.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">
            {t("Aucun client Web trouvé.", "لا يوجد عميل مطابق.")}</p>}
          {registry.data?.length === 200 && <p className="text-xs text-muted-foreground mt-2">
            {t("200 résultats affichés. Affinez la recherche.", "تظهر 200 نتيجة. حدّد البحث لعرض نتائج أخرى.")}</p>}
        </div>
      )}
      <Dialog open={!!target} onOpenChange={open => { if (!open && !save.isPending) setTarget(null); }}>
        <DialogContent dir={lang === "ar" ? "rtl" : "ltr"}>
          <DialogHeader><DialogTitle>{target?.isBlocked ? t("Bloquer les commandes Web", "حظر الطلبات الإلكترونية") : t("Autoriser les commandes Web", "السماح بالطلبات الإلكترونية")}</DialogTitle>
            <DialogDescription>{target?.name || t("Ce changement s'applique au magasin actuel.", "يسري التغيير على المتجر الحالي.")}</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <label className="block text-sm space-y-2"><span>{t("Téléphone", "رقم الهاتف")}</span>
              <Input type="tel" required minLength={8} maxLength={30} dir="ltr" readOnly={!!target?.customerId}
                value={target?.phone ?? ""} onChange={e => setTarget(old => old ? { ...old, phone: e.target.value } : old)} />
            </label>
            {target?.isBlocked && <label className="block text-sm space-y-2"><span>{t("Motif (facultatif)", "السبب (اختياري)")}</span>
              <Textarea value={reason} onChange={e => setReason(e.target.value)} maxLength={500} /></label>}
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={save.isPending} onClick={() => setTarget(null)}>
              {t("Annuler", "إلغاء")}</Button><Button type="submit" disabled={save.isPending} data-testid="save-web-block">
                {save.isPending ? t("Enregistrement...", "جارٍ الحفظ…") : t("Confirmer", "تأكيد")}</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}