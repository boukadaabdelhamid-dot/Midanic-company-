import { and, eq } from "drizzle-orm";
import { db, schema, getTenantDatabaseContext, runWithTenantDatabase } from "./db";
import { resolvePlatformTenantDatabase } from "./tenant-domain";
import type { JwtPayload } from "./auth";

export type SessionAccount = {
  role: string;
  isActive: boolean;
  sessionVersion: number;
  platformUserId: number | null;
};

async function inSessionDatabase<T>(user: JwtPayload, callback: () => Promise<T>): Promise<T> {
  if (!user.platformTenantId || getTenantDatabaseContext()?.tenantId === user.platformTenantId) {
    return callback();
  }
  const tenant = await resolvePlatformTenantDatabase(user.platformTenantId);
  if (tenant?.databaseStatus !== "ready" || !tenant.databaseName) {
    throw new Error("Session database unavailable");
  }
  return runWithTenantDatabase(
    { tenantId: user.platformTenantId, databaseName: tenant.databaseName }, callback,
  );
}

// Centralized lookup also allows middleware tests to supply isolated accounts
// without provisioning fictitious company databases.
export const sessionAccounts = {
  async load(user: JwtPayload): Promise<SessionAccount | undefined> {
    return inSessionDatabase(user, async () => {
      const [account] = await db.select({
        role: schema.usersTable.role,
        isActive: schema.usersTable.isActive,
        sessionVersion: schema.usersTable.sessionVersion,
        platformUserId: schema.usersTable.platformUserId,
      }).from(schema.usersTable).where(eq(schema.usersTable.id, user.id)).limit(1);
      return account;
    });
  },
  async storeIds(user: JwtPayload): Promise<Set<number>> {
    return inSessionDatabase(user, async () => {
      const rows = await db.select({ id: schema.storesTable.id })
        .from(schema.userStoresTable)
        .innerJoin(schema.storesTable, eq(schema.userStoresTable.storeId, schema.storesTable.id))
        .where(and(
          eq(schema.userStoresTable.userId, user.id),
          eq(schema.storesTable.isActive, true),
          user.platformTenantId === undefined ? undefined : eq(schema.storesTable.platformTenantId, user.platformTenantId),
        ));
      return new Set(rows.map(row => row.id));
    });
  },
};

export function isAccountSessionCurrent(user: JwtPayload, account: SessionAccount | undefined): boolean {
  if (!account?.isActive || (user.exp !== undefined && user.exp <= Date.now() / 1000)) return false;
  const role = user.role === "tenant_admin" ? "admin" : user.role;
  if (account.role !== role || (user.userSessionVersion ?? 0) !== account.sessionVersion) return false;
  // A local credential exemption can never be used by a linked Platform user.
  return user.credentialSource !== "local" || account.platformUserId === null;
}
