import assert from "node:assert/strict";
import test from "node:test";
import type { Request } from "express";
import {
  getRequestTenantHostname,
  normalizeTenantHostname,
  tenantStoreMatches,
  isConfiguredTenantHostname,
  verifyTenantDomainRequest,
} from "./tenant-domain";

function requestWith(headers: Record<string, string>): Request {
  const normalized = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
  );
  return {
    header(name: string) {
      return normalized[name.toLowerCase()];
    },
  } as Request;
}

test("tenant domains and stores fail closed on cross-company mismatches", async () => {
  const previous = {
    nodeEnv: process.env["NODE_ENV"],
    platformApiUrl: process.env["PLATFORM_API_URL"],
    platformSecret: process.env["PLATFORM_SERVICE_SECRET"],
    trustProxy: process.env["TRUST_PROXY"],
  };
  const originalFetch = globalThis.fetch;

  process.env["NODE_ENV"] = "production";
  process.env["PLATFORM_API_URL"] = "https://platform.example";
  process.env["PLATFORM_SERVICE_SECRET"] = "test-service-secret";
  delete process.env["TRUST_PROXY"];

  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.endsWith("/plattin.midanic.com")) {
      return new Response(JSON.stringify({
        hostname: "plattin.midanic.com",
        tenantId: 41,
        ownerUserId: 7,
        status: "active",
        domainStatus: "active",
        canAccess: true,
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ canAccess: false }), { status: 404 });
  };

  try {
    assert.equal(normalizeTenantHostname("Plattin.Midanic.com:443"), "plattin.midanic.com");
    assert.equal(
      getRequestTenantHostname(requestWith({
        Origin: "https://plattin.midanic.com",
        Host: "plattin.midanic.com",
      })),
      "plattin.midanic.com",
    );
    assert.equal(
      await verifyTenantDomainRequest(
        requestWith({ Host: "plattin.midanic.com" }),
        { hostname: "plattin.midanic.com", tenantId: 41, ownerUserId: 7 },
      ),
      true,
    );
    assert.equal(
      await verifyTenantDomainRequest(
        requestWith({ Host: "other.midanic.com" }),
        { hostname: "plattin.midanic.com", tenantId: 41, ownerUserId: 7 },
      ),
      false,
    );
    assert.equal(
      await verifyTenantDomainRequest(
        requestWith({ Host: "unknown.midanic.com" }),
        { hostname: "unknown.midanic.com", tenantId: 99, ownerUserId: 8 },
      ),
      false,
    );
    assert.equal(tenantStoreMatches(41, 41), true);
    assert.equal(tenantStoreMatches(41, 99), false);
    assert.equal(isConfiguredTenantHostname("plattin.midanic.com"), true);
    assert.equal(isConfiguredTenantHostname("erp-api.up.railway.app"), false);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries({
      NODE_ENV: previous.nodeEnv,
      PLATFORM_API_URL: previous.platformApiUrl,
      PLATFORM_SERVICE_SECRET: previous.platformSecret,
      TRUST_PROXY: previous.trustProxy,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});