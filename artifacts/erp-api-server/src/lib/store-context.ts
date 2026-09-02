import type { Request, Response, NextFunction } from "express";
import { eq, and } from "drizzle-orm";
import { db, schema } from "./db";
import type { AuthRequest } from "./auth";
import {
  getRequestTenantHostname,
  isConfiguredTenantHostname,
  resolvePlatformTenantDomain,
  tenantStoreMatches,
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
    const slug =
      (req.query["store"] as string | undefined) ||
      (req.headers["x-store-slug"] as string | undefined) ||
      undefined;

    if (!slug) {
      res.status(400).json({ error: "Store slug is required", code: "STORE_CONTEXT_REQUIRED" });
      return;
    }
    const [store] = await db.select().from(schema.storesTable)
      .where(and(eq(schema.storesTable.slug, slug), eq(schema.storesTable.isActive, true)))
      .limit(1);
    if (!store) {
      res.status(404).json({ error: "Store not found or inactive", code: "STORE_NOT_FOUND" });
      return;
    }
    const requestHostname = getRequestTenantHostname(req);
    if (isConfiguredTenantHostname(requestHostname)) {
      const domain = await resolvePlatformTenantDomain(requestHostname!);
      if (
        domain?.canAccess !== true ||
        !tenantStoreMatches(domain.tenantId, store.platformTenantId)
      ) {
        res.status(403).json({
          error: "This store does not belong to the current ERP company domain",
          code: "TENANT_STORE_MISMATCH",
        });
        return;
      }
    }
    if (store.platformTenantId && process.env["PLATFORM_API_URL"]) {
      const secret = process.env["PLATFORM_SERVICE_SECRET"] ??
        process.env["PLATFORM_SSO_SECRET"] ??
        process.env["SESSION_SECRET"];
      if (!secret) {
        res.status(503).json({ error: "Platform control is not configured" });
        return;
      }
      try {
        const platformUrl = process.env["PLATFORM_API_URL"]!.replace(/\/+$/, "");
        const access = await fetch(`${platformUrl}/api/internal/erp/access/tenant/${store.platformTenantId}`, {
          headers: { "X-Platform-Service-Secret": secret },
        });
        const body = await access.json() as { canAccess?: boolean };
        if (!access.ok || body.canAccess !== true) {
          res.status(403).json({ error: "This store is disabled by Platform", code: "PLATFORM_STORE_INACTIVE" });
          return;
        }
      } catch (err) {
        req.log.error(err);
        res.status(503).json({ error: "Platform control is unavailable" });
        return;
      }
    }
    req.currentStoreId = store.id;
    req.currentStoreSlug = store.slug;
    next();
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
