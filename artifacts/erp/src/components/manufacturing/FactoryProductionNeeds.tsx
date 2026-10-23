import { useQuery } from "@tanstack/react-query";
import { getManufacturingReplenishment, manufacturingQueryKeys } from "@workspace/erp-api-client-react";
import { useLocation } from "wouter";
import { Factory } from "lucide-react";
import { useLang } from "@/hooks/use-lang";
import { usePermissions } from "@/hooks/use-permissions";
import { Button } from "@/components/ui/button";

export function FactoryProductionNeeds({ storeId, search, stockFilter }: {
  storeId: number;
  search: string;
  stockFilter: "all" | "rupture" | "low";
}) {
  const { lang } = useLang();
  const { can } = usePermissions();
  const [, navigate] = useLocation();
  const text = (fr: string, ar: string, en: string) => lang === "ar" ? ar : lang === "en" ? en : fr;
  const allowed = can("manufacturing", "view");
  const needs = useQuery({
    queryKey: [...manufacturingQueryKeys.replenishment, storeId],
    queryFn: getManufacturingReplenishment,
    enabled: allowed,
    refetchInterval: 60_000,
  });
  if (!allowed) return null;
  const term = search.trim().toLocaleLowerCase();
  const items = (needs.data?.finishedGoods ?? []).filter((item) =>
    `${item.nameEn} ${item.nameAr}`.toLocaleLowerCase().includes(term) &&
    (stockFilter === "all" || (stockFilter === "rupture" ? item.stock <= 0 : item.stock > 0))
  );
  const number = (value: number) => value.toLocaleString(useLang.locale(lang), { maximumFractionDigits: 3 });

  return (
    <section className="overflow-hidden rounded-2xl border border-emerald-200 bg-white" data-testid="factory-production-needs">
      <div className="flex items-center gap-3 border-b border-emerald-100 bg-emerald-50 px-4 py-3">
        <Factory className="h-5 w-5 shrink-0 text-emerald-700" />
        <div>
          <h2 className="font-semibold text-emerald-900">{text("Produits à fabriquer", "منتجات تحتاج إلى التصنيع", "Products to manufacture")}</h2>
          <p className="text-xs text-emerald-800">{text("Ces produits sont dirigés vers la production, pas vers un bon d’achat.", "تُوجّه هذه المنتجات إلى الإنتاج وليس إلى بون الشراء.", "These products go to production, not to a purchase order.")}</p>
        </div>
      </div>
      {needs.isPending ? (
        <p className="p-4 text-sm text-muted-foreground">{text("Chargement…", "جارٍ التحميل…", "Loading…")}</p>
      ) : needs.isError ? (
        <div className="space-y-2 p-4" role="alert">
          <p className="text-sm text-red-600">{text("Impossible de charger les besoins de production.", "تعذر تحميل احتياجات الإنتاج.", "Could not load production needs.")}</p>
          <Button size="sm" variant="outline" onClick={() => void needs.refetch()}>{text("Réessayer", "إعادة المحاولة", "Retry")}</Button>
        </div>
      ) : items.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">{text("Aucun besoin de fabrication correspondant.", "لا توجد احتياجات تصنيع مطابقة حاليًا.", "No matching production needs.")}</p>
      ) : (
        <div className="divide-y divide-emerald-100">
          {items.map((item) => (
            <article key={item.productId} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <h3 className="break-words text-sm font-semibold">{lang === "ar" ? item.nameAr || item.nameEn : item.nameEn || item.nameAr}</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {text("Stock", "المخزون", "Stock")}: {number(item.stock)}
                  {" · "}{text("À produire", "المقترح إنتاجه", "To produce")}: {number(item.suggestedQuantity)}
                </p>
              </div>
              <Button
                size="sm"
                className="bg-emerald-800 text-white hover:bg-emerald-900"
                onClick={() => navigate(`/manufacturing?tab=replenishment&productId=${item.productId}&storeId=${storeId}`)}
                data-testid={`button-open-production-${item.productId}`}
              >
                <Factory className="me-2 h-4 w-4" />{text("Production", "الإنتاج", "Production")}
              </Button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
