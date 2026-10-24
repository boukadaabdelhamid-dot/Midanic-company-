import assert from "node:assert/strict";
import test from "node:test";
import { clampTinyStockToZero, STOCK_ZERO_EPSILON } from "./stock-quantity";

test("floating-point residue close to zero is treated as zero", () => {
  assert.equal(clampTinyStockToZero(2.4313884239290928e-14), 0);
  assert.equal(clampTinyStockToZero(-STOCK_ZERO_EPSILON / 2), 0);
});

test("real fractional stock is preserved", () => {
  assert.equal(clampTinyStockToZero(0.43999999999999895), 0.43999999999999895);
  assert.equal(clampTinyStockToZero(0.000001), 0.000001);
});
