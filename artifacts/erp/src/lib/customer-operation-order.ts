import type { CustomerOperation } from "@workspace/erp-api-client-react";

export function getLinkedSaleOrderId(
  operation: Pick<CustomerOperation, "type" | "reference" | "note">,
): number | null {
  if (operation.type !== "vente_a_terme") return null;
  const referenceMatch = operation.reference?.trim().match(/^ORDER[-:#\s]*(\d+)$/i);
  const noteMatch = operation.note?.match(/(?:commande|order)\s*#?\s*(\d+)/i);
  const orderId = Number(referenceMatch?.[1] ?? noteMatch?.[1]);
  return Number.isSafeInteger(orderId) && orderId > 0 ? orderId : null;
}
