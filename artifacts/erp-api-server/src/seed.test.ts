import assert from "node:assert/strict";
import test from "node:test";
import { runWithTenantDatabase } from "./lib/db";
import { shouldSeedDefaultProductTypes } from "./seed";

test("default product types are seeded in the shared database", () => {
  assert.equal(shouldSeedDefaultProductTypes(), true);
});

test("new company databases do not receive default product types", async () => {
  const shouldSeed = await runWithTenantDatabase(
    { tenantId: 741, databaseName: "erp_tenant_741" },
    () => shouldSeedDefaultProductTypes(),
  );
  assert.equal(shouldSeed, false);
});
