import assert from "node:assert/strict";
import test from "node:test";
import { getProductExposureFilter, isProductStaffRole } from "./product-visibility";

test("anonymous callers, customers, and unknown roles can only list exposed products", () => {
  for (const role of [undefined, "customer", "unknown"]) {
    for (const filter of [undefined, "true", "false", "non", "0", "invalid"]) {
      assert.equal(getProductExposureFilter(role, filter), true);
    }
    assert.equal(isProductStaffRole(role), false);
  }
});

test("ERP staff retain access to all products and both exposure filters", () => {
  for (const role of ["admin", "tenant_admin", "employee"]) {
    assert.equal(isProductStaffRole(role), true);
    assert.equal(getProductExposureFilter(role), undefined);
    assert.equal(getProductExposureFilter(role, "invalid"), undefined);
    for (const filter of ["true", "oui", "1", "yes", "TRUE"]) {
      assert.equal(getProductExposureFilter(role, filter), true);
    }
    for (const filter of ["false", "non", "0", "no", "FALSE"]) {
      assert.equal(getProductExposureFilter(role, filter), false);
    }
  }
});
