import assert from "node:assert/strict";
import test from "node:test";
import { normalizeSaleUnitLine } from "./sale-order-units";

test("converts wholesale units to base pieces and calculates the piece-price total", () => {
  const result = normalizeSaleUnitLine(
    { quantity: 10, unitPrice: 25, unitFactor: 10 },
    { unitSaleEnabled: true, colisage: 10 },
  );

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.quantity, 100);
    assert.equal(result.value.unitFactor, 10);
    assert.equal(result.value.unitPrice, 25);
    assert.equal(result.value.lineTotal, 2500);
  }
});

test("rejects fractional wholesale-unit counts", () => {
  const result = normalizeSaleUnitLine(
    { quantity: 1.5, unitPrice: 25, unitFactor: 10 },
    { unitSaleEnabled: true, colisage: 10 },
  );

  assert.equal(result.ok, false);
});

test("rejects a unit factor that does not match the product setting", () => {
  const result = normalizeSaleUnitLine(
    { quantity: 2, unitPrice: 25, unitFactor: 8 },
    { unitSaleEnabled: true, colisage: 10 },
  );

  assert.equal(result.ok, false);
});

test("allows an existing saved factor when product settings later change", () => {
  const result = normalizeSaleUnitLine(
    { quantity: 2, unitPrice: 25, unitFactor: 10 },
    { unitSaleEnabled: false, colisage: 1 },
    { allowHistoricalFactor: true },
  );

  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.value.quantity, 20);
});
