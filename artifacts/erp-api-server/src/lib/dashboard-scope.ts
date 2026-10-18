/**
 * Dashboard aggregation is company-local. A tenant owner may aggregate only
 * while the request is running inside that tenant's dedicated database.
 */
export interface DashboardScopeInput {
  user?: { role: string; platformTenantId?: number };
  currentStoreId?: number;
  query: { storeId?: unknown };
  databaseContext?: { tenantId: number; databaseName: string };
}

export class DashboardScopeError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message);
  }
}

export function resolveDashboardStoreId(input: DashboardScopeInput): number | null {
  const { user, databaseContext } = input;
  const managesCompany = user?.role === "admin" || user?.role === "tenant_admin";
  if (user?.platformTenantId !== undefined || user?.role === "tenant_admin") {
    const tenantId = user.platformTenantId;
    if (
      !Number.isSafeInteger(tenantId) || !tenantId || tenantId <= 0 ||
      databaseContext?.tenantId !== tenantId ||
      databaseContext.databaseName !== `erp_tenant_${tenantId}`
    ) {
      throw new DashboardScopeError(
        "The dashboard requires the authenticated company database",
        403, "DASHBOARD_TENANT_CONTEXT_REQUIRED",
      );
    }
  }

  // Staff cannot widen or switch their scope with query parameters.
  if (!managesCompany) {
    if (!Number.isSafeInteger(input.currentStoreId) || !input.currentStoreId || input.currentStoreId <= 0) {
      throw new DashboardScopeError("No store selected", 400, "DASHBOARD_STORE_REQUIRED");
    }
    return input.currentStoreId;
  }

  const raw = input.query.storeId;
  if (raw === undefined || raw === "all") return null;
  if (typeof raw !== "string" || !/^[1-9]\d*$/.test(raw) || !Number.isSafeInteger(Number(raw))) {
    throw new DashboardScopeError("Invalid dashboard store", 400, "INVALID_DASHBOARD_STORE");
  }
  return Number(raw);
}

export async function validateDashboardStore(
  input: DashboardScopeInput,
  storeExists: (storeId: number, tenantId: number | undefined) => Promise<boolean>,
): Promise<number | null> {
  const storeId = resolveDashboardStoreId(input);
  if (
    storeId !== null &&
    (input.user?.role === "admin" || input.user?.role === "tenant_admin") &&
    !(await storeExists(storeId, input.user.platformTenantId))
  ) {
    throw new DashboardScopeError(
      "This store is not an active store of the current company",
      403, "DASHBOARD_STORE_FORBIDDEN",
    );
  }
  return storeId;
}
