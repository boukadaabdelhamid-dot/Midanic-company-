import assert from "node:assert/strict";
import test from "node:test";
import { formatReturnQuantityInput, parseReturnQuantityInput } from "./return-quantity";

test("accepts comma and dot as decimal separators", () => {
  assert.equal(parseReturnQuantityInput("1,5"), 1.5);
  assert.equal(parseReturnQuantityInput("1.5"), 1.5);
  assert.equal(parseReturnQuantityInput(" 0,25 "), 0.25);
});

test("rejects empty, zero, negative, and malformed quantities", () => {
  for (const value of ["", "0", "0,0", "-1,5", "1,2,3", "1.2,3", "abc"]) {
    assert.equal(parseReturnQuantityInput(value), null, value);
  }
});

test("formats decimal quantities using a comma for editing", () => {
  assert.equal(formatReturnQuantityInput(1.5), "1,5");
  assert.equal(formatReturnQuantityInput(2), "2");
});
