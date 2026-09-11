import assert from "node:assert/strict";
import test from "node:test";
import { isPasswordResetTokenUsable } from "./password-reset-token";

test("password reset tokens are valid before expiry", () => {
  const now = Date.parse("2026-09-11T10:00:00.000Z");
  assert.equal(
    isPasswordResetTokenUsable(
      { expiresAt: new Date(now + 60 * 60 * 1000), used: false },
      now,
    ),
    true,
  );
});

test("password reset tokens expire after one hour", () => {
  const now = Date.parse("2026-09-11T10:00:00.000Z");
  assert.equal(
    isPasswordResetTokenUsable(
      { expiresAt: new Date(now + 60 * 60 * 1000), used: false },
      now + 60 * 60 * 1000,
    ),
    false,
  );
});

test("password reset tokens cannot be used twice", () => {
  const now = Date.parse("2026-09-11T10:00:00.000Z");
  assert.equal(
    isPasswordResetTokenUsable(
      { expiresAt: new Date(now + 60 * 60 * 1000), used: true },
      now,
    ),
    false,
  );
  assert.equal(isPasswordResetTokenUsable(undefined, now), false);
});