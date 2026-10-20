export function parseReturnQuantityInput(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d+(?:\.\d*)?$/.test(normalized)) return null;
  const quantity = Number(normalized);
  return Number.isFinite(quantity) && quantity > 0 ? quantity : null;
}

export function formatReturnQuantityInput(value: number): string {
  return String(value).replace(".", ",");
}
