import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DashboardScopeError, resolveDashboardStoreId, validateDashboardStore,
  type DashboardScopeInput,
} from "./dashboard-scope";

const owner = (storeId?: unknown): DashboardScopeInput => ({
  user: { role: "tenant_admin", platformTenantId: 12 },
  currentStoreId: 1,
  databaseContext: { tenantId: 12, databaseName: "erp_tenant_12" },
  query: { storeId },
});

test("company owner can aggregate all stores by default and explicitly", () => {
  assert.equal(resolveDashboardStoreId(owner()), null);
  assert.equal(resolveDashboardStoreId(owner("all")), null);
  assert.equal(resolveDashboardStoreId(owner("2")), 2);
});

test("tenant aggregation fails closed without the matching dedicated database", () => {
  for (const databaseContext of [
    undefined,
    { tenantId: 99, databaseName: "erp_tenant_99" },
    { tenantId: 12, databaseName: "erp_tenant_99" },
    { tenantId: 12, databaseName: "shared" },
  ]) {
    assert.throws(
      () => resolveDashboardStoreId({ ...owner(), databaseContext }),
      (e: unknown) => e instanceof DashboardScopeError && e.status === 403,
    );
  }
  assert.throws(() => resolveDashboardStoreId({
    ...owner(), user: { role: "tenant_admin" },
  }), DashboardScopeError);
});

test("legacy tenant-bound admin tokens must also use their own database", () => {
  assert.throws(() => resolveDashboardStoreId({
    ...owner(), user: { role: "admin", platformTenantId: 12 }, databaseContext: undefined,
  }), DashboardScopeError);
});

test("legacy standalone admin preserves all-store aggregation", () => {
  const req = { user: { role: "admin" }, query: {} };
  assert.equal(resolveDashboardStoreId(req), null);
  assert.equal(resolveDashboardStoreId({ ...req, query: { storeId: "2" } }), 2);
});

test("employees cannot widen scope or select another store", () => {
  for (const storeId of [undefined, "all", "2", ["1", "2"]]) {
    assert.equal(resolveDashboardStoreId({
      ...owner(storeId), user: { role: "employee", platformTenantId: 12 },
    }), 1);
  }
});

test("employees without a selected store never fall back to all stores", () => {
  assert.throws(() => resolveDashboardStoreId({
    user: { role: "employee" }, query: {},
  }), DashboardScopeError);
});

test("invalid administrator store filters are rejected instead of broadening scope", () => {
  for (const id of ["", "0", "-1", "2junk", "1.5", "1e2", " 2", ["2"], {}, "9007199254740992"]) {
    assert.throws(() => resolveDashboardStoreId(owner(id)),
      (e: unknown) => e instanceof DashboardScopeError && e.status === 400);
  }
});

test("specific-store lookup receives the authenticated tenant ID", async () => {
  const calls: unknown[] = [];
  assert.equal(await validateDashboardStore(owner("2"), async (...args) => {
    calls.push(args); return true;
  }), 2);
  assert.deepEqual(calls, [[2, 12]]);
});

test("foreign, inactive and nonexistent stores are refused", async () => {
  await assert.rejects(validateDashboardStore(owner("99"), async () => false),
    (e: unknown) => e instanceof DashboardScopeError &&
      e.status === 403 && e.code === "DASHBOARD_STORE_FORBIDDEN");
});

test("all-store aggregation needs no foreign or shared database lookup", async () => {
  assert.equal(await validateDashboardStore(owner("all"), async () => {
    assert.fail("must not look up or switch a database for all stores");
  }), null);
});
