import test from "node:test";
import assert from "node:assert/strict";
import { getDatabaseErrorCode, isDatabaseUniqueViolation } from "./db-errors";

test("database error codes are found through Drizzle-style cause wrappers", () => {
  const error = new Error("Failed query", {
    cause: Object.assign(new Error("duplicate key"), { code: "23505" }),
  });

  assert.equal(getDatabaseErrorCode(error), "23505");
  assert.equal(isDatabaseUniqueViolation(error), true);
  assert.equal(isDatabaseUniqueViolation(new Error("other")), false);
});