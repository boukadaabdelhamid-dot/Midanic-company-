import { pool as platformPool } from "@workspace/db";

const TENANT_DATABASE_NAME_RE = /^erp_tenant_[1-9][0-9]*$/;

export function getTenantDatabaseName(tenantId: number): string {
  if (!Number.isInteger(tenantId) || tenantId <= 0) {
    throw new Error("Invalid ERP tenant id");
  }
  return `erp_tenant_${tenantId}`;
}

export function isTenantDatabaseName(value: unknown): value is string {
  return typeof value === "string" && TENANT_DATABASE_NAME_RE.test(value);
}

function quoteIdentifier(identifier: string): string {
  if (!TENANT_DATABASE_NAME_RE.test(identifier)) {
    throw new Error("Invalid tenant database name");
  }
  return `"${identifier.replaceAll('"', '""')}"`;
}

export async function provisionTenantDatabase(tenantId: number): Promise<{
  databaseName: string;
  created: boolean;
}> {
  const databaseName = getTenantDatabaseName(tenantId);
  const existing = await platformPool.query<{ exists: boolean }>(
    "SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = $1) AS exists",
    [databaseName],
  );
  const created = !existing.rows[0]?.exists;
  if (created) {
    // CREATE DATABASE cannot run inside a transaction. The platform pool is
    // already connected to the Railway PostgreSQL service that owns tenants.
    await platformPool.query(`CREATE DATABASE ${quoteIdentifier(databaseName)}`);
  }
  return { databaseName, created };
}