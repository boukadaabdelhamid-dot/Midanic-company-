export function requiredMaterialQuantity(
  quantityPerYield: number,
  yieldQuantity: number,
  plannedQuantity: number,
): number {
  if (
    !Number.isFinite(quantityPerYield) || quantityPerYield <= 0 ||
    !Number.isFinite(yieldQuantity) || yieldQuantity <= 0 ||
    !Number.isFinite(plannedQuantity) || plannedQuantity <= 0
  ) {
    throw new RangeError("Manufacturing quantities must be finite and greater than zero");
  }
  return quantityPerYield * plannedQuantity / yieldQuantity;
}

export function hasSufficientStock(available: number, required: number): boolean {
  return Number.isFinite(available) && Number.isFinite(required) &&
    available + 1e-9 >= required;
}

export function isBelowMinimumStock(stock: number, minStock: number | null): boolean {
  if (!Number.isFinite(stock) || (minStock !== null && !Number.isFinite(minStock))) {
    return false;
  }
  return stock <= 0 || (minStock !== null && stock <= minStock);
}

export function suggestedPurchaseQuantity(stock: number, minStock: number | null): number {
  if (!Number.isFinite(stock) || stock < 0 || (minStock !== null && (!Number.isFinite(minStock) || minStock < 0))) {
    throw new RangeError("Stock replenishment inputs are invalid");
  }
  return Math.max(1, (minStock ?? 0) - stock);
}

export function suggestedProductionQuantity(
  stock: number,
  minStock: number | null,
  plannedQuantity: number,
): number {
  if (
    !Number.isFinite(stock) || stock < 0 ||
    (minStock !== null && (!Number.isFinite(minStock) || minStock < 0)) ||
    !Number.isFinite(plannedQuantity) || plannedQuantity < 0
  ) {
    throw new RangeError("Production replenishment inputs are invalid");
  }
  const shortage = Math.max(0, (minStock ?? 0) - stock - plannedQuantity);
  if (shortage > 0) return shortage;
  return stock === 0 && plannedQuantity === 0 ? 1 : 0;
}

export function weightedAverageCost(
  existingQuantity: number,
  existingUnitCost: number,
  producedQuantity: number,
  materialCost: number,
): number {
  if (
    !Number.isFinite(existingQuantity) || existingQuantity < 0 ||
    !Number.isFinite(existingUnitCost) || existingUnitCost < 0 ||
    !Number.isFinite(producedQuantity) || producedQuantity <= 0 ||
    !Number.isFinite(materialCost) || materialCost < 0
  ) {
    throw new RangeError("Manufacturing cost inputs are invalid");
  }
  return (
    existingQuantity * existingUnitCost + materialCost
  ) / (existingQuantity + producedQuantity);
}
