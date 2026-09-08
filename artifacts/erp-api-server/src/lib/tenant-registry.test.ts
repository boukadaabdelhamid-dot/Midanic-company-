import assert from "node:assert/strict";
import test from "node:test";
import { listReadyTenantDatabases } from "./tenant-registry";

test("tenant database registry accepts only matching tenant database names", async () => {
  const previous = {
    nodeEnv: process.env["NODE_ENV"],
    platformApiUrl: process.env["PLATFORM_API_URL"],
    platformSecret: process.env["PLATFORM_SERVICE_SECRET"],
  };
  const originalFetch = globalThis.fetch;

  process.env["NODE_ENV"] = "production";
  process.env["PLATFORM_API_URL"] = "https://platform.example";
  process.env["PLATFORM_SERVICE_SECRET"] = "test-service-secret";

  try {
    globalThis.fetch = async () => new Response(JSON.stringify({
      tenants: [
        { tenantId: 41, databaseName: "erp_tenant_41" },
        { tenantId: 42, databaseName: "erp_tenant_42" },
      ],
    }), { status: 200, headers: { "Content-Type": "application/json" } });

    assert.deepEqual(await listReadyTenantDatabases(), [
      { tenantId: 41, databaseName: "erp_tenant_41" },
      { tenantId: 42, databaseName: "erp_tenant_42" },
    ]);

    globalThis.fetch = async () => new Response(JSON.stringify({
      tenants: [{ tenantId: 41, databaseName: "erp_tenant_42" }],
    }), { status: 200, headers: { "Content-Type": "application/json" } });

    await assert.rejects(
      () => listReadyTenantDatabases(),
      /invalid tenant/,
    );
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries({
      NODE_ENV: previous.nodeEnv,
      PLATFORM_API_URL: previous.platformApiUrl,
      PLATFORM_SERVICE_SECRET: previous.platformSecret,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});