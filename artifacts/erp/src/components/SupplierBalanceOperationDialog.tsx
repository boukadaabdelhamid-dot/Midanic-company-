import type { SupplierOperation } from "@workspace/erp-api-client-react";
import { useLang } from "@/hooks/use-lang";
import { getLinkedPurchaseOrderId } from "@/lib/supplier-operation-order";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

export type SupplierBalanceRow = {
  op: SupplierOperation & {
    runningBalance: string;
    source?: "supplier" | "customer";
    storeNameAr?: string | null;
    storeNameEn?: string | null;
  };
  label: string;
  dateLabel: string;
  debit: number | null;
  credit: number | null;
};

export default function SupplierBalanceOperationDialog({
  row, loading, canOpenPurchase, onClose, onOpenPurchase,
}: {
  row: SupplierBalanceRow | null;
  loading: boolean;
  canOpenPurchase: boolean;
  onClose: () => void;
  onOpenPurchase: () => void;
}) {
  const { lang } = useLang();
  const t = (fr: string, ar: string) => useLang.translate(lang, fr, ar);
  const op = row?.op;
  const purchaseOrderId = op ? getLinkedPurchaseOrderId(op) : null;
  const isPurchaseOperation = op && op.source !== "customer"
    && ["purchase", "purchase_comptant", "payment"].includes(op.type);
  const money = (value: string | number | null | undefined) =>
    value == null ? t("Non enregistré", "غير مسجل") : `${Number(value).toFixed(2)} ${t("DA", "دج")}`;

  return (
    <Dialog open={!!row} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("Détail de l'opération", "تفاصيل العملية")}</DialogTitle>
          <DialogDescription>{row?.dateLabel} · {row?.label}</DialogDescription>
        </DialogHeader>
        {row && op && (
          <div className="space-y-4 text-sm">
            <span className="inline-flex rounded-full border bg-muted px-2 py-0.5 text-xs font-semibold">
              {row.label}
            </span>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md bg-rose-50 p-3">
                <p className="text-xs text-rose-700">{t("Débit", "مدين")}</p>
                <p className="mt-1 font-bold tabular-nums text-rose-700">
                  {row.debit == null ? "—" : money(row.debit)}
                </p>
              </div>
              <div className="rounded-md bg-emerald-50 p-3">
                <p className="text-xs text-emerald-700">{t("Crédit", "دائن")}</p>
                <p className="mt-1 font-bold tabular-nums text-emerald-700">
                  {row.credit == null ? "—" : money(row.credit)}
                </p>
              </div>
            </div>
            <div className="rounded-md border p-3 space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">{t("Référence", "المرجع")}</p>
                <p className="mt-1 break-words font-medium">{op.reference || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("Note", "ملاحظة")}</p>
                <p className="mt-1 whitespace-pre-wrap break-words">{op.note || "—"}</p>
              </div>
              {(op.source === "supplier" || !op.source) && (
                <div>
                  <p className="text-xs text-muted-foreground">{t("Solde avant", "الرصيد قبل")}</p>
                  <p className="mt-1 font-semibold tabular-nums">{money(op.balanceBefore)}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{t("Solde après", "الرصيد بعد")}</p>
                  <p className="mt-1 font-semibold tabular-nums">{money(op.balanceAfter)}</p>
                </div>
              )}
            </div>
            {isPurchaseOperation && (
              purchaseOrderId ? (
                <div className="space-y-2">
                  <Button
                    className="w-full"
                    onClick={onOpenPurchase}
                    disabled={loading || !canOpenPurchase}
                    data-testid={`button-open-supplier-balance-order-${purchaseOrderId}`}
                  >
                    {loading
                      ? t("Ouverture…", "جارٍ الفتح…")
                      : t(`Ouvrir le bon d'achat #${purchaseOrderId}`, `فتح سند الشراء رقم ${purchaseOrderId}`)}
                  </Button>
                  {!canOpenPurchase && (
                    <p className="text-xs text-muted-foreground">
                      {t("La consultation du bon nécessite le droit d'accès aux achats.", "فتح سند الشراء يتطلب صلاحية عرض المشتريات.")}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {t("Aucun bon d'achat associé n'est référencé pour cette opération.", "لا يوجد سند شراء مرتبط مسجل لهذه العملية.")}
                </p>
              )
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("Fermer", "إغلاق")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
