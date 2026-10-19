import { and, asc, eq, isNull } from "drizzle-orm";
import { db, schema, getTenantDatabaseContext } from "./db";
import { createTenantOwnerStoreLinks } from "./tenant-store-mapping";

export async function ensureOwnerStores(userId: number, tenantId: number) {
  return db.transaction(async tx => {
    // Legacy untagged stores may be reconciled only inside this company's
    // dedicated database. Never claim stores from the shared database.
    if (getTenantDatabaseContext()?.tenantId === tenantId) {
      await tx.update(schema.storesTable)
        .set({ platformTenantId: tenantId })
        .where(isNull(schema.storesTable.platformTenantId));
    }
    const stores = await tx.select().from(schema.storesTable)
      .where(and(eq(schema.storesTable.platformTenantId, tenantId), eq(schema.storesTable.isActive, true)))
      .orderBy(asc(schema.storesTable.id));
    if (stores.length) {
      await tx.insert(schema.userStoresTable)
        .values(createTenantOwnerStoreLinks(userId, stores.map(store => store.id)))
        .onConflictDoNothing();
    }
    return stores;
  });
}
