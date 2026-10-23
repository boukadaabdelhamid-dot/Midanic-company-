import assert from "node:assert/strict";
import test from "node:test";
import {
  hasSufficientStock,
  requiredMaterialQuantity,
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

test("blends material cost into the finished product's weighted average cost", () => {
  assert.equal(weightedAverageCost(4, 200, 4, 1200), 250);
  assert.equal(weightedAverageCost(0, 0, 2, 800), 400);
});
