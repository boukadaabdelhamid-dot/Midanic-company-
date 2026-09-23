import assert from "node:assert/strict";
import test from "node:test";
import { countLimitReached, storageLimitReached } from "./entitlement-limits";

test("count limits allow unlimited tenants and available seats", () => {
  assert.equal(countLimitReached(10, null), false);
  assert.equal(countLimitReached(2, 3), false);
  assert.equal(countLimitReached(2, 3, 2), true);
});

test("count limits reject a new resource at the configured maximum", () => {
  assert.equal(countLimitReached(3, 3), true);
  assert.equal(countLimitReached(0, 0), true);
});

test("storage limits allow the exact boundary but reject overflow", () => {
  const oneGb = 1024n ** 3n;
  assert.equal(storageLimitReached(0n, oneGb, null), false);
  assert.equal(storageLimitReached(512n, oneGb - 512n, 1), false);
  assert.equal(storageLimitReached(oneGb, 1n, 1), true);
});