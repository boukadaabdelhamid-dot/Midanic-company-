import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { generateLegacyDesktopLicenseKey } from "./legacy-desktop-license";

const originalSalt = process.env.DESKTOP_LEGACY_LICENSE_SALT;

afterEach(() => {
  if (originalSalt === undefined) {
    delete process.env.DESKTOP_LEGACY_LICENSE_SALT;
  } else {
    process.env.DESKTOP_LEGACY_LICENSE_SALT = originalSalt;
  }
});

test("matches the legacy HMAC-SHA256 and Base32 key format", () => {
  process.env.DESKTOP_LEGACY_LICENSE_SALT = 'b"test-\\xab"';

  assert.equal(
    generateLegacyDesktopLicenseKey("0123456789abcdef"),
    "ALQZA-F76EF-WJS6T-7CUBL",
  );
});

test("accepts salt values with quotes removed or escaped bytes decoded", () => {
  process.env.DESKTOP_LEGACY_LICENSE_SALT = `test-${String.fromCharCode(0xab)}`;

  assert.equal(
    generateLegacyDesktopLicenseKey("0123456789abcdef"),
    "ALQZA-F76EF-WJS6T-7CUBL",
  );
});

test("fails closed when the legacy salt is missing", () => {
  delete process.env.DESKTOP_LEGACY_LICENSE_SALT;

  assert.throws(
    () => generateLegacyDesktopLicenseKey("0123456789ABCDEF"),
    /not configured/,
  );
});