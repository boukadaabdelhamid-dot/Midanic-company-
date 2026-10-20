import { getApiBase } from "../lib/api-base";
import React, { useState, useMemo, useEffect } from "react";
import {
  useCreateSupplier, useUpdateSupplier,
  useCreateSupplierOperation,
  useGetErpStoresAll,
  getGetSupplierOperationsQueryKey, getGetErpCustomersQueryKey,
} from "@workspace/erp-api-client-react";
import type { Supplier, SupplierOperation, SupplierStatementResponse } from "@workspace/erp-api-client-react";
import { useQueryClient, keepPreviousData, useQuery } from "@tanstack/react-query";
import { useLang } from "@/hooks/use-lang";
import { useStoreContext } from "@/hooks/use-store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, CreditCard, TrendingDown, TrendingUp, FileText, RefreshCw, SlidersHorizontal, MoreVertical, Link2, Store, UserPlus, Maximize2, Minimize2, Download, Printer } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ContactFormDialog, emptyContactForm, type ContactFormState } from "@/components/ContactFormDialog";
import SupplierBalanceOperationDialog, { type SupplierBalanceRow } from "@/components/SupplierBalanceOperationDialog";
import SupplierPurchaseOrderDialog from "@/components/SupplierPurchaseOrderDialog";
import { getLinkedPurchaseOrderId } from "@/lib/supplier-operation-order";
import { usePermissions } from "@/hooks/use-permissions";

// The generated Supplier type predates the global-account feature; extend locally.
type GlobalSupplier = Supplier & { globalSupplierId?: string | null };
type GlobalOperation = SupplierOperation & { runningBalance: string; storeNameAr?: string | null; storeNameEn?: string | null };
type StoreLite = { id: number; nameEn: string; nameAr: string; isActive?: boolean };

const fmt = (n: string | number | null | undefined) =>
  parseFloat(String(n ?? "0")).toLocaleString("fr-DZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ─── Payment Dialog ───────────────────────────────────────────────────────────
function PaymentDialog({
  supplier, open, onOpenChange,
}: { supplier: Supplier | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const { lang } = useLang();
  const t = (fr: string, ar: string) => useLang.translate(lang, fr, ar);
  const createOp = useCreateSupplierOperation();

  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");

  const handlePay = () => {
    if (!supplier || !amount) return;
    createOp.mutate(
      { id: supplier.id, data: { amount: parseFloat(amount), date, reference: reference || undefined, note: note || undefined } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: ["suppliers"] });
          qc.invalidateQueries({ queryKey: getGetSupplierOperationsQueryKey(supplier.id) });
          onOpenChange(false);
          setAmount(""); setReference(""); setNote("");
        },
        onError: (err) => alert(`Erreur: ${(err as Error).message}`),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-emerald-600" />
            {t("Règlement fournisseur", "تسديد المورد")}
          </DialogTitle>
        </DialogHeader>
        {supplier && (
          <div className="text-sm text-muted-foreground mb-2">
            {supplier.name} — {t("Solde actuel:", "الرصيد الحالي:")}
            <span className="font-bold text-rose-600 ml-1">{fmt(supplier.currentBalance)} DA</span>
          </div>
        )}
        <div className="space-y-3">
          <div>
            <Label className="text-xs mb-1 block">{t("Montant (DA)", "المبلغ (دج)")}</Label>
            <Input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-9" />
          </div>
          <div>
            <Label className="text-xs mb-1 block">{t("Date", "التاريخ")}</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9" />
          </div>
          <div>
            <Label className="text-xs mb-1 block">{t("Référence", "المرجع")}</Label>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} className="h-9" />
          </div>
          <div>
            <Label className="text-xs mb-1 block">{t("Note", "ملاحظة")}</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} className="h-9" />
          </div>
        </div>
        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("Annuler", "إلغاء")}</Button>
          <Button
            onClick={handlePay}
            disabled={createOp.isPending || !amount}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {t("Confirmer le règlement", "تأكيد التسديد")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Ajustement Dialog ────────────────────────────────────────────────────────
function AjustementDialog({
  supplier, open, onOpenChange,
}: { supplier: Supplier | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const { lang } = useLang();
  const t = (fr: string, ar: string) => useLang.translate(lang, fr, ar);

  const [newBalance, setNewBalance] = React.useState("");
  const [date, setDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (open) { setNewBalance(""); setDate(new Date().toISOString().slice(0, 10)); setNote(""); setError(""); }
  }, [open]);

  const handleAdjust = async () => {
    if (!supplier || newBalance === "") return;
    const parsed = parseFloat(newBalance);
    if (!Number.isFinite(parsed)) { setError(t("Valeur invalide", "قيمة غير صالحة")); return; }
    setLoading(true); setError("");
    try {
      const token = localStorage.getItem("midanic_token");
      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/api/erp/suppliers/${supplier.id}/adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ targetBalance: parsed, date, note: note || undefined }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Erreur serveur"); }
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      qc.invalidateQueries({ queryKey: getGetSupplierOperationsQueryKey(supplier.id) });
      onOpenChange(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-amber-600" />
            {t("Ajustement de solde", "تعديل الرصيد")}
          </DialogTitle>
        </DialogHeader>
        {supplier && (
          <div className="text-sm text-muted-foreground mb-1 p-3 bg-amber-50 rounded-md border border-amber-100">
            <span className="font-medium">{supplier.name}</span>
            <br />
            {t("Solde actuel :", "الرصيد الحالي:")}
            <span className="font-bold ml-1 tabular-nums">{fmt(supplier.currentBalance)} DA</span>
          </div>
        )}
        <div className="space-y-3">
          <div>
            <Label className="text-xs mb-1 block">{t("Nouveau solde (DA)", "الرصيد الجديد (دج)")}</Label>
            <Input
              type="number"
              step="0.01"
              value={newBalance}
              onChange={(e) => setNewBalance(e.target.value)}
              placeholder="0.00"
              className="h-9"
            />
            {newBalance !== "" && Number.isFinite(parseFloat(newBalance)) && supplier && (
              <p className="text-xs text-muted-foreground mt-1">
                {t("Écart :", "الفارق:")}
                {" "}
                <span className="font-medium tabular-nums">
                  {(parseFloat(newBalance) - parseFloat(supplier.currentBalance ?? "0")).toLocaleString("fr-DZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DA
                </span>
              </p>
            )}
          </div>
          <div>
            <Label className="text-xs mb-1 block">{t("Date", "التاريخ")}</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9" />
          </div>
          <div>
            <Label className="text-xs mb-1 block">{t("Note (optionnel)", "ملاحظة (اختياري)")}</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} className="h-9" />
          </div>
          {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}
        </div>
        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("Annuler", "إلغاء")}</Button>
          <Button
            onClick={handleAdjust}
            disabled={loading || newBalance === ""}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {loading ? t("En cours…", "جارٍ التحديث…") : t("Confirmer", "تأكيد")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Import to Stores Dialog ──────────────────────────────────────────────────
function ImportDialog({
  supplier, open, onOpenChange,
}: { supplier: GlobalSupplier | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const { lang } = useLang();
  const t = (fr: string, ar: string) => useLang.translate(lang, fr, ar);
  const { currentStoreId } = useStoreContext();
  const { data: allStores } = useGetErpStoresAll();

  const otherStores = ((allStores ?? []) as StoreLite[])
    .filter((s) => s.id !== currentStoreId && s.isActive !== false);

  const [selected, setSelected] = React.useState<number[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (open) { setSelected([]); setError(""); }
  }, [open]);

  const toggle = (id: number) =>
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const handleImport = async () => {
    if (!supplier || selected.length === 0) return;
    setLoading(true); setError("");
    try {
      const token = localStorage.getItem("midanic_token");
      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/api/erp/suppliers/${supplier.id}/import-to-stores`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ targetStoreIds: selected }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error ?? "Erreur serveur"); }
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      onOpenChange(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Store className="h-4 w-4 text-indigo-600" />
            {t("Importer vers d'autres magasins", "استيراد إلى متاجر أخرى")}
          </DialogTitle>
        </DialogHeader>
        {supplier && (
          <div className="text-sm text-muted-foreground mb-1 p-3 bg-indigo-50 rounded-md border border-indigo-100">
            <span className="font-medium">{supplier.name}</span>
            <p className="text-xs mt-1">
              {t(
                "Le solde devient partagé : une opération dans n'importe quel magasin affecte le solde dans tous.",
                "يصبح الرصيد مشتركاً: أي عملية في أي متجر تؤثر على الرصيد في جميع المتاجر.",
              )}
            </p>
          </div>
        )}
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {otherStores.length === 0 ? (
            <p className="text-sm text-muted-foreground italic py-4 text-center">
              {t("Aucun autre magasin disponible", "لا توجد متاجر أخرى متاحة")}
            </p>
          ) : (
            otherStores.map((s) => (
              <label
                key={s.id}
                className="flex items-center gap-3 p-2 rounded-md border hover:bg-slate-50 cursor-pointer"
              >
                <Checkbox
                  checked={selected.includes(s.id)}
                  onCheckedChange={() => toggle(s.id)}
                />
                <span className="text-sm font-medium">{lang === "ar" ? s.nameAr : s.nameEn}</span>
              </label>
            ))
          )}
        </div>
        {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}
        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("Annuler", "إلغاء")}</Button>
          <Button
            onClick={handleImport}
            disabled={loading || selected.length === 0}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {loading ? t("En cours…", "جارٍ…") : t("Importer", "استيراد")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Statement Sheet ──────────────────────────────────────────────────────────
type UnifiedOp = GlobalOperation & { source?: "supplier" | "customer" };

function StatementSheet({
  supplier, open, onOpenChange, expanded, onToggleExpanded,
}: {
  supplier: Supplier | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  expanded: boolean;
  onToggleExpanded: () => void;
}) {
  const { lang } = useLang();
  const t = (fr: string, ar: string) => useLang.translate(lang, fr, ar);
  const qc = useQueryClient();
  const { can } = usePermissions();
  const linked = !!(supplier as GlobalSupplier | null)?.globalSupplierId;
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedOperation, setSelectedOperation] = useState<SupplierBalanceRow | null>(null);
  const [purchaseOrderId, setPurchaseOrderId] = useState<number | null>(null);
  const invalidDateRange = !!startDate && !!endDate && startDate > endDate;

  useEffect(() => {
    setStartDate("");
    setEndDate("");
    setSelectedOperation(null);
    setPurchaseOrderId(null);
  }, [supplier?.id, open]);

  const supplierId = supplier?.id ?? 0;
  const statementQueryKey = [...getGetSupplierOperationsQueryKey(supplierId), startDate, endDate];
  const { data, isLoading, isError, error } = useQuery({
    queryKey: statementQueryKey,
    enabled: open && !!supplier && !invalidDateRange,
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams();
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      const query = params.toString();
      const token = localStorage.getItem("midanic_token") ?? "";
      const response = await fetch(
        `${getApiBase()}/api/erp/suppliers/${supplierId}/operations${query ? `?${query}` : ""}`,
        { headers: { Authorization: `Bearer ${token}` }, signal },
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch supplier statement (${response.status})`);
      }
      return response.json() as Promise<SupplierStatementResponse>;
    },
  });

  // contactBalance is the unified contacts.current_balance returned by the API for
  // customer_supplier contacts. When present it is the canonical balance to display.
  const contactBalance = (data as { contactBalance?: string | null } | undefined)?.contactBalance ?? null;
  const isUnified = contactBalance != null;
  const displayBalance = contactBalance ?? supplier?.currentBalance ?? "0";
  const balanceNum = parseFloat(displayBalance);
  // Unified sign: positive = contact owes us (good → green). Supplier-only sign: positive = we owe (bad → red).
  const headerBalanceColor = isUnified
    ? (balanceNum > 0 ? "text-emerald-600" : balanceNum < 0 ? "text-rose-600" : "text-muted-foreground")
    : (balanceNum > 0 ? "text-rose-600" : balanceNum < 0 ? "text-emerald-600" : "text-muted-foreground");

  // Unified delta: same formula as the API. Used to assign Débit/Crédit columns.
  const unifiedDelta = (source: "supplier" | "customer" | undefined, type: string, amount: number): number => {
    if ((source ?? "supplier") === "supplier") {
      if (type === "purchase_comptant") return 0;
      return type === "purchase" ? -amount : amount;
    }
    return (type === "versement" || type === "avoir_retour") ? -amount : amount;
  };

  const opTypeBadge = (op: UnifiedOp) => {
    const src = op.source ?? "supplier";
    const opType = op.type as string;
    if (src === "customer") {
      if (opType === "vente_a_terme") return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
          <TrendingUp className="h-3 w-3" />{t("Vente à terme", "بيع بالدين")}
        </span>
      );
      if (opType === "versement") return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
          <TrendingDown className="h-3 w-3" />{t("Versement", "دفعة")}
        </span>
      );
      if (opType === "avoir_retour") return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
          <SlidersHorizontal className="h-3 w-3" />{t("Avoir retour", "أفوار")}
        </span>
      );
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
          {op.type}
        </span>
      );
    }
    if (opType === "purchase_comptant") return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
        {t("Achat comptant", "شراء نقدي")}
      </span>
    );
    if (op.type === "purchase") return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">
        <TrendingUp className="h-3 w-3" />{t("Achat", "شراء")}
      </span>
    );
    if (op.type === "ajustement") return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
        <SlidersHorizontal className="h-3 w-3" />{t("Ajustement", "تعديل")}
      </span>
    );
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
        <TrendingDown className="h-3 w-3" />{t("Règlement", "تسديد")}
      </span>
    );
  };

  const opTypeLabel = (op: UnifiedOp) => {
    const src = op.source ?? "supplier";
    const opType = op.type as string;
    if (src === "customer") {
      if (opType === "vente_a_terme") return t("Vente à terme", "بيع بالدين");
      if (opType === "versement") return t("Versement", "دفعة");
      if (opType === "avoir_retour") return t("Avoir retour", "أفوار");
      return op.type;
    }
    if (opType === "purchase_comptant") return t("Achat comptant", "شراء نقدي");
    if (opType === "purchase") return t("Achat", "شراء");
    if (opType === "ajustement") return t("Ajustement", "تعديل");
    if (opType === "payment") return t("Règlement", "تسديد");
    return op.type;
  };

  const openStatementOperation = (op: UnifiedOp) => {
    setSelectedOperation({
      op,
      label: opTypeLabel(op),
      dateLabel: op.date,
      debit: opDebit(op) == null ? null : Number(opDebit(op)),
      credit: opCredit(op) == null ? null : Number(opCredit(op)),
    });
  };

  const openLinkedPurchaseOrder = () => {
    if (!selectedOperation || !can("purchases", "view")) return;
    const id = getLinkedPurchaseOrderId(selectedOperation.op);
    if (id) setPurchaseOrderId(id);
  };

  const opDebit = (op: UnifiedOp): string | null => {
    const amt = parseFloat(op.amount ?? "0");
    if (isUnified) {
      // Débit = operation that increases unified balance (contact owes us more)
      return unifiedDelta(op.source, op.type, amt) > 0 ? op.amount : null;
    }
    // Pure supplier: purchase is debit; negative ajustement shown as debit
    if (op.type === "purchase") return op.amount;
    if (op.type === "ajustement" && amt < 0) return Math.abs(amt).toFixed(2);
    return null;
  };

  const opCredit = (op: UnifiedOp): string | null => {
    const amt = parseFloat(op.amount ?? "0");
    if (isUnified) {
      // Crédit = operation that decreases unified balance (we owe contact more)
      return unifiedDelta(op.source, op.type, amt) < 0 ? op.amount : null;
    }
    // Pure supplier: payment is credit; positive ajustement shown as credit
    if (op.type === "payment") return op.amount;
    if (op.type === "ajustement" && amt >= 0) return op.amount;
    return null;
  };

  const runningBalanceColor = (rb: string) => {
    const v = parseFloat(rb);
    if (isUnified) return v > 0 ? "text-emerald-600" : v < 0 ? "text-rose-600" : "text-muted-foreground";
    return v > 0 ? "text-rose-600" : v < 0 ? "text-emerald-600" : "text-muted-foreground";
  };

  const showStoreColumn = linked || isUnified;
  const statementHeaders = [
    t("Date", "التاريخ"),
    ...(showStoreColumn ? [t("Magasin", "المتجر")] : []),
    t("Type", "النوع"),
    t("Référence / Note", "المرجع / ملاحظة"),
    t("Débit", "مدين"),
    t("Crédit", "دائن"),
    t("Solde", "الرصيد"),
  ];
  const statementRows = ((data?.operations ?? []) as UnifiedOp[]).map((op) => {
    const typeLabel = opTypeLabel(op);

    const beforeAfter = `${t("Ancien", "قبل")}: ${op.balanceBefore != null ? fmt(op.balanceBefore) : "—"} → ${t("Nouveau", "بعد")}: ${op.balanceAfter != null ? fmt(op.balanceAfter) : "—"}`;
    return [
      op.date,
      ...(showStoreColumn ? [(lang === "ar" ? op.storeNameAr : op.storeNameEn) ?? "—"] : []),
      typeLabel,
      op.reference ?? op.note ?? "—",
      opDebit(op) != null ? fmt(opDebit(op)) : "—",
      opCredit(op) != null ? fmt(opCredit(op)) : "—",
      `${fmt(op.runningBalance)}\n${beforeAfter}`,
    ];
  });

  const handleDownloadCsv = () => {
    const csvCell = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const csv = "\uFEFF" + [statementHeaders, ...statementRows]
      .map((row) => row.map(csvCell).join(";"))
      .join("\r\n");
    const blobUrl = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    const supplierName = (supplier?.name ?? "supplier").replace(/[^\p{L}\p{N}_-]+/gu, "-").replace(/^-+|-+$/g, "") || "supplier";
    link.href = blobUrl;
    link.download = `supplier-statement-${supplierName}-${startDate || "all"}-${endDate || "dates"}-${lang}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      window.alert(t("Autorisez les fenêtres contextuelles pour imprimer le relevé.", "يرجى السماح بالنوافذ المنبثقة لطباعة كشف الحساب."));
      return;
    }
    printWindow.opener = null;
    const direction = lang === "ar" ? "rtl" : "ltr";
    const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[char] ?? char);
    const printRows = statementRows.map((row) =>
      `<tr>${row.map((cell, index) => `<td${index === (showStoreColumn ? 4 : 3) || index === (showStoreColumn ? 5 : 4) || index === (showStoreColumn ? 6 : 5) ? ' class="number"' : ""}>${escapeHtml(cell).replace(/\n/g, "<br>")}</td>`).join("")}</tr>`
    ).join("");
    const period = startDate || endDate
      ? `${t("Période", "الفترة")}: ${startDate || "—"} — ${endDate || "—"}`
      : t("Toutes les opérations", "جميع العمليات");
    printWindow.document.open();
    printWindow.document.write(`<!doctype html>
      <html lang="${lang}" dir="${direction}">
        <head>
          <meta charset="utf-8">
          <title>${escapeHtml(t("Relevé de compte fournisseur", "كشف حساب المورد"))} — ${escapeHtml(supplier?.name ?? "")}</title>
          <style>
            @page { size: landscape; margin: 12mm; }
            body { color: #172033; font: 12px Arial, "Noto Sans Arabic", sans-serif; direction: ${direction}; }
            h1 { margin: 0 0 6px; font-size: 20px; }
            .meta { display: flex; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
            table { width: 100%; border-collapse: collapse; direction: ${direction}; }
            th, td { border: 1px solid #cbd5e1; padding: 7px 8px; text-align: start; vertical-align: top; white-space: pre-wrap; }
            th { background: #f1f5f9; font-weight: 700; }
            .number { direction: ltr; text-align: end; font-variant-numeric: tabular-nums; }
            td:nth-child(${showStoreColumn ? 4 : 3}) { unicode-bidi: plaintext; }
            tr { break-inside: avoid; }
          </style>
        </head>
        <body>
          <h1>${escapeHtml(t("Relevé de compte fournisseur", "كشف حساب المورد"))} — ${escapeHtml(supplier?.name ?? "")}</h1>
          <div class="meta">
            <span>${escapeHtml(period)}</span>
            <span>${escapeHtml(t("Solde actuel", "الرصيد الحالي"))}: ${escapeHtml(fmt(displayBalance))} DA</span>
          </div>
          <table>
            <thead><tr>${statementHeaders.map((header, index) => `<th${index >= statementHeaders.length - 3 ? ' class="number"' : ""}>${escapeHtml(header)}</th>`).join("")}</tr></thead>
            <tbody>${printRows || `<tr><td colspan="${statementHeaders.length}">${escapeHtml(t("Aucune opération", "لا توجد عمليات"))}</td></tr>`}</tbody>
          </table>
          <script>window.onload = function () { window.focus(); window.print(); };</script>
        </body>
      </html>`);
    printWindow.document.close();
  };

  return (
    <>
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) {
          setSelectedOperation(null);
          setPurchaseOrderId(null);
        }
      }}
    >
      <SheetContent
        side="right"
        className={`w-full p-0 overflow-y-auto transition-[width,max-width] duration-200 ${expanded ? "w-[96vw] max-w-[96vw]" : "max-w-2xl"}`}
        style={expanded ? { width: "96vw", maxWidth: "96vw" } : undefined}
      >
        <SheetHeader className="px-5 py-4 border-b bg-[#1B3057] text-white">
          <div className="flex items-start justify-between gap-3 pr-8">
            <SheetTitle className="min-w-0 flex-1 text-white">
              <span className="inline-flex items-center gap-2">
                <FileText className="h-4 w-4 shrink-0" />
                {t("Relevé de compte", "كشف حساب")} — {supplier?.name ?? ""}
                {isUnified && <span className="text-xs font-normal bg-white/20 px-2 py-0.5 rounded-full">{t("Unifié", "موحّد")}</span>}
              </span>
            </SheetTitle>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                type="button"
                size="icon" variant="ghost"
                className="h-7 w-7 text-white hover:bg-white/20"
                title={expanded ? t("Réduire la fenêtre", "استعادة حجم النافذة") : t("Agrandir la fenêtre", "تكبير النافذة")}
                aria-label={expanded ? t("Réduire la fenêtre", "استعادة حجم النافذة") : t("Agrandir la fenêtre", "تكبير النافذة")}
                data-testid="button-toggle-supplier-statement-width"
                onClick={onToggleExpanded}
              >
                {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              </Button>
              <Button
                type="button"
                size="icon" variant="ghost"
                className="h-7 w-7 text-white hover:bg-white/20"
                title={t("Actualiser", "تحديث")}
                aria-label={t("Actualiser", "تحديث")}
                onClick={() => { if (supplier) qc.invalidateQueries({ queryKey: getGetSupplierOperationsQueryKey(supplier.id) }); }}
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </SheetHeader>

        {supplier && (
          <div className="px-5 py-3 bg-slate-50 border-b flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t("Solde actuel", "الرصيد الحالي")}</span>
            <span className={`font-bold text-lg ${headerBalanceColor}`}>
              {fmt(displayBalance)} DA
            </span>
          </div>
        )}

        <div className="p-4" dir={lang === "ar" ? "rtl" : "ltr"}>
          <div className="mb-4 grid grid-cols-1 gap-3 rounded-lg border bg-slate-50 p-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="supplier-statement-start-date" className="text-xs">
                {t("Date de début", "تاريخ البداية")}
              </Label>
              <Input
                id="supplier-statement-start-date"
                data-testid="input-supplier-statement-start-date"
                type="date"
                value={startDate}
                max={endDate || undefined}
                onChange={(event) => setStartDate(event.target.value)}
                className="h-9 bg-white"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="supplier-statement-end-date" className="text-xs">
                {t("Date de fin", "تاريخ النهاية")}
              </Label>
              <Input
                id="supplier-statement-end-date"
                data-testid="input-supplier-statement-end-date"
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={(event) => setEndDate(event.target.value)}
                className="h-9 bg-white"
              />
            </div>
            {invalidDateRange && (
              <p className="text-xs text-rose-600 sm:col-span-2">
                {t("La date de début ne peut pas être après la date de fin.", "لا يمكن أن يكون تاريخ البداية بعد تاريخ النهاية.")}
              </p>
            )}
            {data && !isLoading && !isError && !invalidDateRange && (
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                <Button type="button" size="sm" variant="outline" onClick={handleDownloadCsv} data-testid="button-download-supplier-statement-csv">
                  <Download className="mr-1.5 h-4 w-4" />{t("Télécharger CSV", "تنزيل CSV")}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={handlePrint} data-testid="button-print-supplier-statement">
                  <Printer className="mr-1.5 h-4 w-4" />{t("Imprimer / PDF", "طباعة / PDF")}
                </Button>
              </div>
            )}
          </div>
          {invalidDateRange ? null : isLoading ? (
            <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : isError ? (
            <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 py-6 text-center text-sm text-rose-700">
              {t("Impossible de charger le relevé.", "تعذر تحميل كشف الحساب.")}
              <span className="sr-only"> {(error as Error).message}</span>
            </div>
          ) : !data?.operations?.length ? (
            <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground italic">
              {startDate || endDate
                ? t("Aucune opération sur cette période", "لا توجد عمليات خلال هذه الفترة")
                : t("Aucune opération", "لا توجد عمليات")}
            </div>
          ) : (
            <>
              <p className="mb-3 text-xs text-muted-foreground">
                {t("Cliquez sur une opération pour voir ses détails et ouvrir le bon d'achat associé.", "اضغط على العملية لعرض تفاصيلها وفتح سند الشراء المرتبط بها.")}
              </p>
              <div className="space-y-3 md:hidden" data-testid="supplier-statement-cards">
                {(data.operations as UnifiedOp[]).map((op) => {
                  const debit = opDebit(op);
                  const credit = opCredit(op);
                  const label = opTypeLabel(op);
                  return (
                    <article
                      key={`${op.source ?? "s"}-${op.id}`}
                      data-testid={`card-supplier-statement-operation-${op.id}`}
                      role="button"
                      tabIndex={0}
                      aria-label={t(`Détails de l'opération ${label} du ${op.date}`, `تفاصيل عملية ${label} بتاريخ ${op.date}`)}
                      onClick={() => openStatementOperation(op)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openStatementOperation(op);
                        }
                      }}
                      className="min-w-0 cursor-pointer rounded-lg border bg-card p-3 space-y-3 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <div className="flex min-w-0 items-start justify-between gap-2">
                        <div className="min-w-0 space-y-1">
                          <div>{opTypeBadge(op)}</div>
                          <p className="text-xs text-muted-foreground tabular-nums" dir="ltr">{op.date}</p>
                        </div>
                        {(linked || isUnified) && (
                          <p className="min-w-0 max-w-[45%] break-words text-end text-[11px] text-muted-foreground">
                            {(lang === "ar" ? op.storeNameAr : op.storeNameEn) ?? "—"}
                          </p>
                        )}
                      </div>

                      <div className="min-w-0 border-t pt-2">
                        <p className="text-[10px] text-muted-foreground">{t("Référence / Note", "المرجع / ملاحظة")}</p>
                        <p className="mt-0.5 break-words text-xs" dir="auto">{op.reference ?? op.note ?? "—"}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="min-w-0 rounded-md bg-rose-50 px-2.5 py-2">
                          <p className="text-[10px] text-rose-700">{t("Débit", "مدين")}</p>
                          <p className="mt-0.5 break-words text-xs font-semibold tabular-nums text-rose-600" dir="ltr">
                            {debit != null ? fmt(debit) : "—"}
                          </p>
                        </div>
                        <div className="min-w-0 rounded-md bg-emerald-50 px-2.5 py-2">
                          <p className="text-[10px] text-emerald-700">{t("Crédit", "دائن")}</p>
                          <p className="mt-0.5 break-words text-xs font-semibold tabular-nums text-emerald-600" dir="ltr">
                            {credit != null ? fmt(credit) : "—"}
                          </p>
                        </div>
                      </div>

                      <div className="flex min-w-0 items-start justify-between gap-2 border-t pt-2">
                        <span className="shrink-0 text-xs text-muted-foreground">{t("Solde", "الرصيد")}</span>
                        <div className="min-w-0 text-end">
                          <p className={`break-words text-sm font-bold tabular-nums ${runningBalanceColor(op.runningBalance)}`} dir="ltr">
                            {fmt(op.runningBalance)}
                          </p>
                          <p className="mt-0.5 break-words text-[10px] font-normal text-muted-foreground">
                            {t("Ancien", "قبل")}: {op.balanceBefore != null ? fmt(op.balanceBefore) : "—"}
                            {" → "}
                            {t("Nouveau", "بعد")}: {op.balanceAfter != null ? fmt(op.balanceAfter) : "—"}
                          </p>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              <div
                className="hidden overflow-hidden rounded-md border md:block"
                data-testid="supplier-statement-table"
              >
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="font-semibold">{t("Date", "التاريخ")}</TableHead>
                      {(linked || isUnified) && <TableHead className="font-semibold">{t("Magasin", "المتجر")}</TableHead>}
                      <TableHead className="font-semibold">{t("Type", "النوع")}</TableHead>
                      <TableHead className="font-semibold">{t("Référence / Note", "المرجع / ملاحظة")}</TableHead>
                      <TableHead className="font-semibold text-right">{t("Débit", "مدين")}</TableHead>
                      <TableHead className="font-semibold text-right">{t("Crédit", "دائن")}</TableHead>
                      <TableHead className="font-semibold text-right">{t("Solde", "الرصيد")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data.operations as UnifiedOp[]).map((op) => {
                      const debit = opDebit(op);
                      const credit = opCredit(op);
                      return (
                        <TableRow
                          key={`${op.source ?? "s"}-${op.id}`}
                          role="button"
                          tabIndex={0}
                          aria-label={t(`Détails de l'opération ${opTypeLabel(op)} du ${op.date}`, `تفاصيل عملية ${opTypeLabel(op)} بتاريخ ${op.date}`)}
                          onClick={() => openStatementOperation(op)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              openStatementOperation(op);
                            }
                          }}
                          className="cursor-pointer hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <TableCell className="text-sm tabular-nums">{op.date}</TableCell>
                          {(linked || isUnified) && (
                            <TableCell className="text-xs text-muted-foreground">
                              {(lang === "ar" ? op.storeNameAr : op.storeNameEn) ?? "—"}
                            </TableCell>
                          )}
                          <TableCell>{opTypeBadge(op)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate" title={op.reference ?? op.note ?? undefined}>
                            {op.reference ?? op.note ?? "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-medium text-rose-600">
                            {debit != null ? fmt(debit) : "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-medium text-emerald-600">
                            {credit != null ? fmt(credit) : "—"}
                          </TableCell>
                          <TableCell className={`text-right tabular-nums font-bold ${runningBalanceColor(op.runningBalance)}`}>
                            {fmt(op.runningBalance)}
                            {/* Real balance snapshot captured at write time — never guessed.
                                "—" for rows created before this column existed (never backfilled). */}
                            <p className="text-[10px] font-normal text-muted-foreground mt-0.5 whitespace-nowrap">
                              {t("Ancien", "قبل")}: {op.balanceBefore != null ? fmt(op.balanceBefore) : "—"}
                              {" → "}
                              {t("Nouveau", "بعد")}: {op.balanceAfter != null ? fmt(op.balanceAfter) : "—"}
                            </p>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
    <SupplierBalanceOperationDialog
      row={selectedOperation}
      loading={false}
      canOpenPurchase={can("purchases", "view")}
      onClose={() => setSelectedOperation(null)}
      onOpenPurchase={openLinkedPurchaseOrder}
    />
    <SupplierPurchaseOrderDialog
      supplier={supplier}
      orderId={purchaseOrderId}
      open={purchaseOrderId != null}
      onOpenChange={(nextOpen) => { if (!nextOpen) setPurchaseOrderId(null); }}
    />
    </>
  );
}

// ─── Supplier Form Dialog ─────────────────────────────────────────────────────
// "Ajouter un fournisseur" reuses the same visual component as the Customers page
// ("Nouveau client"). Only the common fields are persisted via the existing
// supplier flow; "Type de contact" is shown + prefilled to "Fournisseur" only.
const emptySupplierForm: ContactFormState = { ...emptyContactForm, contactType: "supplier" };

// ─── Main Suppliers Page ──────────────────────────────────────────────────────
export default function Suppliers() {
  const qc = useQueryClient();
  const { lang } = useLang();
  const t = (fr: string, ar: string) => useLang.translate(lang, fr, ar);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [filterName, setFilterName] = useState("");
  const [filterContact, setFilterContact] = useState("");
  const [filterEmail, setFilterEmail] = useState("");
  const [filterPhone, setFilterPhone] = useState("");
  const [filterBalance, setFilterBalance] = useState("");

  // Debounce name for server-side search
  const [debouncedFilterName, setDebouncedFilterName] = useState("");
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedFilterName(filterName), 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [filterName]);
  useEffect(() => { setPage(1); }, [debouncedFilterName]);

  const _suppApiBase = getApiBase();
  const { data: suppliersPage, isLoading } = useQuery({
    queryKey: ["suppliers", page, pageSize, debouncedFilterName],
    queryFn: async () => {
      const token = localStorage.getItem("midanic_token") ?? "";
      const params = new URLSearchParams({ page: String(page), limit: String(pageSize) });
      if (debouncedFilterName) params.set("search", debouncedFilterName);
      const res = await fetch(`${_suppApiBase}/api/erp/suppliers?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch suppliers");
      return res.json() as Promise<{ data: Supplier[]; total: number }>;
    },
    placeholderData: keepPreviousData,
  });
  const totalSuppliers = suppliersPage?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalSuppliers / pageSize));

  const createSupplier = useCreateSupplier();
  const updateSupplier = useUpdateSupplier();

  // Contact/email/phone/balance filters are client-side on the current page
  const filteredSuppliers = (suppliersPage?.data ?? []).filter((s: Supplier) => {
    if (filterContact && !s.contactName?.toLowerCase().includes(filterContact.toLowerCase())) return false;
    if (filterEmail && !s.email?.toLowerCase().includes(filterEmail.toLowerCase())) return false;
    if (filterPhone && !s.phone?.toLowerCase().includes(filterPhone.toLowerCase())) return false;
    if (filterBalance && !String(parseFloat(s.currentBalance ?? "0").toFixed(2)).includes(filterBalance)) return false;
    return true;
  });

  const [dialog, setDialog] = useState<{ open: boolean; editing: Supplier | null }>({ open: false, editing: null });
  const [form, setForm] = useState<ContactFormState>(emptySupplierForm);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [statementSupplier, setStatementSupplier] = useState<Supplier | null>(null);
  const [statementOpen, setStatementOpen] = useState(false);
  const [statementExpanded, setStatementExpanded] = useState(false);
  const [paymentSupplier, setPaymentSupplier] = useState<Supplier | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [adjustSupplier, setAdjustSupplier] = useState<Supplier | null>(null);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [importSupplier, setImportSupplier] = useState<GlobalSupplier | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const openCreate = () => { setForm(emptySupplierForm); setSaveError(null); setDialog({ open: true, editing: null }); };
  const openEdit = (s: Supplier) => {
    setForm({
      ...emptySupplierForm,
      name: s.name ?? "", email: s.email ?? "", phone: s.phone ?? "",
      address: s.address ?? "", notes: s.notes ?? "",
      contactType: s.contactType ?? "supplier",
    });
    setSaveError(null);
    setDialog({ open: true, editing: s });
  };
  const openStatement = (s: Supplier) => {
    setStatementSupplier(s);
    setStatementExpanded(false);
    setStatementOpen(true);
  };
  const handleStatementOpenChange = (nextOpen: boolean) => {
    setStatementOpen(nextOpen);
    if (!nextOpen) setStatementExpanded(false);
  };
  const openPayment = (s: Supplier) => { setPaymentSupplier(s); setPaymentOpen(true); };
  const openAdjust = (s: Supplier) => { setAdjustSupplier(s); setAdjustOpen(true); };
  const openImport = (s: GlobalSupplier) => { setImportSupplier(s); setImportOpen(true); };

  // Keep the existing supplier flow: send only the fields the suppliers API
  // supports. contactName is preserved on edit (the reused form has no input for
  // it); the extra contact fields are display-only in this step.
  const handleSave = () => {
    const payload = {
      name: form.name,
      contactName: dialog.editing?.contactName ?? "",
      email: form.email,
      phone: form.phone,
      address: form.address,
      notes: form.notes,
      contactType: form.contactType as "supplier" | "customer_supplier",
    };
    // Close ONLY on success. On error, keep the dialog open and surface the API
    // message — otherwise a rejected save (e.g. missing email for the customer
    // side) silently closes and looks like it worked.
    const onSuccess = () => {
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      // A customer_supplier also creates/refreshes the customer side — refresh that list too.
      qc.invalidateQueries({ queryKey: getGetErpCustomersQueryKey() });
      setSaveError(null);
      setDialog({ open: false, editing: null });
    };
    const onError = (err: unknown) => {
      // ApiError from the generated client: `.data` is the parsed JSON error body.
      const e = err as { data?: { error?: string } | null; message?: string };
      setSaveError(e?.data?.error ?? e?.message ?? t("Échec de l'enregistrement", "فشل الحفظ"));
    };
    setSaveError(null);
    if (dialog.editing) {
      updateSupplier.mutate({ id: dialog.editing.id, data: payload }, { onSuccess, onError });
    } else {
      createSupplier.mutate({ data: payload }, { onSuccess, onError });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("Fournisseurs", "الموردون")}</h1>
          <p className="text-sm text-muted-foreground">{t("Gérer votre réseau de fournisseurs", "إدارة شبكة الموردين")}</p>
        </div>
        <Button onClick={openCreate} className="bg-[#1B3057] hover:bg-[#142441]" data-testid="button-add-supplier">
          <Plus className="h-4 w-4 mr-2" /> {t("Ajouter un fournisseur", "إضافة مورد")}
        </Button>
      </div>

      <Card className="border shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="font-semibold">{t("Nom", "الاسم")}</TableHead>
                    <TableHead className="font-semibold">{t("Contact", "جهة الاتصال")}</TableHead>
                    <TableHead className="font-semibold">Email</TableHead>
                    <TableHead className="font-semibold">{t("Téléphone", "الهاتف")}</TableHead>
                    <TableHead className="font-semibold text-right">{t("Solde (DA)", "الرصيد (دج)")}</TableHead>
                    <TableHead className="font-semibold text-center">{t("Actions", "الإجراءات")}</TableHead>
                  </TableRow>
                  <TableRow className="bg-white border-b">
                    <TableHead className="py-1 px-2">
                      <Input value={filterName} onChange={(e) => setFilterName(e.target.value)} placeholder={t("Filtre...", "بحث...")} className="h-7 text-xs" />
                    </TableHead>
                    <TableHead className="py-1 px-2">
                      <Input value={filterContact} onChange={(e) => setFilterContact(e.target.value)} placeholder={t("Filtre...", "بحث...")} className="h-7 text-xs" />
                    </TableHead>
                    <TableHead className="py-1 px-2">
                      <Input value={filterEmail} onChange={(e) => setFilterEmail(e.target.value)} placeholder={t("Filtre...", "بحث...")} className="h-7 text-xs" />
                    </TableHead>
                    <TableHead className="py-1 px-2">
                      <Input value={filterPhone} onChange={(e) => setFilterPhone(e.target.value)} placeholder={t("Filtre...", "بحث...")} className="h-7 text-xs" />
                    </TableHead>
                    <TableHead className="py-1 px-2">
                      <Input value={filterBalance} onChange={(e) => setFilterBalance(e.target.value)} placeholder={t("Filtre...", "بحث...")} className="h-7 text-xs text-right" />
                    </TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSuppliers.map((s: Supplier) => {
                    const balance = parseFloat(s.currentBalance ?? "0");
                    return (
                      <TableRow key={s.id} data-testid={`row-supplier-${s.id}`} className="hover:bg-slate-50/70">
                        <TableCell className="font-medium">
                          <span className="inline-flex items-center gap-1.5">
                            {s.name}
                            {(s as GlobalSupplier).globalSupplierId && (
                              <span
                                className="inline-flex items-center text-indigo-600"
                                title={t("Compte partagé entre magasins", "حساب مشترك بين المتاجر")}
                              >
                                <Link2 className="h-3.5 w-3.5" />
                              </span>
                            )}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">{s.contactName ?? "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{s.email ?? "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{s.phone ?? "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          <span className={`font-bold ${balance > 0 ? "text-rose-600" : balance < 0 ? "text-emerald-600" : "text-slate-500"}`}>
                            {fmt(balance)}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-7 w-7">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEdit(s)}>
                                <Pencil className="h-4 w-4 mr-2 text-slate-600" />
                                {t("Modifier", "تعديل")}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openStatement(s)}>
                                <FileText className="h-4 w-4 mr-2 text-blue-600" />
                                {t("Relevé de compte", "كشف الحساب")}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openPayment(s)}>
                                <CreditCard className="h-4 w-4 mr-2 text-emerald-600" />
                                {t("Règlement", "تسديد")}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openAdjust(s)}>
                                <SlidersHorizontal className="h-4 w-4 mr-2 text-amber-600" />
                                {t("Ajustement de solde", "تعديل الرصيد")}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openImport(s as GlobalSupplier)}>
                                <Store className="h-4 w-4 mr-2 text-indigo-600" />
                                {t("Importer vers d'autres magasins", "استيراد إلى متاجر أخرى")}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredSuppliers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        {t("Aucun fournisseur", "لا يوجد موردون")}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination bar */}
      {totalSuppliers > 0 && (
        <div className="flex items-center justify-between px-1 py-2 flex-wrap gap-2">
          <span className="text-xs text-muted-foreground">
            {totalSuppliers} {t("fournisseur(s)", "مورد")}
          </span>
          <div className="flex items-center gap-2">
            <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
              <SelectTrigger className="h-8 w-[90px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[10, 25, 50, 100, 200].map((n) => (
                  <SelectItem key={n} value={String(n)} className="text-xs">{n} / {t("page", "صفحة")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-8 px-2 text-xs"
                onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                ← {t("Préc.", "السابق")}
              </Button>
              {(() => {
                const pages: (number | "...")[] = [];
                if (totalPages <= 7) { for (let i = 1; i <= totalPages; i++) pages.push(i); }
                else {
                  pages.push(1);
                  if (page > 3) pages.push("...");
                  for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
                  if (page < totalPages - 2) pages.push("...");
                  pages.push(totalPages);
                }
                return pages.map((pg, i) =>
                  pg === "..." ? (
                    <span key={`e${i}`} className="px-1 text-muted-foreground text-xs select-none">…</span>
                  ) : (
                    <Button key={pg} variant={pg === page ? "default" : "outline"} size="sm"
                      className={`h-8 w-8 p-0 text-xs ${pg === page ? "bg-[#1B3057] hover:bg-[#1B3057]/90" : ""}`}
                      onClick={() => setPage(pg as number)}>
                      {pg}
                    </Button>
                  )
                );
              })()}
              <Button variant="outline" size="sm" className="h-8 px-2 text-xs"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                {t("Suiv.", "التالي")} →
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Dialog — reuses the shared "Nouveau client" 4-tab form */}
      <ContactFormDialog
        open={dialog.open}
        onOpenChange={(v) => setDialog((d) => ({ ...d, open: v }))}
        form={form}
        setForm={setForm}
        onSave={handleSave}
        saving={createSupplier.isPending || updateSupplier.isPending}
        error={saveError}
        title={<><UserPlus className="h-4 w-4" />{dialog.editing ? t("Modifier le fournisseur", "تعديل المورد") : t("Ajouter un fournisseur", "إضافة مورد")}</>}
        classifs={[]}
        tiers={[]}
        currency={lang === "ar" ? "دج" : "DA"}
        lang={lang}
        t={t}
        contactTypeOptions={[
          { value: "supplier", label: t("Fournisseur", "مورد") },
          { value: "customer_supplier", label: t("Client / Fournisseur", "عميل / مورد") },
        ]}
        saveButtonTestId="button-save-supplier"
      />

      {/* Statement Sheet */}
      <StatementSheet
        supplier={statementSupplier}
        open={statementOpen}
        onOpenChange={handleStatementOpenChange}
        expanded={statementExpanded}
        onToggleExpanded={() => setStatementExpanded((value) => !value)}
      />

      {/* Payment Dialog */}
      <PaymentDialog
        supplier={paymentSupplier}
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
      />

      {/* Ajustement Dialog */}
      <AjustementDialog
        supplier={adjustSupplier}
        open={adjustOpen}
        onOpenChange={setAdjustOpen}
      />

      {/* Import to Stores Dialog */}
      <ImportDialog
        supplier={importSupplier}
        open={importOpen}
        onOpenChange={setImportOpen}
      />
    </div>
  );
}
