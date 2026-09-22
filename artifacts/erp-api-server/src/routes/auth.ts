import { Router } from "express";
import bcrypt from "bcryptjs";
import { eq, and, sql } from "drizzle-orm";
import { randomBytes, createHash } from "crypto";
import { db, runWithTenantDatabase, schema } from "../lib/db";
import { signToken, authenticate, normalizeEmail, isEmailUniqueViolation, verifyPlatformSsoToken, type AuthRequest } from "../lib/auth";
import { listUserStores } from "../lib/store-context";
import { sendPasswordResetEmail } from "../lib/email";
import {
  getRequestTenantHostname,
  isConfiguredTenantHostname,
  resolvePlatformTenantDomain,
  resolvePlatformTenantDatabase,
  tenantStoreMatches,
  verifyTenantDomainRequest,
} from "../lib/tenant-domain";

const router = Router();

type PlatformCredentials = {
  id: number;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  companyName: string | null;
  phone: string | null;
  address: string | null;
  role: string;
  isActive: boolean;
};

async function getPlatformCredentials(userId: number): Promise<PlatformCredentials> {
  const baseUrl = process.env["PLATFORM_API_URL"]?.replace(/\/+$/, "");
  const secret = process.env["PLATFORM_SERVICE_SECRET"] ??
    process.env["PLATFORM_SSO_SECRET"] ??
    process.env["SESSION_SECRET"];
  if (!baseUrl || !secret) throw new Error("Platform credential sync is not configured");
  const response = await fetch(`${baseUrl}/api/internal/erp/credentials/${userId}`, {
    headers: { "X-Platform-Service-Secret": secret },
  });
  if (!response.ok) throw new Error(`Platform credential lookup failed (${response.status})`);
  return await response.json() as PlatformCredentials;
}

async function updatePlatformPassword(userId: number, newPassword: string): Promise<void> {
  const baseUrl = process.env["PLATFORM_API_URL"]?.replace(/\/+$/, "");
  const secret = process.env["PLATFORM_SERVICE_SECRET"] ??
    process.env["PLATFORM_SSO_SECRET"] ??
    process.env["SESSION_SECRET"];
  if (!baseUrl || !secret) throw new Error("Platform credential sync is not configured");

  const response = await fetch(`${baseUrl}/api/internal/erp/credentials/${userId}/password`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-Platform-Service-Secret": secret,
    },
    body: JSON.stringify({ newPassword }),
  });
  if (!response.ok) {
    throw new Error(`Platform password update failed (${response.status})`);
  }
}

router.post("/auth/sso/exchange", async (req, res) => {
  try {
    const rawToken = typeof req.body?.token === "string" ? req.body.token : "";
    if (!rawToken) {
      res.status(400).json({ error: "SSO token is required" });
      return;
    }
    const sso = verifyPlatformSsoToken(rawToken);
    if (!(await verifyTenantDomainRequest(req, {
      hostname: sso.hostname,
      tenantId: sso.tenantId,
      ownerUserId: sso.userId,
    }))) {
      res.status(403).json({
        error: "This SSO ticket is not valid for the current ERP domain",
        code: "TENANT_DOMAIN_MISMATCH",
      });
      return;
    }
    const tenantDatabase = await resolvePlatformTenantDatabase(sso.tenantId);
    if (!tenantDatabase && process.env["NODE_ENV"] === "production") {
      res.status(503).json({ error: "ERP tenant database is not configured", code: "TENANT_DATABASE_UNAVAILABLE" });
      return;
    }
    if (tenantDatabase?.databaseStatus === "failed") {
      res.status(503).json({ error: "ERP tenant database is unavailable", code: "TENANT_DATABASE_FAILED" });
      return;
    }
    if (tenantDatabase?.databaseStatus === "provisioning") {
      res.status(503).json({ error: "ERP tenant database is still provisioning", code: "TENANT_DATABASE_PROVISIONING" });
      return;
    }
    if (tenantDatabase && (
      tenantDatabase.databaseStatus !== "ready" || !tenantDatabase.databaseName
    )) {
      res.status(503).json({ error: "ERP tenant database is not ready", code: "TENANT_DATABASE_UNAVAILABLE" });
      return;
    }

    const exchange = async () => {
    const platformCredentials = await getPlatformCredentials(sso.userId);
    if (!platformCredentials.isActive) {
      res.status(403).json({ error: "Platform account is inactive" });
      return;
    }
    const [platformUser] = await db.select().from(schema.usersTable)
      .where(eq(schema.usersTable.platformUserId, sso.userId))
      .limit(1);
    const [emailUser] = platformUser ? [platformUser] : await db.select().from(schema.usersTable)
      .where(sql`lower(trim(${schema.usersTable.email})) = ${sso.email.toLowerCase()}`)
      .limit(1);
    // Platform only issues this ticket for the tenant owner. Inside that
    // tenant, the owner is the ERP administrator regardless of their
    // Platform-facing account role.
    const databaseRole = "admin" as const;
    let user = emailUser;
    if (!user) {
      [user] = await db.insert(schema.usersTable).values({
        platformUserId: sso.userId,
        name: `${platformCredentials.firstName} ${platformCredentials.lastName}`.trim() || "Midanic User",
        email: platformCredentials.email.toLowerCase(),
        passwordHash: platformCredentials.passwordHash,
        role: databaseRole,
        phone: platformCredentials.phone,
        address: platformCredentials.address,
      }).returning();
    } else {
      [user] = await db.update(schema.usersTable)
        .set({
          platformUserId: sso.userId,
          email: platformCredentials.email.toLowerCase(),
          passwordHash: platformCredentials.passwordHash,
          name: `${platformCredentials.firstName} ${platformCredentials.lastName}`.trim() || user.name,
          phone: platformCredentials.phone,
          address: platformCredentials.address,
          role: databaseRole,
          isActive: true,
        })
        .where(eq(schema.usersTable.id, user.id))
        .returning();
    }

    const [store] = await db.select().from(schema.storesTable)
      .where(eq(schema.storesTable.platformTenantId, sso.tenantId))
      .limit(1);
    let activeStore = store;
    if (!activeStore) {
      const [principalStore] = await db.select().from(schema.storesTable)
        .where(and(
          eq(schema.storesTable.slug, "principal"),
          sql`${schema.storesTable.platformTenantId} IS NULL`,
        ))
        .limit(1);
      if (principalStore) {
        [activeStore] = await db.update(schema.storesTable)
          .set({ platformTenantId: sso.tenantId })
          .where(eq(schema.storesTable.id, principalStore.id))
          .returning();
      } else {
        [activeStore] = await db.insert(schema.storesTable).values({
          platformTenantId: sso.tenantId,
          nameAr: "متجر الشركة",
          nameEn: "Company Store",
          slug: `tenant-${sso.tenantId}`,
        }).returning();
      }
    }
    await db.insert(schema.userStoresTable)
      .values({ userId: user.id, storeId: activeStore.id })
      .onConflictDoNothing();
    const token = signToken({
      id: user.id,
      email: user.email,
      // Keep tenant owners out of legacy global-admin routes. The database
      // role remains `admin` for the ERP UI, while the JWT role is the
      // fail-closed tenant-aware authorization boundary.
      role: "tenant_admin",
      currentStoreId: activeStore.id,
      platformUserId: sso.userId,
      platformTenantId: sso.tenantId,
      tenantHostname: sso.hostname,
    });
    res.json({
      token,
      currentStoreId: activeStore.id,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      stores: [activeStore],
    });
    };

    if (tenantDatabase?.databaseStatus === "ready" && tenantDatabase.databaseName) {
      await runWithTenantDatabase(
        { tenantId: sso.tenantId, databaseName: tenantDatabase.databaseName },
        exchange,
      );
    } else {
      await exchange();
    }
  } catch (err) {
    req.log.error(err);
    res.status(401).json({ error: "Invalid or expired Platform SSO token" });
  }
});

router.post("/auth/register", async (req, res) => {
  try {
    const { name, email: rawEmail, password, preferredLang } = req.body;
    if (!name || !rawEmail || !password) {
      res.status(400).json({ error: "name, email, password required" });
      return;
    }
    const email = normalizeEmail(rawEmail);
    const existing = await db.select().from(schema.usersTable)
      .where(sql`lower(trim(${schema.usersTable.email})) = ${email}`).limit(1);
    if (existing.length > 0) {
      res.status(409).json({ error: "Email already registered" });
      return;
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const [user] = await db.insert(schema.usersTable).values({
      name, email, passwordHash,
      preferredLang: preferredLang || "ar",
    }).returning();
    const token = signToken({ id: user.id, email: user.email, role: user.role });
    res.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role }, stores: [] });
  } catch (err) {
    if (isEmailUniqueViolation(err)) { res.status(409).json({ error: "Email already registered" }); return; }
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/auth/login", async (req, res) => {
  try {
    const { email: rawEmail, password } = req.body;
    if (!rawEmail || !password) {
      res.status(400).json({ error: "email and password required" });
      return;
    }
    const hostname = getRequestTenantHostname(req);
    const isTenantDomain = isConfiguredTenantHostname(hostname);
    const tenantDomain = isTenantDomain && hostname
      ? await resolvePlatformTenantDomain(hostname)
      : null;

    if (isTenantDomain && tenantDomain?.canAccess !== true) {
      res.status(403).json({
        error: "This ERP company domain is inactive or unknown",
        code: "TENANT_DOMAIN_INACTIVE",
      });
      return;
    }
    if (process.env["NODE_ENV"] === "production" && !tenantDomain) {
      res.status(403).json({
        error: "Direct ERP login must use an active company domain",
        code: "TENANT_DOMAIN_REQUIRED",
      });
      return;
    }

    const login = async () => {
      // Mobile keyboards auto-capitalize and add stray spaces — match case-insensitively.
      const email = String(rawEmail).trim().toLowerCase();

      // The tenant owner authenticates against the Platform account first.
      // This also repairs a tenant database where the owner has not yet been
      // provisioned by SSO (or still carries an older password hash).
      if (tenantDomain) {
        try {
          const platformCredentials = await getPlatformCredentials(tenantDomain.ownerUserId);
          const isPlatformOwner =
            platformCredentials.isActive &&
            platformCredentials.email.trim().toLowerCase() === email &&
            await bcrypt.compare(password, platformCredentials.passwordHash);

          if (isPlatformOwner) {
            const [platformUser] = await db.select().from(schema.usersTable)
              .where(eq(schema.usersTable.platformUserId, tenantDomain.ownerUserId))
              .limit(1);
            const [emailUser] = platformUser ? [platformUser] : await db.select().from(schema.usersTable)
              .where(sql`lower(trim(${schema.usersTable.email})) = ${email}`)
              .limit(1);

            let owner = emailUser;
            if (!owner) {
              [owner] = await db.insert(schema.usersTable).values({
                platformUserId: tenantDomain.ownerUserId,
                name: `${platformCredentials.firstName} ${platformCredentials.lastName}`.trim() || "Midanic User",
                email: platformCredentials.email.toLowerCase(),
                passwordHash: platformCredentials.passwordHash,
                role: "admin",
                phone: platformCredentials.phone,
                address: platformCredentials.address,
              }).returning();
            } else {
              [owner] = await db.update(schema.usersTable)
                .set({
                  platformUserId: tenantDomain.ownerUserId,
                  name: `${platformCredentials.firstName} ${platformCredentials.lastName}`.trim() || owner.name,
                  email: platformCredentials.email.toLowerCase(),
                  passwordHash: platformCredentials.passwordHash,
                  role: "admin",
                  phone: platformCredentials.phone,
                  address: platformCredentials.address,
                  isActive: true,
                })
                .where(eq(schema.usersTable.id, owner.id))
                .returning();
            }

            const [store] = await db.select().from(schema.storesTable)
              .where(eq(schema.storesTable.platformTenantId, tenantDomain.tenantId))
              .limit(1);
            if (!store) {
              res.status(503).json({
                error: "ERP tenant store is unavailable",
                code: "TENANT_STORE_UNAVAILABLE",
              });
              return;
            }

            await db.insert(schema.userStoresTable)
              .values({ userId: owner.id, storeId: store.id })
              .onConflictDoNothing();

            const token = signToken({
              id: owner.id,
              email: owner.email,
              role: "tenant_admin",
              currentStoreId: store.id,
              platformUserId: tenantDomain.ownerUserId,
              platformTenantId: tenantDomain.tenantId,
              tenantHostname: tenantDomain.hostname,
            });
            res.json({
              token,
              user: {
                id: owner.id,
                name: owner.name,
                email: owner.email,
                role: owner.role,
                preferredLang: owner.preferredLang,
              },
              stores: [store],
              currentStoreId: store.id,
            });
            return;
          }
        } catch (syncError) {
          req.log.warn({ err: syncError }, "Platform owner authentication unavailable during ERP login");
        }
      }

      const [user] = await db.select().from(schema.usersTable)
        .where(sql`lower(trim(${schema.usersTable.email})) = ${email}`).limit(1);
      if (!user) { res.status(401).json({ error: "Invalid credentials" }); return; }
      let valid = false;
      if (user.platformUserId) {
        try {
          const platformCredentials = await getPlatformCredentials(user.platformUserId);
          valid = platformCredentials.isActive && await bcrypt.compare(password, platformCredentials.passwordHash);
          if (valid) {
            await db.update(schema.usersTable).set({
              email: platformCredentials.email.toLowerCase(),
              passwordHash: platformCredentials.passwordHash,
              name: `${platformCredentials.firstName} ${platformCredentials.lastName}`.trim() || user.name,
              phone: platformCredentials.phone,
              address: platformCredentials.address,
            }).where(eq(schema.usersTable.id, user.id));
          }
        } catch (syncError) {
          req.log.warn({ err: syncError }, "Platform credential sync unavailable during ERP login");
        }
      } else {
        valid = await bcrypt.compare(password, user.passwordHash);
      }
      if (!valid) { res.status(401).json({ error: "Invalid credentials" }); return; }
      if (!user.isActive) { res.status(403).json({ error: "Account disabled" }); return; }

      const allStores = (user.role === "admin" || user.role === "employee")
        ? await listUserStores(user.id, tenantDomain?.tenantId)
        : [];
      const stores = allStores.filter((s) => s.isActive);
      const currentStoreId = stores.length === 1 ? stores[0].id : null;
      const token = signToken({
        id: user.id,
        email: user.email,
        role: user.role === "admin" && tenantDomain ? "tenant_admin" : user.role,
        currentStoreId,
        ...(tenantDomain
          ? {
              platformUserId: tenantDomain.ownerUserId,
              platformTenantId: tenantDomain.tenantId,
              tenantHostname: tenantDomain.hostname,
            }
          : {}),
      });

      res.json({
        token,
        user: { id: user.id, name: user.name, email: user.email, role: user.role, preferredLang: user.preferredLang },
        stores,
        currentStoreId,
      });
    };

    if (tenantDomain) {
      const tenantDatabase = await resolvePlatformTenantDatabase(tenantDomain.tenantId);
      if (
        !tenantDatabase ||
        tenantDatabase.databaseStatus !== "ready" ||
        !tenantDatabase.databaseName
      ) {
        res.status(503).json({
          error: "ERP tenant database is unavailable",
          code: "TENANT_DATABASE_UNAVAILABLE",
        });
        return;
      }
      await runWithTenantDatabase(
        { tenantId: tenantDomain.tenantId, databaseName: tenantDatabase.databaseName },
        login,
      );
      return;
    }

    await login();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/auth/me", authenticate, async (req: AuthRequest, res) => {
  try {
    const [user] = await db.select().from(schema.usersTable).where(eq(schema.usersTable.id, req.user!.id)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    const stores = ((user.role === "admin" || user.role === "employee")
      ? await listUserStores(user.id, req.user!.platformTenantId)
      : []).filter((s) => s.isActive);
    const tokenStoreId = req.user!.currentStoreId ?? null;
    const validCurrent = tokenStoreId != null && stores.some((s) => s.id === tokenStoreId)
      ? tokenStoreId : null;
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      preferredLang: user.preferredLang,
      phone: user.phone ?? null,
      address: user.address ?? null,
      city: user.city ?? null,
      stores,
      currentStoreId: validCurrent,
      features: req.tenantFeatures ?? {},
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/auth/me", authenticate, async (req: AuthRequest, res) => {
  try {
    const { name, phone, address, city, email } = req.body || {};
    const update: Record<string, unknown> = {};
    if (name !== undefined) update["name"] = String(name).trim() || null;
    if (phone !== undefined) update["phone"] = String(phone).trim() || null;
    if (address !== undefined) update["address"] = String(address).trim() || null;
    if (city !== undefined) update["city"] = String(city).trim() || null;
    if (email !== undefined) {
      const trimmed = normalizeEmail(email);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        res.status(400).json({ error: "Invalid email format" });
        return;
      }
      const [existing] = await db.select({ id: schema.usersTable.id })
        .from(schema.usersTable)
        .where(sql`lower(trim(${schema.usersTable.email})) = ${trimmed}`)
        .limit(1);
      if (existing && existing.id !== req.user!.id) {
        res.status(409).json({ error: "Email already in use" });
        return;
      }
      update["email"] = trimmed;
    }
    if (Object.keys(update).length === 0) {
      res.status(400).json({ error: "Nothing to update" });
      return;
    }
    const [user] = await db.update(schema.usersTable)
      .set(update)
      .where(eq(schema.usersTable.id, req.user!.id))
      .returning();
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone ?? null,
      address: user.address ?? null,
      city: user.city ?? null,
    });
  } catch (err) {
    if (isEmailUniqueViolation(err)) { res.status(409).json({ error: "Email already in use" }); return; }
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/auth/me/password", authenticate, async (req: AuthRequest, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: "currentPassword and newPassword required" });
      return;
    }
    if (String(newPassword).length < 6) {
      res.status(400).json({ error: "New password must be at least 6 characters" });
      return;
    }
    const [user] = await db.select().from(schema.usersTable).where(eq(schema.usersTable.id, req.user!.id)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    let platformCredentials: PlatformCredentials | null = null;
    if (user.platformUserId) {
      try {
        platformCredentials = await getPlatformCredentials(user.platformUserId);
      } catch (syncError) {
        req.log.error({ err: syncError }, "Platform credential lookup unavailable during password change");
        res.status(503).json({ error: "Platform password service is unavailable" });
        return;
      }
      if (!platformCredentials.isActive) {
        res.status(403).json({ error: "Platform account is inactive" });
        return;
      }
    }

    const validLocal = await bcrypt.compare(String(currentPassword), user.passwordHash);
    const validPlatform = platformCredentials
      ? await bcrypt.compare(String(currentPassword), platformCredentials.passwordHash)
      : false;
    const valid = validLocal || validPlatform;
    if (!valid) { res.status(401).json({ error: "Current password is incorrect" }); return; }
    const passwordHash = await bcrypt.hash(String(newPassword), 10);

    if (platformCredentials) {
      try {
        await updatePlatformPassword(user.platformUserId!, String(newPassword));
      } catch (syncError) {
        req.log.error({ err: syncError }, "Platform password update unavailable");
        res.status(503).json({ error: "Platform password service is unavailable" });
        return;
      }
    }

    await db.update(schema.usersTable).set({ passwordHash }).where(eq(schema.usersTable.id, req.user!.id));
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/auth/forgot-password", async (req, res) => {
  console.log("[forgot-password] 1. route entered — body:", JSON.stringify(req.body));
  try {
    const { email } = req.body || {};
    if (!email) {
      console.log("[forgot-password] 2. missing email — returning 400");
      res.status(400).json({ error: "email required" });
      return;
    }

    const normalizedEmail = normalizeEmail(email);
    console.log(`[forgot-password] 2. looking up email="${normalizedEmail}"`);

    const [user] = await db.select({ id: schema.usersTable.id, email: schema.usersTable.email })
      .from(schema.usersTable)
      .where(sql`lower(trim(${schema.usersTable.email})) = ${normalizedEmail}`)
      .limit(1);

    console.log(`[forgot-password] 3. user lookup result: ${user ? `found id=${user.id} email=${user.email}` : "NOT FOUND — skipping email"}`);

    if (user) {
      const rawToken = randomBytes(32).toString("hex");
      const tokenHash = createHash("sha256").update(rawToken).digest("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
      console.log(`[forgot-password] 4. token generated rawToken[0..8]=${rawToken.substring(0, 8)}... expiresAt=${expiresAt.toISOString()}`);

      await db.insert(schema.passwordResetTokensTable).values({
        userId: user.id,
        token: tokenHash,
        expiresAt,
      });
      console.log(`[forgot-password] 5. token saved to DB for userId=${user.id}`);

      // Must point to the web-store frontend, NOT the API server.
      // Priority: WEB_STORE_URL > FRONTEND_URL > APP_URL  (RAILWAY_PUBLIC_DOMAIN is intentionally NOT used — it is the API server's own domain, not the web store's)
      const _wsUrl    = process.env["WEB_STORE_URL"]         ?? "";
      const _feUrl    = process.env["FRONTEND_URL"]           ?? "";
      const _appUrl   = process.env["APP_URL"]                ?? "";
      const _railwayDomain = process.env["RAILWAY_PUBLIC_DOMAIN"] ?? "";

      const winner = _wsUrl ? "WEB_STORE_URL" : _feUrl ? "FRONTEND_URL" : _appUrl ? "APP_URL" : "NONE";
      const webStoreUrl = (_wsUrl || _feUrl || _appUrl).replace(/\/$/, "");

      console.log(
        `[forgot-password] ENV_DUMP ` +
        `WEB_STORE_URL="${_wsUrl}" ` +
        `FRONTEND_URL="${_feUrl}" ` +
        `APP_URL="${_appUrl}" ` +
        `RAILWAY_PUBLIC_DOMAIN="${_railwayDomain}" ` +
        `WINNER=${winner} ` +
        `resolved_base="${webStoreUrl}"`
      );

      if (!webStoreUrl) {
        console.error("[forgot-password] WARNING: no base URL configured — reset link will be broken. Set WEB_STORE_URL to the web-store public domain in Railway (e.g. https://midanic.up.railway.app).");
      }

      const resetUrl = `${webStoreUrl}/auth/reset-password/${rawToken}`;
      console.log(`[forgot-password] RESET_URL="${resetUrl}"`);

      if (process.env["NODE_ENV"] !== "production") {
        req.log.info({ resetUrl }, "[DEV] Password reset link");
      }

      console.log(`[forgot-password] 7. calling sendPasswordResetEmail to=${user.email}`);
      try {
        await sendPasswordResetEmail({ to: user.email, resetUrl });
        console.log(`[forgot-password] 8. sendPasswordResetEmail completed OK`);
        req.log.info({ userId: user.id }, "Password reset email delivered");
      } catch (emailErr: unknown) {
        const e = emailErr as Error;
        console.error(`[forgot-password] 8. sendPasswordResetEmail FAILED: ${e.message}`);
        req.log.error({ userId: user.id, err: emailErr }, "Failed to send password reset email");
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error("[forgot-password] OUTER catch:", (err as Error).message);
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/auth/reset-password/:token", async (req, res) => {
  try {
    const { token } = req.params;
    if (!token) {
      res.status(400).json({ valid: false, error: "Token is required" });
      return;
    }
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const [record] = await db.select()
      .from(schema.passwordResetTokensTable)
      .where(eq(schema.passwordResetTokensTable.token, tokenHash))
      .limit(1);

    if (!record || record.used || new Date() > record.expiresAt) {
      res.status(400).json({ valid: false, error: "Invalid or expired reset link" });
      return;
    }
    res.json({ valid: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ valid: false, error: "Internal server error" });
  }
});

router.post("/auth/reset-password/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body || {};
    if (!token) {
      res.status(400).json({ error: "Token is required" });
      return;
    }
    if (!password || String(password).length < 6) {
      res.status(400).json({ error: "Password must be at least 6 characters" });
      return;
    }

    const tokenHash = createHash("sha256").update(token).digest("hex");
    const passwordHash = await bcrypt.hash(String(password), 10);

    await db.transaction(async (tx) => {
      const [record] = await tx.select()
        .from(schema.passwordResetTokensTable)
        .where(and(
          eq(schema.passwordResetTokensTable.token, tokenHash),
          eq(schema.passwordResetTokensTable.used, false),
        ))
        .limit(1)
        .for("update");

      if (!record) {
        throw Object.assign(new Error("Invalid or expired reset link"), { statusCode: 400 });
      }
      if (new Date() > record.expiresAt) {
        throw Object.assign(new Error("This reset link has expired"), { statusCode: 400 });
      }

      await tx.update(schema.passwordResetTokensTable)
        .set({ used: true })
        .where(eq(schema.passwordResetTokensTable.id, record.id));

      await tx.update(schema.usersTable)
        .set({ passwordHash })
        .where(eq(schema.usersTable.id, record.userId));
    });

    res.json({ success: true });
  } catch (err: any) {
    if (err?.statusCode === 400) {
      res.status(400).json({ error: err.message });
      return;
    }
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/auth/select-store", authenticate, async (req: AuthRequest, res) => {
  try {
    // Any staff member (admin or employee) may switch between stores they
    // have been granted access to. Customers are excluded — verified below
    // via the user_stores membership check.
    if (req.user!.role === "customer") {
      res.status(403).json({ error: "Customers cannot select an ERP store" });
      return;
    }
    const { storeId } = req.body || {};
    if (!Number.isInteger(storeId)) {
      res.status(400).json({ error: "storeId required" });
      return;
    }
    const [link] = await db.select().from(schema.userStoresTable)
      .where(and(
        eq(schema.userStoresTable.userId, req.user!.id),
        eq(schema.userStoresTable.storeId, storeId),
      ))
      .limit(1);
    if (!link) {
      res.status(403).json({ error: "You do not have access to this store" });
      return;
    }
    const [store] = await db.select().from(schema.storesTable)
      .where(and(eq(schema.storesTable.id, storeId), eq(schema.storesTable.isActive, true)))
      .limit(1);
    if (!store) {
      res.status(404).json({ error: "Store not found or inactive" });
      return;
    }
    if (!tenantStoreMatches(req.user!.platformTenantId, store.platformTenantId)) {
      res.status(403).json({
        error: "The selected store does not belong to this ERP tenant",
        code: "TENANT_STORE_MISMATCH",
      });
      return;
    }
    const token = signToken({
      id: req.user!.id,
      email: req.user!.email,
      role: req.user!.role,
      currentStoreId: store.id,
      platformUserId: req.user!.platformUserId,
      platformTenantId: req.user!.platformTenantId,
      tenantHostname: req.user!.tenantHostname,
    });
    res.json({ token, currentStoreId: store.id, store });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
