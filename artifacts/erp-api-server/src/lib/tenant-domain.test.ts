import assert from "node:assert/strict";
import test from "node:test";
import type { Request } from "express";
import {
  getRequestTenantHostname,
  normalizeTenantHostname,
  tenantStoreMatches,
  isConfiguredTenantHostname,
  resolvePlatformTenantDomain,
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
    webStoreRoot: process.env["WEB_STORE_ROOT_DOMAIN"],
    erpRoot: process.env["ERP_TENANT_ROOT_DOMAIN"],
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
    process.env["TRUST_PROXY"] = "1";
    assert.equal(
      getRequestTenantHostname(requestWith({
        Host: "midanic-erp-api-production.up.railway.app",
        "X-Forwarded-Host": "bkd.midanic.com",
      })),
      "bkd.midanic.com",
    );
    delete process.env["TRUST_PROXY"];
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
    process.env["WEB_STORE_ROOT_DOMAIN"] = "*.store.midanic.com";
    process.env["ERP_TENANT_ROOT_DOMAIN"] = "*.midanic.com";
    assert.equal(isConfiguredTenantHostname("plattin.store.midanic.com"), true);
    assert.equal(isConfiguredTenantHostname("erp-api.up.railway.app"), false);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries({
      NODE_ENV: previous.nodeEnv,
      PLATFORM_API_URL: previous.platformApiUrl,
      PLATFORM_SERVICE_SECRET: previous.platformSecret,
      TRUST_PROXY: previous.trustProxy,
      WEB_STORE_ROOT_DOMAIN: previous.webStoreRoot,
      ERP_TENANT_ROOT_DOMAIN: previous.erpRoot,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});


test("company Web Store hostnames fall back to the matching ERP tenant hostname", async () => {
  const previous = {
    nodeEnv: process.env["NODE_ENV"],
    platformApiUrl: process.env["PLATFORM_API_URL"],
    platformSecret: process.env["PLATFORM_SERVICE_SECRET"],
    webStoreRoot: process.env["WEB_STORE_ROOT_DOMAIN"],
    erpRoot: process.env["ERP_TENANT_ROOT_DOMAIN"],
  };
  const originalFetch = globalThis.fetch;

  process.env["NODE_ENV"] = "production";
  process.env["PLATFORM_API_URL"] = "https://platform.example";
  process.env["PLATFORM_SERVICE_SECRET"] = "test-service-secret";
  process.env["WEB_STORE_ROOT_DOMAIN"] = "*.store.midanic.com";
  process.env["ERP_TENANT_ROOT_DOMAIN"] = "*.midanic.com";

  const requestedHosts: string[] = [];
  globalThis.fetch = async (input) => {
    const url = String(input);
    requestedHosts.push(url.split("/").pop() ?? "");
    if (url.endsWith("/demo.midanic.com")) {
      return new Response(JSON.stringify({
        hostname: "demo.midanic.com",
        webStoreHostname: null,
        tenantId: 7,
        ownerUserId: 11,
        status: "active",
        domainStatus: "active",
        databaseStatus: "ready",
        maxStores: 2,
        maxUsers: 8,
        storageGb: 4,
        canAccess: true,
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
  };

  try {
    const value = await resolvePlatformTenantDomain("demo.store.midanic.com");
    assert.equal(value?.tenantId, 7);
    assert.equal(value?.maxStores, 2);
    assert.equal(value?.maxUsers, 8);
    assert.equal(value?.storageGb, 4);
    assert.deepEqual(requestedHosts, ["demo.store.midanic.com", "demo.midanic.com"]);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries({
      NODE_ENV: previous.nodeEnv,
      PLATFORM_API_URL: previous.platformApiUrl,
      PLATFORM_SERVICE_SECRET: previous.platformSecret,
      WEB_STORE_ROOT_DOMAIN: previous.webStoreRoot,
      ERP_TENANT_ROOT_DOMAIN: previous.erpRoot,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});