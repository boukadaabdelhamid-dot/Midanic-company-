import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getApiBase } from "@/lib/api-base";
import { useLang } from "@/hooks/use-lang";
import { useCurrentStore } from "@/hooks/use-current-store";
import InvoiceDialog from "@/components/InvoiceDialog";
import type { InvoiceData } from "@/components/InvoiceTemplate";

type SaleOrderDetail = {
  id: number;
  status: string;
  order_source: string;
  customer_name: string;
  customer_phone: string;
  total_amount: string;
  discount_amount: string;
  created_at: string | null;
  payment_method: string;
  items: Array<{
    id: number;
    product_name_en: string | null;
    product_name_ar: string | null;
    product_reference: string | null;
    quantity: number;
    unit_price: string;
  }>;
};

const API_BASE = getApiBase();

export default function ProductSaleOrderDialog({
  orderId, open, onOpenChange,
}: {
  orderId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { lang } = useLang();
  const t = (fr: string, ar: string) => useLang.translate(lang, fr, ar);
  const store = useCurrentStore();
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [showTva, setShowTva] = useState(false);
  const orderQuery = useQuery({
    queryKey: ["product-history-sale-order", store?.id ?? null, orderId],
    enabled: open && !!store?.id && orderId !== null,
    retry: false,
    queryFn: async ({ signal }) => {
      const token = localStorage.getItem("midanic_token");
      const response = await fetch(`${API_BASE}/api/erp/sale-orders/${orderId}`, {
        signal,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json() as Promise<SaleOrderDetail>;
    },
  });

  const invoiceData = useMemo((): InvoiceData | null => {
    const order = orderQuery.data;
    if (!order) return null;
    return {
      kind: "sale",
      number: `BV-${String(order.id).padStart(6, "0")}`,
      date: order.created_at ? new Date(order.created_at) : new Date(),
      store,
      party: { name: order.customer_name, phone: order.customer_phone },
      lines: (order.items ?? []).map((item) => ({
        designation: (item.product_name_en || item.product_name_ar || "—").toUpperCase(),
        reference: item.product_reference,
        qty: Number(item.quantity),
        unitPrice: Number(item.unit_price),
      })),
      showTva,
      tvaRate: Number(store?.tvaRate ?? 19),
      notes: order.payment_method === "a_terme"
        ? t("Paiement : À terme", "الدفع: آجل")
        : t("Paiement : Comptant", "الدفع: نقدًا"),
      discountAmount: Number(order.discount_amount ?? 0),
    };
  }, [orderQuery.data, store, showTva, lang]);

  const close = (isOpen: boolean) => {
    if (!isOpen) {
      setInvoiceOpen(false);
      onOpenChange(false);
    }
  };

  return (
    <>
      <Dialog open={open && !invoiceOpen} onOpenChange={close}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{t("Bon de vente", "بون البيع")} {orderId ? `#${orderId}` : ""}</DialogTitle>
          </DialogHeader>
          {orderQuery.isLoading ? (
            <div className="space-y-2" aria-label={t("Chargement", "جارٍ التحميل")}>
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : orderQuery.isError ? (
            <div role="alert" className="space-y-3 text-sm">
              <p className="text-destructive">
                {t("Impossible de charger ce bon de vente.", "تعذر تحميل بون البيع.")}
              </p>
              <Button variant="outline" onClick={() => void orderQuery.refetch()}>
                {t("Réessayer", "إعادة المحاولة")}
              </Button>
            </div>
          ) : orderQuery.data ? (
            <div className="flex items-center justify-between gap-3 text-sm">
              <div className="min-w-0">
                <p className="font-medium truncate">{orderQuery.data.customer_name}</p>
                <p className="text-muted-foreground">
                  {orderQuery.data.created_at
                    ? new Date(orderQuery.data.created_at).toLocaleString(useLang.locale(lang))
                    : "—"}
                </p>
              </div>
              <Button
                onClick={() => {
                  setShowTva(!!store?.showTvaByDefault);
                  setInvoiceOpen(true);
                }}
                disabled={!invoiceData}
              >
                {t("Ouvrir / imprimer le bon", "فتح / طباعة بون البيع")}
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
      <InvoiceDialog
        open={open && invoiceOpen}
        onOpenChange={(isOpen) => {
          setInvoiceOpen(isOpen);
          if (!isOpen) onOpenChange(false);
        }}
        data={invoiceData}
        onShowTvaChange={setShowTva}
      />
    </>
  );
}
