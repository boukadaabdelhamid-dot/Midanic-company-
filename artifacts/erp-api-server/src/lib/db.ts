import { AsyncLocalStorage } from "node:async_hooks";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@workspace/erp-db/schema";

const tenantDatabaseNameRe = /^erp_tenant_[1-9][0-9]*$/;
const sharedPool = new Pool({
  connectionString: process.env["DATABASE_URL"],
  options: "-c search_path=erp,public",
});

const sharedDb = drizzle(sharedPool, { schema });

export type TenantDatabaseContext = {
  tenantId: number;
  databaseName: string;
};

const tenantContext = new AsyncLocalStorage<TenantDatabaseContext>();
const tenantPools = new Map<string, Pool>();
const tenantDbs = new Map<string, typeof sharedDb>();

function tenantAdminUrl(): string {
  const value = process.env["TENANT_DATABASE_ADMIN_URL"] ?? process.env["DATABASE_URL"];
  if (!value) throw new Error("TENANT_DATABASE_ADMIN_URL or DATABASE_URL must be configured");
  return value;
}

export function isTenantDatabaseName(value: unknown): value is string {
  return typeof value === "string" && tenantDatabaseNameRe.test(value);
}

function tenantDatabaseUrl(databaseName: string): string {
  if (!isTenantDatabaseName(databaseName)) {
    throw new Error("Invalid tenant database name");
  }
  const url = new URL(tenantAdminUrl());
  url.pathname = `/${databaseName}`;
  return url.toString();
}

function getTenantPool(databaseName: string): Pool {
  const existing = tenantPools.get(databaseName);
  if (existing) return existing;
  const created = new Pool({
    connectionString: tenantDatabaseUrl(databaseName),
    options: "-c search_path=erp,public",
    max: Number(process.env["TENANT_DATABASE_POOL_MAX"] ?? "8"),
  });
  tenantPools.set(databaseName, created);
  return created;
}

export function getTenantDatabasePool(databaseName: string): Pool {
  return getTenantPool(databaseName);
}

function getTenantDb(databaseName: string): typeof sharedDb {
  const existing = tenantDbs.get(databaseName);
  if (existing) return existing;
  const created = drizzle(getTenantPool(databaseName), { schema });
  tenantDbs.set(databaseName, created);
  return created;
}

function currentDb(): typeof sharedDb {
  const context = tenantContext.getStore();
  return context ? getTenantDb(context.databaseName) : sharedDb;
}

/**
 * Existing ERP modules import one `db` object. This proxy keeps that API
 * stable while selecting the tenant database from AsyncLocalStorage for the
 * current authenticated request. Startup/bootstrap code without a tenant
 * context continues to use the shared legacy database.
 */
export const db = new Proxy(sharedDb, {
  get(_target, property, receiver) {
    const selected = currentDb();
    const value = Reflect.get(selected, property, receiver);
    return typeof value === "function" ? value.bind(selected) : value;
  },
}) as typeof sharedDb;

export const pool = sharedPool;
export { schema };

export function getTenantDatabaseContext(): TenantDatabaseContext | undefined {
  return tenantContext.getStore();
}

export function runWithTenantDatabase<T>(
  context: TenantDatabaseContext,
  callback: () => T | Promise<T>,
): T | Promise<T> {
  if (!Number.isInteger(context.tenantId) || context.tenantId <= 0) {
    throw new Error("Invalid tenant id");
  }
  if (!isTenantDatabaseName(context.databaseName)) {
    throw new Error("Invalid tenant database name");
  }
  if (context.databaseName !== `erp_tenant_${context.tenantId}`) {
    throw new Error("Tenant id does not match tenant database name");
  }
  return tenantContext.run(context, callback);
}

export async function provisionTenantDatabase(databaseName: string): Promise<{
  created: boolean;
}> {
  if (!isTenantDatabaseName(databaseName)) {
    throw new Error("Invalid tenant database name");
  }
  const adminPool = new Pool({ connectionString: tenantAdminUrl(), max: 1 });
  try {
    const existing = await adminPool.query<{ exists: boolean }>(
      "SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = $1) AS exists",
      [databaseName],
    );
    let created = !existing.rows[0]?.exists;
    if (created) {
      try {
        await adminPool.query(`CREATE DATABASE "${databaseName}"`);
      } catch (error) {
        if ((error as { code?: string }).code !== "42P04") throw error;
        // Another ERP instance won the provisioning race.
        created = false;
      }
    }
    const tenantPool = getTenantPool(databaseName);
    await tenantPool.query('CREATE SCHEMA IF NOT EXISTS "erp"');
    return { created };
  } finally {
    await adminPool.end();
  }
}
