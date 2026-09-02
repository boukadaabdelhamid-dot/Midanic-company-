import assert from "node:assert/strict";
import test from "node:test";
import {
  buildErpTenantHostname,
  buildErpTenantLaunchUrl,
  parseErpSubdomain,
} from "./erp-domain";

test("ERP tenant subdomains are normalized, validated, and used in launch URLs", () => {
  const previousRootDomain = process.env["ERP_TENANT_ROOT_DOMAIN"];
  process.env["ERP_TENANT_ROOT_DOMAIN"] = "Midanic.com.";
  try {
    assert.equal(parseErpSubdomain("  Plattin  "), "plattin");
    assert.equal(buildErpTenantHostname("plattin"), "plattin.midanic.com");
    assert.equal(
      buildErpTenantLaunchUrl("plattin.midanic.com", "signed ticket"),
      "https://plattin.midanic.com/sso?hostname=plattin.midanic.com&token=signed+ticket",
    );
    assert.throws(() => parseErpSubdomain("-invalid"), /Subdomain must/);
    assert.throws(() => parseErpSubdomain("api"), /reserved/);
  } finally {
    if (previousRootDomain === undefined) {
      delete process.env["ERP_TENANT_ROOT_DOMAIN"];
    } else {
      process.env["ERP_TENANT_ROOT_DOMAIN"] = previousRootDomain;
    }
  }
});