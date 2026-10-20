import type { CustomerOperation } from "@workspace/erp-api-client-react";
import { useLang } from "@/hooks/use-lang";
import { getLinkedSaleOrderId } from "@/lib/customer-operation-order";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";

type OperationRow = {
  op: CustomerOperation;
  debit: number | null;
  credit: number | null;
  operation: { label: string; cls: string };
  dateLabel: string;
};

export default function CustomerBalanceOperationDialog({
  row, currency, loading, error, canOpenOrder, onClose, onOpenOrder,
}: {
  row: OperationRow | null;
  currency: string;
  loading: boolean;
  error: string | null;
  canOpenOrder: boolean;
  onClose: () => void;
  onOpenOrder: () => void;
}) {
  const { lang } = useLang();
  const t = (fr: string, ar: string) => useLang.translate(lang, fr, ar);
  const op = row?.op;
  const orderId = op ? getLinkedSaleOrderId(op) : null;
  const money = (value: string | number | null | undefined) =>
    value == null ? t("Non enregistré", "غير مسجل") : `${Number(value).toFixed(2)} ${currency}`;

  return (
    <Dialog open={!!row} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("Détail de l'opération", "تفاصيل العملية")}</DialogTitle>
          <DialogDescription>{row?.dateLabel} · {row?.operation.label}</DialogDescription>
        </DialogHeader>
        {row && op && (
          <div className="space-y-4 text-sm">
            <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${row.operation.cls}`}>
              {row.operation.label}
            </span>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md bg-red-50 p-3">
                <p className="text-xs text-red-700">{t("Débit — dû par le client", "مدين — مبلغ على الزبون")}</p>
                <p className="mt-1 font-bold tabular-nums text-red-700">{row.debit == null ? "—" : money(row.debit)}</p>
              </div>
              <div className="rounded-md bg-green-50 p-3">
                <p className="text-xs text-green-700">{t("Crédit — payé ou crédité", "دائن — مبلغ مدفوع أو مضاف للرصيد")}</p>
                <p className="mt-1 font-bold tabular-nums text-green-700">{row.credit == null ? "—" : money(row.credit)}</p>
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
            </div>
            <div className="grid grid-cols-2 gap-3 rounded-md border bg-muted/30 p-3">
              <div>
                <p className="text-xs text-muted-foreground">{t("Solde avant", "الرصيد قبل")}</p>
                <p className="mt-1 font-semibold tabular-nums">{money(op.balanceBefore)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("Solde après", "الرصيد بعد")}</p>
                <p className="mt-1 font-semibold tabular-nums">{money(op.balanceAfter)}</p>
              </div>
            </div>
            {op.type === "vente_a_terme" && (
              orderId ? (
                <div className="space-y-2">
                  <Button
                    className="w-full"
                    onClick={onOpenOrder}
                    disabled={loading || !canOpenOrder}
                    data-testid={`button-open-customer-balance-order-${orderId}`}
                  >
                    {loading ? t("Ouverture…", "جارٍ الفتح…") : t(`Ouvrir le bon #${orderId}`, `فتح البون رقم ${orderId}`)}
                  </Button>
                  {!canOpenOrder && (
                    <p className="text-xs text-muted-foreground">{t("La consultation du bon nécessite les droits d'accès à l'historique et aux ventes.", "فتح البون يتطلب صلاحية عرض السجل والوصول إلى المبيعات.")}</p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">{t("Aucun bon associé n'est référencé pour cette opération.", "لا يوجد بون مرتبط مسجل لهذه العملية.")}</p>
              )
            )}
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("Fermer", "إغلاق")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
