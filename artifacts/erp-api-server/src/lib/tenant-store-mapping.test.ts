import assert from "node:assert/strict";
import test from "node:test";
import {
  createTenantOwnerStoreLinks,
  planTenantStoreBootstrap,
} from "./tenant-store-mapping";

test("tenant bootstrap preserves imported stores instead of adding a principal store", () => {
  const plan = planTenantStoreBootstrap([7, 12, 19], 42);

  assert.deepEqual(plan, {
    storeIds: [7, 12, 19],
    shouldCreatePrincipalStore: false,
  });
});

test("tenant bootstrap creates a principal store only for an empty tenant", () => {
  const plan = planTenantStoreBootstrap([], 42);

  assert.deepEqual(plan, {
    storeIds: [],
    shouldCreatePrincipalStore: true,
  });
});

test("tenant owner receives membership for every imported store", () => {
  assert.deepEqual(
    createTenantOwnerStoreLinks(100, [7, 12, 19, 12]),
    [
      { userId: 100, storeId: 7 },
      { userId: 100, storeId: 12 },
      { userId: 100, storeId: 19 },
    ],
  );
});

test("tenant store mapping rejects invalid IDs", () => {
  assert.throws(() => planTenantStoreBootstrap([0], 42), /Invalid store ID/);
  assert.throws(() => createTenantOwnerStoreLinks(100, [-1]), /Invalid store ID/);
});
