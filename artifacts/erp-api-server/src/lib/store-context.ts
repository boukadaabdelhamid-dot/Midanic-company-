import type { Request, Response, NextFunction } from "express";
import { eq, and } from "drizzle-orm";
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

    const resolveInCurrentDatabase = async () => {
      const slug =
        (req.params["slug"] as string | undefined) ||
        (req.query["store"] as string | undefined) ||
        (req.headers["x-store-slug"] as string | undefined) ||
        // A company Web Store represents its tenant's canonical store when
        // no explicit store selector is supplied.
        (domain ? "principal" : undefined);

      if (!slug) {
        res.status(400).json({ error: "Store slug is required", code: "STORE_CONTEXT_REQUIRED" });
        return;
      }

      const [store] = await db.select().from(schema.storesTable)
        .where(and(
          eq(schema.storesTable.slug, slug),
          eq(schema.storesTable.isActive, true),
          domain ? eq(schema.storesTable.platformTenantId, domain.tenantId) : undefined,
        ))
        .limit(1);
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
