type SupplierPurchaseOperation = {
  type: string;
  reference?: string | null;
  poId?: number | null;
  source?: "supplier" | "customer";
};

export function getLinkedPurchaseOrderId(
  operation: SupplierPurchaseOperation,
): number | null {
  if (operation.source === "customer") return null;
  if (!["purchase", "purchase_comptant", "payment"].includes(operation.type)) return null;

  const explicitId = Number(operation.poId);
  if (Number.isSafeInteger(explicitId) && explicitId > 0) return explicitId;

  const referenceMatch = operation.reference?.trim().match(/^PO[-:#\s]*(\d+)$/i);
  const orderId = Number(referenceMatch?.[1]);
  return Number.isSafeInteger(orderId) && orderId > 0 ? orderId : null;
}
