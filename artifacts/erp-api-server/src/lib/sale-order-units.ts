export interface SaleUnitProduct {
  unitSaleEnabled: boolean | null;
  colisage: number | null;
}

export interface SaleUnitInput {
  quantity: number;
  unitPrice: number;
  unitFactor?: number | null;
}

export interface NormalizedSaleUnitLine {
  quantity: number;
  unitPrice: number;
  unitFactor: number;
  lineTotal: number;
}

export type SaleUnitNormalization =
  | { ok: true; value: NormalizedSaleUnitLine }
  | { ok: false; error: string };

/**
 * Sale-order input quantity is expressed in the selected sales unit.
 * Persisted quantity and price stay in base pieces, so existing stock,
 * accounting, and reporting calculations continue to use consistent units.
 */
export function normalizeSaleUnitLine(
  input: SaleUnitInput,
  product: SaleUnitProduct,
  options: { allowHistoricalFactor?: boolean } = {},
): SaleUnitNormalization {
  const factor = input.unitFactor ?? 1;
  if (!Number.isSafeInteger(factor) || factor < 1) {
    return { ok: false, error: "The unit conversion must be a positive whole number" };
  }

  if (factor === 1) {
    const lineTotal = input.quantity * input.unitPrice;
    if (!Number.isFinite(lineTotal)) return { ok: false, error: "Sale line total is invalid" };
    return {
      ok: true,
      value: { quantity: input.quantity, unitPrice: input.unitPrice, unitFactor: 1, lineTotal },
    };
  }

  const matchesCurrentProduct = product.unitSaleEnabled === true && product.colisage === factor;
  if (!matchesCurrentProduct && !options.allowHistoricalFactor) {
    return { ok: false, error: "Wholesale unit selling is not enabled for this product" };
  }
  if (!Number.isSafeInteger(input.quantity) || input.quantity < 1) {
    return { ok: false, error: "Quantity in wholesale units must be a positive whole number" };
  }

  const quantityInPieces = input.quantity * factor;
  const lineTotal = quantityInPieces * input.unitPrice;
  if (!Number.isSafeInteger(quantityInPieces) || !Number.isFinite(lineTotal)) {
    return { ok: false, error: "Converted sale quantity is invalid" };
  }

  return {
    ok: true,
    value: {
      quantity: quantityInPieces,
      unitPrice: input.unitPrice,
      unitFactor: factor,
      lineTotal,
    },
  };
}
