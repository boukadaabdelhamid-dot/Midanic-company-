import assert from "node:assert/strict";
import test from "node:test";
import {
  hasSufficientStock,
  isBelowMinimumStock,
  requiredMaterialQuantity,
  suggestedProductionQuantity,
  suggestedPurchaseQuantity,
  weightedAverageCost,
} from "./manufacturing-calculations";

test("scales recipe material amounts proportionally, including fractional quantities", () => {
  assert.equal(requiredMaterialQuantity(1.5, 10, 2.5), 0.375);
});

test("rejects zero or invalid recipe quantities", () => {
  assert.throws(() => requiredMaterialQuantity(1, 0, 2), RangeError);
  assert.throws(() => requiredMaterialQuantity(1, 2, Number.NaN), RangeError);
});

test("checks available stock with only a small floating-point tolerance", () => {
  assert.equal(hasSufficientStock(0.3, 0.30000000001), true);
  assert.equal(hasSufficientStock(0.29, 0.3), false);
});

test("flags exhausted stock and stock at or below the configured minimum", () => {
  assert.equal(isBelowMinimumStock(0, null), true);
  assert.equal(isBelowMinimumStock(4, 4), true);
  assert.equal(isBelowMinimumStock(5, 4), false);
  assert.equal(isBelowMinimumStock(4, null), false);
});

test("suggests purchasing enough to restore the minimum, or one unit when none is configured", () => {
  assert.equal(suggestedPurchaseQuantity(2, 8), 6);
  assert.equal(suggestedPurchaseQuantity(0, null), 1);
});

test("suggests production after accounting for planned orders", () => {
  assert.equal(suggestedProductionQuantity(2, 10, 3), 5);
  assert.equal(suggestedProductionQuantity(0, null, 0), 1);
  assert.equal(suggestedProductionQuantity(0, 10, 10), 0);
  assert.throws(() => suggestedProductionQuantity(0, 10, -1), RangeError);
});

test("blends material cost into the finished product's weighted average cost", () => {
  assert.equal(weightedAverageCost(4, 200, 4, 1200), 250);
  assert.equal(weightedAverageCost(0, 0, 2, 800), 400);
});
