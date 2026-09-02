import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import { randomBytes } from "crypto";
import { tenantStoreMatches, verifyTenantDomainRequest, type TenantDomainRequest } from "./tenant-domain";

function resolveJwtSecret(): string {
  const envSecret = process.env["JWT_SECRET"] ?? process.env["SESSION_SECRET"];
  if (envSecret) return envSecret;
  if (process.env["NODE_ENV"] === "production") {
    throw new Error("JWT_SECRET environment variable must be set in production.");
  }
  const generated = randomBytes(32).toString("hex");
  console.warn("[auth] WARNING: JWT_SECRET not set — using a randomly generated secret. Tokens will be invalidated on restart. Set JWT_SECRET for persistence.");
  return generated;
}

const JWT_SECRET: string = resolveJwtSecret();

export type JwtPayload = {
  id: number;
  email: string;
  role: "admin" | "tenant_admin" | "employee" | "customer";
  currentStoreId?: number | null;
  platformUserId?: number;
  platformTenantId?: number;
  tenantHostname?: string;
};

export type PlatformSsoPayload = {
  userId: number;
  tenantId: number;
  email: string;
  role: string;
  hostname: string;
  aud: "erp";
  purpose: "sso";
};

export function signToken(payload: JwtPayload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "4h" });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

export function verifyPlatformSsoToken(token: string): PlatformSsoPayload {
  const secret = process.env["PLATFORM_SSO_SECRET"] ?? process.env["JWT_SECRET"] ?? process.env["SESSION_SECRET"];
  if (!secret) throw new Error("PLATFORM_SSO_SECRET must be configured for SSO.");
  const payload = jwt.verify(token, secret, { audience: "erp" }) as PlatformSsoPayload;
  if (
    payload.purpose !== "sso" ||
    !Number.isInteger(payload.userId) ||
    !Number.isInteger(payload.tenantId) ||
    typeof payload.hostname !== "string" ||
    !payload.hostname
  ) {
    throw new Error("Invalid Platform SSO payload");
  }
  return payload;
}

export interface AuthRequest extends Request {
  user?: JwtPayload;
  currentStoreId?: number;
  isPlatformService?: boolean;
}

export async function enforcePlatformAccess(req: TenantDomainRequest, user: JwtPayload): Promise<boolean> {
  if (!user.platformUserId) return process.env["NODE_ENV"] !== "production";
  if (!user.platformTenantId || !user.tenantHostname) return false;
  return verifyTenantDomainRequest(req, {
    hostname: user.tenantHostname,
    tenantId: user.platformTenantId,
    ownerUserId: user.platformUserId,
  });
}

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const serviceSecret = process.env["PLATFORM_SERVICE_SECRET"] ??
    process.env["PLATFORM_SSO_SECRET"] ??
    process.env["SESSION_SECRET"];
  if (serviceSecret && req.header("X-Platform-Service-Secret") === serviceSecret) {
    const serviceUserId = Number(req.header("X-Platform-User-Id") ?? "0");
    const storeId = Number(req.header("X-Store-Id") ?? "0");
    req.user = {
      id: serviceUserId > 0 ? serviceUserId : 0,
      email: "platform-service@midanic.internal",
      role: "admin",
      currentStoreId: storeId > 0 ? storeId : null,
    };
    if (storeId > 0) req.currentStoreId = storeId;
    req.isPlatformService = true;
    next();
    return;
  }
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const token = authHeader.slice(7);
    req.user = verifyToken(token);
    if (!(await enforcePlatformAccess(req, req.user))) {
      res.status(403).json({
        error: "ERP tenant domain is unknown, inactive, or does not match this session",
        code: "TENANT_DOMAIN_MISMATCH",
      });
      return;
    }
    if (typeof req.user.currentStoreId === "number") {
      req.currentStoreId = req.user.currentStoreId;
    }
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  // Global ERP administration is reserved for non-tenant local admins and
  // the authenticated Platform service bridge. The platformTenantId check
  // also invalidates still-unexpired legacy SSO tokens that carried `admin`.
  if (
    req.user?.role !== "admin" ||
    (req.user.platformTenantId !== undefined && req.isPlatformService !== true)
  ) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
}

export function requireStaff(req: AuthRequest, res: Response, next: NextFunction) {
  const role = req.user?.role;
  if (role !== "admin" && role !== "tenant_admin" && role !== "employee") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
}

/**
 * Tenant-aware administrative actions must opt into this middleware
 * explicitly. Legacy `requireAdmin` routes remain global-admin-only because
 * SSO tenant owners carry the distinct `tenant_admin` JWT role.
 */
export function requireTenantAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== "admin" && req.user?.role !== "tenant_admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
}

/**
 * Ensure a current store is selected AND that the authenticated user still has
 * an active membership in user_stores for that store. Re-checks the DB on each
 * request so that revoking a staff member's store access takes effect
 * immediately instead of waiting for token expiry.
 *
 * Must be placed AFTER `authenticate`.
 */
export async function requireStore(req: AuthRequest, res: Response, next: NextFunction) {
  if (typeof req.currentStoreId !== "number") {
    res.status(400).json({ error: "No store selected. Call /auth/select-store first." });
    return;
  }
  if (!req.user?.id) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const { db, schema } = await import("./db");
    const { eq, and } = await import("drizzle-orm");
    const [link] = await db.select({
      storeId: schema.userStoresTable.storeId,
      platformTenantId: schema.storesTable.platformTenantId,
    })
      .from(schema.userStoresTable)
      .innerJoin(schema.storesTable, eq(schema.userStoresTable.storeId, schema.storesTable.id))
      .where(and(
        eq(schema.userStoresTable.userId, req.user.id),
        eq(schema.userStoresTable.storeId, req.currentStoreId),
        eq(schema.storesTable.isActive, true),
      ))
      .limit(1);
    if (!link) {
      res.status(403).json({ error: "Store access revoked. Please re-select a store.", code: "STORE_ACCESS_REVOKED" });
      return;
    }
    if (!tenantStoreMatches(req.user.platformTenantId, link.platformTenantId)) {
      res.status(403).json({
        error: "The selected store does not belong to this ERP tenant",
        code: "TENANT_STORE_MISMATCH",
      });
      return;
    }
    next();
  } catch (err) {
    (req as AuthRequest & { log?: { error: (e: unknown) => void } }).log?.error?.(err);
    res.status(500).json({ error: "Internal server error" });
  }
}

export function isAdmin(req: AuthRequest): boolean {
  return req.user?.role === "admin" &&
    (req.user.platformTenantId === undefined || req.isPlatformService === true);
}

/**
 * Factory that returns an Express middleware enforcing a specific section+action permission.
 * Admins always pass. Employees must have the granted row in user_permissions.
 * Must be placed AFTER `authenticate`.
 */
export function requirePermission(section: string, action: string) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (req.user?.role === "admin" || req.user?.role === "tenant_admin") { next(); return; }
    if (!req.user?.id) { res.status(401).json({ error: "Unauthorized" }); return; }
    try {
      const { db, schema } = await import("./db");
      const { eq, and } = await import("drizzle-orm");
      const [perm] = await db
        .select({ granted: schema.userPermissionsTable.granted })
        .from(schema.userPermissionsTable)
        .where(and(
          eq(schema.userPermissionsTable.userId, req.user.id),
          eq(schema.userPermissionsTable.section, section),
          eq(schema.userPermissionsTable.action, action),
        ))
        .limit(1);
      if (!perm?.granted) {
        res.status(403).json({ error: "Forbidden: insufficient permissions" });
        return;
      }
      next();
    } catch (err) {
      (req as AuthRequest & { log?: { error: (e: unknown) => void } }).log?.error?.(err);
      res.status(500).json({ error: "Internal server error" });
    }
  };
}

// Canonical form for user-account emails: trimmed + lowercased. Every write
// and lookup against users.email must go through this so login's
// case-insensitive match can never find two candidate accounts.
export function normalizeEmail(email: unknown): string {
  return String(email ?? "").trim().toLowerCase();
}

// True when a DB error is a unique violation on a users.email constraint —
// callers should map it to 409 "Email already in use" (covers races the
// pre-checks can't).
export function isEmailUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; constraint?: string; message?: string };
  return e?.code === "23505" &&
    (e.constraint === "users_email_canonical_uq" || e.constraint === "users_email_unique" ||
     /users.*email/i.test(e.constraint ?? e.message ?? ""));
}

export async function optionalAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    try {
      req.user = verifyToken(authHeader.slice(7));
      if (!(await enforcePlatformAccess(req, req.user))) {
        res.status(403).json({
          error: "ERP tenant domain is unknown, inactive, or does not match this session",
          code: "TENANT_DOMAIN_MISMATCH",
        });
        return;
      }
      if (typeof req.user.currentStoreId === "number") {
        req.currentStoreId = req.user.currentStoreId;
      }
    } catch {
      // ignore — auth is optional
    }
  }
  next();
}

// Like optionalAuth, but if the client DID send a Bearer token that is
// invalid or expired, reject with 401 instead of silently treating the
// request as anonymous. Critical for order creation: a POS sale made with
// an expired staff token must NOT fall through as an anonymous "online"
// order (wrong channel, no seller, no caisse credit).
export async function optionalAuthStrict(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    try {
      req.user = verifyToken(authHeader.slice(7));
      if (!(await enforcePlatformAccess(req, req.user))) {
        res.status(403).json({
          error: "ERP tenant domain is unknown, inactive, or does not match this session",
          code: "TENANT_DOMAIN_MISMATCH",
        });
        return;
      }
      if (typeof req.user.currentStoreId === "number") {
        req.currentStoreId = req.user.currentStoreId;
      }
    } catch {
      res.status(401).json({ error: "Session expirée — veuillez vous reconnecter." });
      return;
    }
  }
  next();
}
