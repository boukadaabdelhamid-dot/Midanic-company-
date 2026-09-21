import { and, eq, inArray } from "drizzle-orm";
import { db, erpTenantsTable } from "@workspace/db";
import { logger } from "./logger";
import { getTenantDatabaseName } from "./erp-tenant-database";
import { provisionErpTenantDatabase } from "./erp-provisioning";

const retryDelaysMs = [0, 2_000, 5_000, 10_000, 20_000];

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function provisionWithStartupRetries(tenantId: number) {
  let lastError: unknown;
  for (const retryDelay of retryDelaysMs) {
    if (retryDelay > 0) await delay(retryDelay);
    try {
      return await provisionErpTenantDatabase(tenantId);
    } catch (error) {
      lastError = error;
      logger.warn(
        { err: error, tenantId, retryDelay },
        "ERP tenant startup provisioning attempt failed",
      );
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("ERP tenant startup provisioning failed");
}

/**
 * Repairs active legacy tenants created before dedicated tenant databases were
 * mandatory. Provisioning is idempotent in ERP API, so retrying records left
 * in `provisioning` by an interrupted deployment is also safe.
 */
export async function reconcileUnprovisionedErpTenants(): Promise<void> {
  const tenants = await db
    .select({ id: erpTenantsTable.id })
    .from(erpTenantsTable)
    .where(and(
      inArray(erpTenantsTable.status, ["active", "converted"]),
      inArray(erpTenantsTable.databaseStatus, ["unprovisioned", "provisioning"]),
    ))
    .orderBy(erpTenantsTable.id);

  for (const tenant of tenants) {
    await db
      .update(erpTenantsTable)
      .set({
        databaseName: getTenantDatabaseName(tenant.id),
        databaseStatus: "provisioning",
        databaseLastError: null,
      })
      .where(eq(erpTenantsTable.id, tenant.id));

    try {
      const provisioning = await provisionWithStartupRetries(tenant.id);
      await db
        .update(erpTenantsTable)
        .set({
          databaseName: provisioning.databaseName,
          databaseStatus: "ready",
          databaseProvisionedAt: new Date(),
          databaseLastError: null,
        })
        .where(eq(erpTenantsTable.id, tenant.id));
      logger.info(
        { tenantId: tenant.id, databaseName: provisioning.databaseName },
        "ERP tenant database reconciled",
      );
    } catch (error) {
      await db
        .update(erpTenantsTable)
        .set({
          databaseName: getTenantDatabaseName(tenant.id),
          databaseStatus: "failed",
          databaseLastError: (error as Error).message.slice(0, 2000),
        })
        .where(eq(erpTenantsTable.id, tenant.id));
      logger.error(
        { err: error, tenantId: tenant.id },
        "ERP tenant database reconciliation failed",
      );
    }
  }
}