export type TenantStoreBootstrapPlan = {
  storeIds: number[];
  shouldCreatePrincipalStore: boolean;
};

export function planTenantStoreBootstrap(
  existingStoreIds: readonly number[],
  tenantId: number,
): TenantStoreBootstrapPlan {
  if (!Number.isInteger(tenantId) || tenantId <= 0) {
    throw new Error("Invalid tenant ID for store bootstrap.");
  }
  if (existingStoreIds.some((id) => !Number.isInteger(id) || id <= 0)) {
    throw new Error("Invalid store ID in tenant database.");
  }

  const storeIds = [...new Set(existingStoreIds)];
  return {
    storeIds,
    shouldCreatePrincipalStore: storeIds.length === 0,
  };
}

export function createTenantOwnerStoreLinks(userId: number, storeIds: readonly number[]) {
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error("Invalid tenant owner ID.");
  }
  if (storeIds.some((id) => !Number.isInteger(id) || id <= 0)) {
    throw new Error("Invalid store ID for tenant owner access.");
  }

  return [...new Set(storeIds)].map((storeId) => ({ userId, storeId }));
}
