import type { Request, Response, NextFunction } from "express";
import { eq, and, asc } from "drizzle-orm";
import { db, schema, runWithTenantDatabase } from "./db";
import type { AuthRequest } from "./auth";
import {
  getRequestTenantHostname,
  isConfiguredTenantHostname,
  resolvePlatformTenantDomain,
  tenantStoreMatches,
  resolvePlatformTenantDatabase,
} from "./tenant-domain";

/**
 * Resolve the public-storefront store from `?store=<slug>` query param or
 * `X-Store-Slug` header. Unknown or missing stores fail closed. Sets
 * `req.currentStoreId` and `req.currentStoreSlug`.
 */
export interface PublicStoreRequest extends AuthRequest {
  currentStoreSlug?: string;
}

export async function resolvePublicStore(req: PublicStoreRequest, res: Response, next: NextFunction) {
  try {
    const requestHostname = getRequestTenantHostname(req);
    const domain = isConfiguredTenantHostname(requestHostname)
      ? await resolvePlatformTenantDomain(requestHostname!)
      : null;

    if (isConfiguredTenantHostname(requestHostname) && domain?.canAccess !== true) {
      res.status(403).json({
        error: "This company Web Store domain is unknown or inactive",
        code: "TENANT_DOMAIN_UNAVAILABLE",
      });
      return;
    }

    const requestedSlug =
        (req.params["slug"] as string | undefined) ||
        (req.query["store"] as string | undefined) ||
        (req.headers["x-store-slug"] as string | undefined);

    const resolveInCurrentDatabase = async () => {
      let store: typeof schema.storesTable.$inferSelect | undefined;

      if (domain) {
        // A company hostname represents one ERP and one public store. Resolve
        // the store linked to the platform owner so anonymous Web Store
        // requests use the same store context as the owner's ERP session.
        const [ownerLink] = await db.select({ store: schema.storesTable })
          .from(schema.usersTable)
          .innerJoin(
            schema.userStoresTable,
            eq(schema.userStoresTable.userId, schema.usersTable.id),
          )
          .innerJoin(
            schema.storesTable,
            eq(schema.storesTable.id, schema.userStoresTable.storeId),
          )
          .where(and(
            eq(schema.usersTable.platformUserId, domain.ownerUserId),
            eq(schema.storesTable.platformTenantId, domain.tenantId),
            eq(schema.storesTable.isActive, true),
          ))
          .orderBy(asc(schema.userStoresTable.createdAt), asc(schema.storesTable.id))
          .limit(1);
        store = ownerLink?.store;

        // Before the owner has logged in for the first time there may be no
        // user-store link yet. The tenant store created during provisioning is
        // the canonical fallback; never choose by product count.
        if (!store) {
          [store] = await db.select().from(schema.storesTable)
            .where(and(
              eq(schema.storesTable.platformTenantId, domain.tenantId),
              eq(schema.storesTable.isActive, true),
            ))
            .orderBy(asc(schema.storesTable.id))
            .limit(1);
        }
      } else if (requestedSlug) {
        [store] = await db.select().from(schema.storesTable)
          .where(and(
            eq(schema.storesTable.slug, requestedSlug),
            eq(schema.storesTable.isActive, true),
          ))
          .limit(1);
      } else {
        [store] = await db.select().from(schema.storesTable)
          .where(eq(schema.storesTable.isActive, true))
          .orderBy(asc(schema.storesTable.id))
          .limit(1);
      }

      if (!store) {
        res.status(404).json({ error: "Store not found or inactive", code: "STORE_NOT_FOUND" });
        return;
      }

      if (domain && !tenantStoreMatches(domain.tenantId, store.platformTenantId)) {
        res.status(403).json({
          error: "This store does not belong to the current ERP company domain",
          code: "TENANT_STORE_MISMATCH",
        });
        return;
      }

      req.currentStoreId = store.id;
      req.currentStoreSlug = store.slug;
      next();
    };

    if (domain) {
      const tenantDatabase = await resolvePlatformTenantDatabase(domain.tenantId);
      if (!tenantDatabase || tenantDatabase.databaseStatus !== "ready" || !tenantDatabase.databaseName) {
        res.status(503).json({
          error: "ERP tenant database is not ready",
          code: "TENANT_DATABASE_UNAVAILABLE",
        });
        return;
      }
      await runWithTenantDatabase(
        { tenantId: domain.tenantId, databaseName: tenantDatabase.databaseName },
        resolveInCurrentDatabase,
      );
      return;
    }

    await resolveInCurrentDatabase();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * Verify the authenticated user has access to a target store id.
 * Returns true on success. On failure, writes 403 and returns false.
 */
export async function userHasStoreAccess(userId: number, storeId: number): Promise<boolean> {
  const [link] = await db.select().from(schema.userStoresTable)
    .where(and(
      eq(schema.userStoresTable.userId, userId),
      eq(schema.userStoresTable.storeId, storeId),
    ))
    .limit(1);
  return !!link;
}

export async function listUserStores(userId: number, platformTenantId?: number) {
  const rows = await db.select({
    id: schema.storesTable.id,
    nameAr: schema.storesTable.nameAr,
    nameEn: schema.storesTable.nameEn,
    slug: schema.storesTable.slug,
    isActive: schema.storesTable.isActive,
    platformTenantId: schema.storesTable.platformTenantId,
  })
    .from(schema.userStoresTable)
    .innerJoin(schema.storesTable, eq(schema.userStoresTable.storeId, schema.storesTable.id))
    .where(and(
      eq(schema.userStoresTable.userId, userId),
      platformTenantId === undefined
        ? undefined
        : eq(schema.storesTable.platformTenantId, platformTenantId),
    ))
    .orderBy(schema.storesTable.id);
  return rows;
}
