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
