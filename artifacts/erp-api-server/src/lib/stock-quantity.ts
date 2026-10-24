export const STOCK_ZERO_EPSILON = 1e-12;

export function clampTinyStockToZero(value: number): number {
  return Number.isFinite(value) && Math.abs(value) <= STOCK_ZERO_EPSILON ? 0 : value;
}
