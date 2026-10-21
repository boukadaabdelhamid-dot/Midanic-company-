import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Supplier } from "@workspace/erp-api-client-react";
import { getApiBase } from "@/lib/api-base";
import { useLang } from "@/hooks/use-lang";
import { useCurrentStore } from "@/hooks/use-current-store";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import InvoiceDialog from "@/components/InvoiceDialog";
import type { InvoiceData } from "@/components/InvoiceTemplate";

type PurchaseOrder = {
  id: number;
  supplierId: number;
  status: "pending" | "received" | "cancelled";
  totalAmount: string;
  paymentMethod: string;
  notes?: string | null;
  createdAt?: string | null;
  receivedAt?: string | null;
};

type PurchaseItem = {
  id: number;
  purchaseOrderId: number;
  productId: number;
  quantity: number;
  unitCost: string;
  productNameEn?: string | null;
  productNameAr?: string | null;
  totalCharges?: string | null;
};

type SupplierSummary = Pick<Supplier, "id" | "name"> & Partial<Pick<Supplier, "address" | "phone">>;

const API_BASE = getApiBase();

export default function SupplierPurchaseOrderDialog({
  supplier, orderId, open, onOpenChange,
}: {
  supplier: SupplierSummary | null;
  orderId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { lang } = useLang();
  const t = (fr: string, ar: string) => useLang.translate(lang, fr, ar);
  const store = useCurrentStore();
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [showTva, setShowTva] = useState(false);
  const token = localStorage.getItem("midanic_token") ?? "";
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    setInvoiceOpen(false);
  }, [open, orderId, supplier?.id, store?.id]);

  const orderQuery = useQuery({
    queryKey: ["supplier-statement-purchase-order", store?.id ?? null, supplier?.id ?? null, orderId],
    enabled: open && !!store?.id && !!supplier && !!orderId,
    retry: false,
    queryFn: async ({ signal }) => {
      const response = await fetch(`${API_BASE}/api/erp/purchase-orders/${orderId}`, { headers, signal });
      if (!response.ok) throw new Error(`Purchase order could not be loaded (${response.status})`);
      const order = await response.json() as PurchaseOrder;
      if (order.supplierId !== supplier?.id) throw new Error("Purchase order does not belong to this supplier");
      return order;
    },
  });

  const itemsQuery = useQuery({
    queryKey: ["supplier-statement-purchase-order-items", store?.id ?? null, orderId],
    enabled: open && !!orderQuery.data && !!orderId,
    retry: false,
    queryFn: async ({ signal }) => {
      const response = await fetch(`${API_BASE}/api/erp/purchase-orders/${orderId}/items`, { headers, signal });
      if (!response.ok) throw new Error(`Purchase order items could not be loaded (${response.status})`);
      return response.json() as Promise<PurchaseItem[]>;
    },
  });

  const baseInvoiceData = useMemo((): Omit<InvoiceData, "showTva"> | null => {
    const order = orderQuery.data;
    const items = itemsQuery.data;
    if (!order || !items || !supplier) return null;
    return {
      kind: "purchase",
      number: `FA-${String(order.id).padStart(6, "0")}`,
      date: order.createdAt ? new Date(order.createdAt) : new Date(),
      store,
      party: { name: supplier.name, address: supplier.address, phone: supplier.phone },
      lines: items.map((item) => ({
        designation: (item.productNameEn || item.productNameAr || `#${item.productId}`).toUpperCase(),
        reference: `#${item.productId}`,
        qty: Number(item.quantity),
        unitPrice: Number(item.unitCost),
      })),
      tvaRate: Number(store?.tvaRate ?? 19),
      notes: order.notes ?? undefined,
    };
  }, [orderQuery.data, itemsQuery.data, supplier, store]);

  const invoiceData = useMemo(
    () => baseInvoiceData ? { ...baseInvoiceData, showTva } : null,
    [baseInvoiceData, showTva],
  );
  const order = orderQuery.data;
  const items = itemsQuery.data ?? [];
  const isLoading = orderQuery.isLoading || (!!order && itemsQuery.isLoading);
  const error = orderQuery.error || itemsQuery.error;

  const statusLabel = (status: PurchaseOrder["status"]) => {
    if (status === "received") return t("Clôturée", "مُغلقة");
    if (status === "cancelled") return t("Annulée", "ملغاة");
    return t("En cours", "جارٍ");
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {t("Bon d'achat", "سند الشراء")} {order ? `#${order.id}` : orderId ? `#${orderId}` : ""}
            </DialogTitle>
          </DialogHeader>

          {isLoading ? (
            <div className="space-y-2">{[...Array(4)].map((_, index) => <Skeleton key={index} className="h-10" />)}</div>
          ) : error ? (
            <div role="alert" className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              {t("Impossible de charger ce bon d'achat. Vérifiez vos droits ou réessayez.", "تعذر تحميل سند الشراء. تحقق من صلاحياتك أو أعد المحاولة.")}
              <Button
                variant="outline"
                size="sm"
                className="mt-2 block"
                disabled={orderQuery.isFetching || itemsQuery.isFetching}
                onClick={() => {
                  if (orderQuery.isError) void orderQuery.refetch();
                  else void itemsQuery.refetch();
                }}
              >
                {t("Réessayer", "إعادة المحاولة")}
              </Button>
            </div>
          ) : order ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 rounded-md border bg-muted/20 p-3 text-sm sm:grid-cols-4">
                <div><p className="text-xs text-muted-foreground">{t("Fournisseur", "المورد")}</p><p className="font-medium">{supplier?.name ?? "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">{t("Date", "التاريخ")}</p><p>{order.createdAt ? new Date(order.createdAt).toLocaleString(useLang.locale(lang)) : "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">{t("État", "الحالة")}</p><p>{statusLabel(order.status)}</p></div>
                <div><p className="text-xs text-muted-foreground">{t("Paiement", "الدفع")}</p><p>{order.paymentMethod === "comptant" ? t("Comptant", "نقدًا") : t("À terme", "بالآجل")}</p></div>
              </div>

              <div className="overflow-hidden rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("Produit", "المنتج")}</TableHead>
                      <TableHead className="text-right">{t("Quantité", "الكمية")}</TableHead>
                      <TableHead className="text-right">{t("Prix unitaire", "سعر الوحدة")}</TableHead>
                      <TableHead className="text-right">{t("Total", "المجموع")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <p>{lang === "ar" ? item.productNameAr || item.productNameEn || `#${item.productId}` : item.productNameEn || item.productNameAr || `#${item.productId}`}</p>
                          <p className="text-xs text-muted-foreground">#{item.productId}</p>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{item.quantity}</TableCell>
                        <TableCell className="text-right tabular-nums">{Number(item.unitCost).toFixed(2)} {t("DA", "دج")}</TableCell>
                        <TableCell className="text-right tabular-nums font-medium">{(Number(item.quantity) * Number(item.unitCost)).toFixed(2)} {t("DA", "دج")}</TableCell>
                      </TableRow>
                    ))}
                    {items.length === 0 && (
                      <TableRow><TableCell colSpan={4} className="py-6 text-center text-muted-foreground">{t("Aucun produit dans ce bon.", "لا توجد منتجات في هذا السند.")}</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-wrap items-start justify-between gap-3">
                {order.notes && (
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">{t("Note", "ملاحظة")}</p>
                    <p className="whitespace-pre-wrap break-words text-sm">{order.notes}</p>
                  </div>
                )}
                <div className="ms-auto rounded-md bg-muted/40 px-4 py-3 text-end">
                  <p className="text-xs text-muted-foreground">{t("Montant total", "المبلغ الإجمالي")}</p>
                  <p className="text-lg font-bold tabular-nums">{Number(order.totalAmount).toFixed(2)} {t("DA", "دج")}</p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowTva(!!store?.showTvaByDefault);
                  setInvoiceOpen(true);
                }}
                disabled={!baseInvoiceData}
              >
                {t("Imprimer le bon", "طباعة سند الشراء")}
              </Button>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>{t("Fermer", "إغلاق")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <InvoiceDialog
        open={invoiceOpen}
        onOpenChange={setInvoiceOpen}
        data={invoiceData}
        onShowTvaChange={setShowTva}
      />
    </>
  );
}
