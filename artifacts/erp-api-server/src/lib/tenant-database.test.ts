import assert from "node:assert/strict";
import test from "node:test";
import {
  getTenantDatabaseContext,
  isTenantDatabaseName,
  runWithTenantDatabase,
} from "./db";

test("tenant database names are deterministic and fail closed", () => {
  assert.equal(isTenantDatabaseName("erp_tenant_41"), true);
  assert.equal(isTenantDatabaseName("erp_tenant_0"), false);
  assert.equal(isTenantDatabaseName("erp_tenant_41_extra"), false);
  assert.equal(isTenantDatabaseName("company_41"), false);
});

test("tenant context does not leak across requests", async () => {
  assert.equal(getTenantDatabaseContext(), undefined);

  const observed = await Promise.all([
    runWithTenantDatabase(
      { tenantId: 41, databaseName: "erp_tenant_41" },
      async () => {
        await Promise.resolve();
        return getTenantDatabaseContext();
      },
    ),
    runWithTenantDatabase(
      { tenantId: 42, databaseName: "erp_tenant_42" },
      async () => {
        await Promise.resolve();
        return getTenantDatabaseContext();
      },
    ),
  ]);

  assert.deepEqual(observed, [
    { tenantId: 41, databaseName: "erp_tenant_41" },
    { tenantId: 42, databaseName: "erp_tenant_42" },
  ]);
  assert.equal(getTenantDatabaseContext(), undefined);
});

test("invalid tenant context is rejected before database selection", () => {
  assert.throws(
    () => runWithTenantDatabase({ tenantId: 41, databaseName: "erp_tenant_42" }, () => undefined),
    /Tenant id does not match tenant database name/,
  );
  assert.throws(
    () => runWithTenantDatabase({ tenantId: 0, databaseName: "erp_tenant_0" }, () => undefined),
    /Invalid tenant id/,
  );
});