import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  usersTable,
  productsTable,
  productVersionsTable,
  downloadFilesTable,
  licensesTable,
  subscriptionsTable,
  blogPostsTable,
  newsItemsTable,
  contactMessagesTable,
  trialRequestsTable,
  demoRequestsTable,
  newsletterSubscribersTable,
  supportTicketsTable,
  ticketMessagesTable,
  customerEntitlementsTable,
  entitlementHistoryTable,
  adminSettingsTable,
  erpTenantsTable,
} from "@workspace/db";
import { eq, ne, desc, count, ilike, or, sql, and, gte, lte, lt } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth";

const router: IRouter = Router();

const ADMIN_LOCALES = ["en", "fr", "ar"] as const;
type AdminLocale = (typeof ADMIN_LOCALES)[number];
type LocalizedText = Record<AdminLocale, string>;

function parseLocalizedText(value: unknown, maxLength: number): LocalizedText | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  if (!ADMIN_LOCALES.every((locale) => typeof candidate[locale] === "string")) return null;
  const text = candidate as Record<AdminLocale, string>;
  return {
    en: text.en.trim().slice(0, maxLength),
    fr: text.fr.trim().slice(0, maxLength),
    ar: text.ar.trim().slice(0, maxLength),
  };
}

function serializeAdminSettings(settings: typeof adminSettingsTable.$inferSelect) {
  return {
    id: settings.id,
    adminName: {
      en: settings.adminNameEn,
      fr: settings.adminNameFr,
      ar: settings.adminNameAr,
    },
    pageTitle: {
      en: settings.pageTitleEn,
      fr: settings.pageTitleFr,
      ar: settings.pageTitleAr,
    },
    pageSubtitle: {
      en: settings.pageSubtitleEn,
      fr: settings.pageSubtitleFr,
      ar: settings.pageSubtitleAr,
    },
    accentColor: settings.accentColor,
    theme: settings.theme,
    sidebarStyle: settings.sidebarStyle,
    backgroundImageUrl: settings.backgroundImageUrl,
    updatedAt: settings.updatedAt,
  };
}

// All admin routes require authentication and super_admin role
router.use("/admin", requireAuth, requireRole("super_admin"));

// ── ADMIN APPEARANCE SETTINGS ──────────────────────────────────────────────
router.get("/admin/settings", async (_req, res): Promise<void> => {
  let [settings] = await db.select().from(adminSettingsTable).limit(1);
  if (!settings) {
    [settings] = await db
      .insert(adminSettingsTable)
      .values({})
      .returning();
  }
  res.json(serializeAdminSettings(settings));
});

router.patch("/admin/settings", async (req, res): Promise<void> => {
  const body = req.body as Record<string, unknown>;
  const allowedThemes = ["light", "dark"];
  const allowedSidebarStyles = ["default", "glass", "compact"];
  const updates: Partial<typeof adminSettingsTable.$inferInsert> = {};

  const adminName = parseLocalizedText(body.adminName, 80);
  const pageTitle = parseLocalizedText(body.pageTitle, 120);
  const pageSubtitle = parseLocalizedText(body.pageSubtitle, 240);
  if (adminName) {
    updates.adminNameEn = adminName.en;
    updates.adminNameFr = adminName.fr;
    updates.adminNameAr = adminName.ar;
  }
  if (pageTitle) {
    updates.pageTitleEn = pageTitle.en;
    updates.pageTitleFr = pageTitle.fr;
    updates.pageTitleAr = pageTitle.ar;
  }
  if (pageSubtitle) {
    updates.pageSubtitleEn = pageSubtitle.en;
    updates.pageSubtitleFr = pageSubtitle.fr;
    updates.pageSubtitleAr = pageSubtitle.ar;
  }
  if (typeof body.accentColor === "string" && /^#[0-9a-f]{6}$/i.test(body.accentColor)) {
    updates.accentColor = body.accentColor;
  }
  if (typeof body.theme === "string" && allowedThemes.includes(body.theme)) {
    updates.theme = body.theme;
  }
  if (typeof body.sidebarStyle === "string" && allowedSidebarStyles.includes(body.sidebarStyle)) {
    updates.sidebarStyle = body.sidebarStyle;
  }
  if (body.backgroundImageUrl === null || typeof body.backgroundImageUrl === "string") {
    updates.backgroundImageUrl = body.backgroundImageUrl;
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No valid settings were provided" });
    return;
  }

  let [existing] = await db.select().from(adminSettingsTable).limit(1);
  if (!existing) {
    [existing] = await db.insert(adminSettingsTable).values({}).returning();
  }
  const [updated] = await db
    .update(adminSettingsTable)
    .set(updates)
    .where(eq(adminSettingsTable.id, existing.id))
    .returning();
  res.json(serializeAdminSettings(updated));
});

// ── ERP TENANT CONTROL ──────────────────────────────────────────────────────
router.get("/admin/erp/tenants", async (req, res): Promise<void> => {
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const conditions = status
    ? eq(erpTenantsTable.status, status)
    : undefined;

  const tenants = await db
    .select({
      id: erpTenantsTable.id,
      ownerUserId: erpTenantsTable.ownerUserId,
      companyName: erpTenantsTable.companyName,
      status: erpTenantsTable.status,
      trialStartedAt: erpTenantsTable.trialStartedAt,
      trialEndsAt: erpTenantsTable.trialEndsAt,
      approvedAt: erpTenantsTable.approvedAt,
      suspendedAt: erpTenantsTable.suspendedAt,
      notes: erpTenantsTable.notes,
      createdAt: erpTenantsTable.createdAt,
      ownerEmail: usersTable.email,
      ownerFirstName: usersTable.firstName,
      ownerLastName: usersTable.lastName,
    })
    .from(erpTenantsTable)
    .leftJoin(usersTable, eq(erpTenantsTable.ownerUserId, usersTable.id))
    .where(conditions)
    .orderBy(desc(erpTenantsTable.createdAt));

  res.json({ tenants });
});

router.post("/admin/erp/tenants", async (req, res): Promise<void> => {
  const body = req.body as Record<string, unknown>;
  const ownerUserId = Number(body.ownerUserId);
  const companyName = typeof body.companyName === "string" ? body.companyName.trim() : "";

  if (!Number.isInteger(ownerUserId) || ownerUserId <= 0 || !companyName) {
    res.status(400).json({ error: "ownerUserId and companyName are required" });
    return;
  }

  const [owner] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.id, ownerUserId))
    .limit(1);
  if (!owner) {
    res.status(404).json({ error: "Owner user not found" });
    return;
  }

  const [tenant] = await db
    .insert(erpTenantsTable)
    .values({ ownerUserId, companyName, status: "pending" })
    .returning();
  res.status(201).json(tenant);
});

router.patch("/admin/erp/tenants/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const body = req.body as Record<string, unknown>;
  const status = typeof body.status === "string" ? body.status : undefined;
  const allowedStatuses = ["pending", "active", "suspended", "expired", "converted"];

  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid tenant id" });
    return;
  }
  if (status && !allowedStatuses.includes(status)) {
    res.status(400).json({ error: "Invalid ERP tenant status" });
    return;
  }

  const updates: Partial<typeof erpTenantsTable.$inferInsert> = {};
  if (status) {
    updates.status = status;
    if (status === "active" || status === "converted") {
      updates.approvedAt = new Date();
      updates.suspendedAt = null;
    } else if (status === "suspended") {
      updates.suspendedAt = new Date();
    }
  }
  if (typeof body.companyName === "string" && body.companyName.trim()) {
    updates.companyName = body.companyName.trim();
  }
  if (body.notes === null || typeof body.notes === "string") {
    updates.notes = body.notes === null ? null : body.notes.trim().slice(0, 2000);
  }
  if (body.trialEndsAt === null) {
    updates.trialEndsAt = null;
  } else if (typeof body.trialEndsAt === "string") {
    const trialEndsAt = new Date(body.trialEndsAt);
    if (Number.isNaN(trialEndsAt.getTime())) {
      res.status(400).json({ error: "Invalid trialEndsAt" });
      return;
    }
    updates.trialEndsAt = trialEndsAt;
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No valid updates were provided" });
    return;
  }

  const [tenant] = await db
    .update(erpTenantsTable)
    .set(updates)
    .where(eq(erpTenantsTable.id, id))
    .returning();
  if (!tenant) {
    res.status(404).json({ error: "ERP tenant not found" });
    return;
  }
  res.json(tenant);
});

// ── ADMIN STATS ────────────────────────────────────────────────────────────
router.get("/admin/stats", async (_req, res): Promise<void> => {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 86_400_000);
  const in14Days = new Date(now.getTime() + 14 * 86_400_000);
  const in30Days = new Date(now.getTime() + 30 * 86_400_000);

  const [
    [usersRow],
    [productsRow],
    [licensesRow],
    [ticketsRow],
    [newThisMonthRow],
    [expiringIn30Row],
    [expiringTodayRow],
    recentLicenses,
    expiringIn14Days,
    byProduct,
  ] = await Promise.all([
    db.select({ total: count() }).from(usersTable),
    db.select({ total: count() }).from(productsTable),
    db.select({ total: count() }).from(licensesTable).where(eq(licensesTable.status, "active")),
    db
      .select({ total: count() })
      .from(supportTicketsTable)
      .where(sql`${supportTicketsTable.status} IN ('open','in_progress')`),
    // New licenses this month
    db
      .select({ total: count() })
      .from(licensesTable)
      .where(gte(licensesTable.createdAt, monthStart)),
    // Active licenses expiring in next 30 days
    db
      .select({ total: count() })
      .from(licensesTable)
      .where(
        and(
          eq(licensesTable.status, "active"),
          gte(licensesTable.expiresAt, now),
          lte(licensesTable.expiresAt, in30Days)
        )
      ),
    // Active licenses expiring today
    db
      .select({ total: count() })
      .from(licensesTable)
      .where(
        and(
          eq(licensesTable.status, "active"),
          gte(licensesTable.expiresAt, todayStart),
          lt(licensesTable.expiresAt, todayEnd)
        )
      ),
    // Recent 10 licenses
    db
      .select({
        id: licensesTable.id,
        licenseKey: licensesTable.key,
        type: licensesTable.type,
        status: licensesTable.status,
        createdAt: licensesTable.createdAt,
        expiresAt: licensesTable.expiresAt,
        userEmail: usersTable.email,
        userFirstName: usersTable.firstName,
        userLastName: usersTable.lastName,
        productName: productsTable.name,
      })
      .from(licensesTable)
      .leftJoin(usersTable, eq(licensesTable.userId, usersTable.id))
      .leftJoin(productsTable, eq(licensesTable.productId, productsTable.id))
      .orderBy(desc(licensesTable.createdAt))
      .limit(10),
    // Licenses expiring in next 14 days
    db
      .select({
        id: licensesTable.id,
        licenseKey: licensesTable.key,
        type: licensesTable.type,
        expiresAt: licensesTable.expiresAt,
        userEmail: usersTable.email,
        userFirstName: usersTable.firstName,
        productName: productsTable.name,
      })
      .from(licensesTable)
      .leftJoin(usersTable, eq(licensesTable.userId, usersTable.id))
      .leftJoin(productsTable, eq(licensesTable.productId, productsTable.id))
      .where(
        and(
          eq(licensesTable.status, "active"),
          gte(licensesTable.expiresAt, now),
          lte(licensesTable.expiresAt, in14Days)
        )
      )
      .orderBy(licensesTable.expiresAt)
      .limit(20),
    // License count by product
    db
      .select({
        productName: productsTable.name,
        count: count(),
      })
      .from(licensesTable)
      .leftJoin(productsTable, eq(licensesTable.productId, productsTable.id))
      .where(eq(licensesTable.status, "active"))
      .groupBy(productsTable.name),
  ]);

  res.json({
    totalUsers: Number(usersRow?.total ?? 0),
    totalProducts: Number(productsRow?.total ?? 0),
    activeLicenses: Number(licensesRow?.total ?? 0),
    openTickets: Number(ticketsRow?.total ?? 0),
    newThisMonth: Number(newThisMonthRow?.total ?? 0),
    expiringIn30Days: Number(expiringIn30Row?.total ?? 0),
    expiringToday: Number(expiringTodayRow?.total ?? 0),
    recentLicenses,
    expiringIn14Days,
    byProduct: byProduct.map((r) => ({
      productName: r.productName ?? "Unknown",
      count: Number(r.count),
    })),
  });
});

router.get("/admin/stats/monthly-licenses", async (_req, res): Promise<void> => {
  // Generate last 6 months as labels
  const months: { label: string; start: Date; end: Date }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    months.push({
      label: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      start,
      end,
    });
  }

  const counts = await Promise.all(
    months.map(({ start, end }) =>
      db
        .select({ total: count() })
        .from(licensesTable)
        .where(and(gte(licensesTable.createdAt, start), lt(licensesTable.createdAt, end)))
        .then(([row]) => Number(row?.total ?? 0))
    )
  );

  res.json({
    data: months.map(({ label }, i) => ({ month: label, count: counts[i] })),
  });
});

// ── USERS ──────────────────────────────────────────────────────────────────
router.get("/admin/users", async (req, res): Promise<void> => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 20);
  const search = typeof req.query.search === "string" ? req.query.search : undefined;
  const offset = (page - 1) * limit;

  const conditions = search
    ? [
        or(
          ilike(usersTable.email, `%${search}%`),
          ilike(usersTable.firstName, `%${search}%`),
          ilike(usersTable.lastName, `%${search}%`),
        ),
      ]
    : [];

  const [users, [totalRow]] = await Promise.all([
    db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
        role: usersTable.role,
        language: usersTable.language,
        companyName: usersTable.companyName,
        isActive: usersTable.isActive,
        createdAt: usersTable.createdAt,
      })
      .from(usersTable)
      .where(conditions.length ? conditions[0] : undefined)
      .orderBy(desc(usersTable.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ total: count() })
      .from(usersTable)
      .where(conditions.length ? conditions[0] : undefined),
  ]);

  res.json({ users, total: Number(totalRow?.total ?? 0), page, limit });
});

router.patch("/admin/users/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }
  const { role, isActive } = req.body as { role?: string; isActive?: boolean };
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (role !== undefined) updates.role = role;
  if (isActive !== undefined) updates.isActive = isActive;

  const [updated] = await db
    .update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, id))
    .returning({ id: usersTable.id, role: usersTable.role, isActive: usersTable.isActive });

  if (!updated) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(updated);
});

// ── CUSTOMER ENTITLEMENTS ──────────────────────────────────────────────────
router.get("/admin/customers/:id/entitlements", async (req, res): Promise<void> => {
  const userId = Number(req.params.id);
  if (isNaN(userId)) { res.status(400).json({ error: "Invalid user id" }); return; }

  const [user] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const [ent] = await db
    .select()
    .from(customerEntitlementsTable)
    .where(eq(customerEntitlementsTable.userId, userId));

  // Return defaults (all null = unlimited) if no row exists yet
  const entitlements = ent ?? {
    userId,
    maxStores: null,
    maxUsers: null,
    storageGb: null,
    updatedAt: null,
    updatedBy: null,
  };

  // Fetch change history
  const history = await db
    .select({
      id: entitlementHistoryTable.id,
      oldValues: entitlementHistoryTable.oldValues,
      newValues: entitlementHistoryTable.newValues,
      createdAt: entitlementHistoryTable.createdAt,
      changedByEmail: usersTable.email,
      changedByName: usersTable.firstName,
    })
    .from(entitlementHistoryTable)
    .leftJoin(usersTable, eq(entitlementHistoryTable.changedBy, usersTable.id))
    .where(eq(entitlementHistoryTable.userId, userId))
    .orderBy(desc(entitlementHistoryTable.createdAt))
    .limit(20);

  res.json({ entitlements, history });
});

router.patch("/admin/customers/:id/entitlements", async (req, res): Promise<void> => {
  const userId = Number(req.params.id);
  if (isNaN(userId)) { res.status(400).json({ error: "Invalid user id" }); return; }

  const adminId = req.user!.userId;
  const { maxStores, maxUsers, storageGb } = req.body as {
    maxStores?: number | null;
    maxUsers?: number | null;
    storageGb?: number | null;
  };

  const [user] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  // Get current entitlements for history
  const [current] = await db
    .select()
    .from(customerEntitlementsTable)
    .where(eq(customerEntitlementsTable.userId, userId));

  const oldValues = current
    ? { maxStores: current.maxStores, maxUsers: current.maxUsers, storageGb: current.storageGb }
    : null;

  const newValues = {
    maxStores: maxStores !== undefined ? maxStores : (current?.maxStores ?? null),
    maxUsers: maxUsers !== undefined ? maxUsers : (current?.maxUsers ?? null),
    storageGb: storageGb !== undefined ? storageGb : (current?.storageGb ?? null),
  };

  // Upsert entitlements
  const [upserted] = await db
    .insert(customerEntitlementsTable)
    .values({ userId, ...newValues, updatedBy: adminId, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: customerEntitlementsTable.userId,
      set: { ...newValues, updatedBy: adminId, updatedAt: new Date() },
    })
    .returning();

  // Record history
  await db.insert(entitlementHistoryTable).values({
    userId,
    changedBy: adminId,
    oldValues,
    newValues,
  });

  res.json(upserted);
});

// ── PRODUCTS ───────────────────────────────────────────────────────────────
router.get("/admin/products", async (_req, res): Promise<void> => {
  const products = await db
    .select()
    .from(productsTable)
    .orderBy(productsTable.sortOrder, desc(productsTable.createdAt));
  res.json(products);
});

router.post("/admin/products", async (req, res): Promise<void> => {
  const {
    name,
    slug,
    description,
    shortDescription,
    category,
    imageUrl,
    videoUrl,
    defaultLicenseType,
    featured,
    published,
    trialDays,
    basePrice,
    sortOrder,
  } = req.body as Record<string, unknown>;

  if (!name || !slug || !description || !category) {
    res.status(400).json({ error: "name, slug, description and category are required" });
    return;
  }
  const [product] = await db
    .insert(productsTable)
    .values({
      name: String(name),
      slug: String(slug),
      description: String(description),
      shortDescription: shortDescription ? String(shortDescription) : null,
      category: String(category),
      imageUrl: imageUrl ? String(imageUrl) : null,
      videoUrl: videoUrl ? String(videoUrl) : null,
      defaultLicenseType: defaultLicenseType ? String(defaultLicenseType) : null,
      featured: Boolean(featured ?? false),
      published: Boolean(published ?? false),
      trialDays: trialDays ? Number(trialDays) : null,
      basePrice: basePrice ? Number(basePrice) : null,
      sortOrder: sortOrder ? Number(sortOrder) : 0,
    })
    .returning();
  res.status(201).json(product);
});

router.patch("/admin/products/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid product id" });
    return;
  }
  const allowed = [
    "name", "slug", "description", "shortDescription", "category",
    "imageUrl", "videoUrl", "defaultLicenseType",
    "featured", "published", "trialDays", "basePrice", "sortOrder",
  ];
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  for (const key of allowed) {
    if (key in req.body) updates[key] = req.body[key];
  }

  const [product] = await db
    .update(productsTable)
    .set(updates)
    .where(eq(productsTable.id, id))
    .returning();

  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  res.json(product);
});

router.delete("/admin/products/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid product id" });
    return;
  }
  await db.delete(productsTable).where(eq(productsTable.id, id));
  res.status(204).end();
});

// ── PRODUCT VERSIONS ───────────────────────────────────────────────────────
router.get("/admin/products/:productId/versions", async (req, res): Promise<void> => {
  const productId = Number(req.params.productId);
  if (isNaN(productId)) { res.status(400).json({ error: "Invalid product id" }); return; }
  const versions = await db
    .select()
    .from(productVersionsTable)
    .where(eq(productVersionsTable.productId, productId))
    .orderBy(desc(productVersionsTable.releasedAt));
  res.json(versions);
});

router.post("/admin/products/:productId/versions", async (req, res): Promise<void> => {
  const productId = Number(req.params.productId);
  if (isNaN(productId)) { res.status(400).json({ error: "Invalid product id" }); return; }
  const { version, releaseNotes, isLatest, releasedAt } = req.body as Record<string, unknown>;
  if (!version) { res.status(400).json({ error: "version is required" }); return; }

  // If this version is set as latest, clear existing latest flag
  if (isLatest) {
    await db
      .update(productVersionsTable)
      .set({ isLatest: false })
      .where(eq(productVersionsTable.productId, productId));
  }

  const [created] = await db
    .insert(productVersionsTable)
    .values({
      productId,
      version: String(version),
      releaseNotes: releaseNotes ? String(releaseNotes) : null,
      isLatest: Boolean(isLatest ?? false),
      releasedAt: releasedAt ? new Date(String(releasedAt)) : new Date(),
    })
    .returning();
  res.status(201).json(created);
});

router.patch("/admin/products/:productId/versions/:versionId", async (req, res): Promise<void> => {
  const productId = Number(req.params.productId);
  const versionId = Number(req.params.versionId);
  if (isNaN(productId) || isNaN(versionId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const updates: Record<string, unknown> = {};
  if ("version" in req.body) updates.version = String(req.body.version);
  if ("releaseNotes" in req.body) updates.releaseNotes = req.body.releaseNotes ? String(req.body.releaseNotes) : null;
  if ("releasedAt" in req.body) updates.releasedAt = new Date(String(req.body.releasedAt));

  // When promoting to latest: clear other flags within the same product atomically,
  // then set the flag only on the record that belongs to this product.
  if ("isLatest" in req.body && Boolean(req.body.isLatest)) {
    await db
      .update(productVersionsTable)
      .set({ isLatest: false })
      .where(and(
        eq(productVersionsTable.productId, productId),
        ne(productVersionsTable.id, versionId),
      ));
    updates.isLatest = true;
  } else if ("isLatest" in req.body) {
    updates.isLatest = Boolean(req.body.isLatest);
  }

  // Scope update to both id AND productId to prevent cross-product mutation
  const [updated] = await db
    .update(productVersionsTable)
    .set(updates)
    .where(and(eq(productVersionsTable.id, versionId), eq(productVersionsTable.productId, productId)))
    .returning();
  if (!updated) { res.status(404).json({ error: "Version not found" }); return; }
  res.json(updated);
});

router.delete("/admin/products/:productId/versions/:versionId", async (req, res): Promise<void> => {
  const productId = Number(req.params.productId);
  const versionId = Number(req.params.versionId);
  if (isNaN(productId) || isNaN(versionId)) { res.status(400).json({ error: "Invalid id" }); return; }
  // Scope delete to productId to prevent cross-product deletion
  await db.delete(productVersionsTable).where(
    and(eq(productVersionsTable.id, versionId), eq(productVersionsTable.productId, productId))
  );
  res.status(204).end();
});

router.post("/admin/products/:productId/versions/:versionId/set-latest", async (req, res): Promise<void> => {
  const productId = Number(req.params.productId);
  const versionId = Number(req.params.versionId);
  if (isNaN(productId) || isNaN(versionId)) { res.status(400).json({ error: "Invalid id" }); return; }

  // Verify the version actually belongs to this product before proceeding
  const [target] = await db
    .select({ id: productVersionsTable.id })
    .from(productVersionsTable)
    .where(and(eq(productVersionsTable.id, versionId), eq(productVersionsTable.productId, productId)));
  if (!target) { res.status(404).json({ error: "Version not found" }); return; }

  // Clear all latest flags for this product, then mark only the verified version
  await db
    .update(productVersionsTable)
    .set({ isLatest: false })
    .where(eq(productVersionsTable.productId, productId));
  const [updated] = await db
    .update(productVersionsTable)
    .set({ isLatest: true })
    .where(and(eq(productVersionsTable.id, versionId), eq(productVersionsTable.productId, productId)))
    .returning();
  res.json(updated);
});

// ── PRODUCT DOWNLOADS ──────────────────────────────────────────────────────
router.get("/admin/products/:productId/downloads", async (req, res): Promise<void> => {
  const productId = Number(req.params.productId);
  if (isNaN(productId)) { res.status(400).json({ error: "Invalid product id" }); return; }
  const files = await db
    .select()
    .from(downloadFilesTable)
    .where(eq(downloadFilesTable.productId, productId))
    .orderBy(desc(downloadFilesTable.createdAt));
  res.json(files);
});

router.post("/admin/products/:productId/downloads", async (req, res): Promise<void> => {
  const productId = Number(req.params.productId);
  if (isNaN(productId)) { res.status(400).json({ error: "Invalid product id" }); return; }
  const { fileName, fileSize, platform, version, downloadUrl, versionId, isPublic } = req.body as Record<string, unknown>;
  if (!fileName || !downloadUrl || !platform) {
    res.status(400).json({ error: "fileName, downloadUrl and platform are required" });
    return;
  }
  // Validate versionId belongs to this product (same check as PATCH)
  let resolvedVersionId: number | null = null;
  if (versionId != null) {
    const vid = Number(versionId);
    const [ver] = await db
      .select({ id: productVersionsTable.id })
      .from(productVersionsTable)
      .where(and(eq(productVersionsTable.id, vid), eq(productVersionsTable.productId, productId)));
    if (!ver) { res.status(400).json({ error: "versionId does not belong to this product" }); return; }
    resolvedVersionId = vid;
  }

  const [created] = await db
    .insert(downloadFilesTable)
    .values({
      productId,
      fileName: String(fileName),
      fileSize: fileSize ? Number(fileSize) : 0,
      platform: String(platform),
      version: version ? String(version) : null,
      downloadUrl: String(downloadUrl),
      versionId: resolvedVersionId,
      isPublic: Boolean(isPublic ?? true),
    })
    .returning();
  res.status(201).json(created);
});

router.patch("/admin/products/:productId/downloads/:fileId", async (req, res): Promise<void> => {
  const productId = Number(req.params.productId);
  const fileId = Number(req.params.fileId);
  if (isNaN(productId) || isNaN(fileId)) { res.status(400).json({ error: "Invalid id" }); return; }
  const allowed = ["fileName", "fileSize", "platform", "version", "downloadUrl", "isPublic"];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in req.body) updates[key] = req.body[key];
  }
  // Validate versionId belongs to the same product before accepting it
  if ("versionId" in req.body && req.body.versionId != null) {
    const vid = Number(req.body.versionId);
    const [ver] = await db
      .select({ id: productVersionsTable.id })
      .from(productVersionsTable)
      .where(and(eq(productVersionsTable.id, vid), eq(productVersionsTable.productId, productId)));
    if (!ver) { res.status(400).json({ error: "versionId does not belong to this product" }); return; }
    updates.versionId = vid;
  } else if ("versionId" in req.body) {
    updates.versionId = null;
  }
  // Scope update to both fileId AND productId
  const [updated] = await db
    .update(downloadFilesTable)
    .set(updates)
    .where(and(eq(downloadFilesTable.id, fileId), eq(downloadFilesTable.productId, productId)))
    .returning();
  if (!updated) { res.status(404).json({ error: "Download file not found" }); return; }
  res.json(updated);
});

router.delete("/admin/products/:productId/downloads/:fileId", async (req, res): Promise<void> => {
  const productId = Number(req.params.productId);
  const fileId = Number(req.params.fileId);
  if (isNaN(productId) || isNaN(fileId)) { res.status(400).json({ error: "Invalid id" }); return; }
  // Scope delete to productId to prevent cross-product deletion
  await db.delete(downloadFilesTable).where(
    and(eq(downloadFilesTable.id, fileId), eq(downloadFilesTable.productId, productId))
  );
  res.status(204).end();
});

// ── LICENSES & SUBSCRIPTIONS ───────────────────────────────────────────────

/** Compute expiry date from license type. Returns null for lifetime licenses. */
function computeExpiresAt(type: string): Date | null {
  const daysMap: Record<string, number | null> = {
    trial: 14,
    monthly: 30,
    quarterly: 90,
    semi_annual: 180,
    yearly: 365,
    lifetime: null,
  };
  const days = daysMap[type];
  if (days === null || days === undefined) return null;
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

/** Generate a license key in the format XXXX-XXXX-XXXX-XXXX */
function generateLicenseKey(): string {
  const seg = () =>
    Math.random().toString(36).toUpperCase().slice(2, 6).padEnd(4, "0");
  return `${seg()}-${seg()}-${seg()}-${seg()}`;
}

router.post("/admin/licenses", async (req, res): Promise<void> => {
  const { userId, productId, type, maxDevices, notes } = req.body as {
    userId?: number;
    productId: number;
    type: string;
    maxDevices?: number;
    notes?: string;
  };

  if (!productId || !type) {
    res.status(400).json({ error: "productId and type are required" });
    return;
  }

  const validTypes = ["trial", "monthly", "quarterly", "semi_annual", "yearly", "lifetime"];
  if (!validTypes.includes(type)) {
    res.status(400).json({ error: `type must be one of: ${validTypes.join(", ")}` });
    return;
  }

  // Verify product exists
  const [product] = await db.select({ id: productsTable.id }).from(productsTable).where(eq(productsTable.id, productId));
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  // Verify user exists (if provided)
  if (userId) {
    const [user] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, userId));
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
  }

  const key = generateLicenseKey();
  const expiresAt = computeExpiresAt(type);

  const [license] = await db
    .insert(licensesTable)
    .values({
      key,
      userId: userId ?? null,
      productId,
      type: type as "trial" | "monthly" | "quarterly" | "semi_annual" | "yearly" | "lifetime",
      status: "active",
      maxDevices: maxDevices ?? 1,
      activatedDevices: 0,
      expiresAt,
    })
    .returning();

  // Return with joined user/product data
  const [full] = await db
    .select({
      id: licensesTable.id,
      licenseKey: licensesTable.key,
      userId: licensesTable.userId,
      productId: licensesTable.productId,
      type: licensesTable.type,
      status: licensesTable.status,
      maxDevices: licensesTable.maxDevices,
      activatedDevices: licensesTable.activatedDevices,
      expiresAt: licensesTable.expiresAt,
      createdAt: licensesTable.createdAt,
      userEmail: usersTable.email,
      userFirstName: usersTable.firstName,
      userLastName: usersTable.lastName,
      productName: productsTable.name,
    })
    .from(licensesTable)
    .leftJoin(usersTable, eq(licensesTable.userId, usersTable.id))
    .leftJoin(productsTable, eq(licensesTable.productId, productsTable.id))
    .where(eq(licensesTable.id, license.id));

  res.status(201).json(full);
});

router.patch("/admin/licenses/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }

  const { status, maxDevices } = req.body as { status?: string; maxDevices?: number };

  const validStatuses = ["active", "suspended", "revoked", "expired"];
  if (status && !validStatuses.includes(status)) {
    res.status(400).json({ error: `status must be one of: ${validStatuses.join(", ")}` });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (status) updates.status = status;
  if (maxDevices !== undefined) updates.maxDevices = maxDevices;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No valid fields to update" });
    return;
  }

  const [updated] = await db
    .update(licensesTable)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .set(updates as any)
    .where(eq(licensesTable.id, id))
    .returning();

  if (!updated) { res.status(404).json({ error: "License not found" }); return; }

  // Return with joined user/product data
  const [full] = await db
    .select({
      id: licensesTable.id,
      licenseKey: licensesTable.key,
      userId: licensesTable.userId,
      productId: licensesTable.productId,
      type: licensesTable.type,
      status: licensesTable.status,
      maxDevices: licensesTable.maxDevices,
      activatedDevices: licensesTable.activatedDevices,
      expiresAt: licensesTable.expiresAt,
      createdAt: licensesTable.createdAt,
      userEmail: usersTable.email,
      userFirstName: usersTable.firstName,
      userLastName: usersTable.lastName,
      productName: productsTable.name,
    })
    .from(licensesTable)
    .leftJoin(usersTable, eq(licensesTable.userId, usersTable.id))
    .leftJoin(productsTable, eq(licensesTable.productId, productsTable.id))
    .where(eq(licensesTable.id, id));

  res.json(full);
});

router.delete("/admin/licenses/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }
  const [deleted] = await db.delete(licensesTable).where(eq(licensesTable.id, id)).returning({ id: licensesTable.id });
  if (!deleted) { res.status(404).json({ error: "License not found" }); return; }
  res.status(204).send();
});

router.get("/admin/licenses", async (req, res): Promise<void> => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 20);
  const offset = (page - 1) * limit;

  const [licenses, [totalRow]] = await Promise.all([
    db
      .select({
        id: licensesTable.id,
        licenseKey: licensesTable.key,
        userId: licensesTable.userId,
        productId: licensesTable.productId,
        type: licensesTable.type,
        status: licensesTable.status,
        maxDevices: licensesTable.maxDevices,
        expiresAt: licensesTable.expiresAt,
        createdAt: licensesTable.createdAt,
        userEmail: usersTable.email,
        userFirstName: usersTable.firstName,
        userLastName: usersTable.lastName,
        productName: productsTable.name,
      })
      .from(licensesTable)
      .leftJoin(usersTable, eq(licensesTable.userId, usersTable.id))
      .leftJoin(productsTable, eq(licensesTable.productId, productsTable.id))
      .orderBy(desc(licensesTable.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(licensesTable),
  ]);

  res.json({ licenses, total: Number(totalRow?.total ?? 0), page, limit });
});

router.get("/admin/subscriptions", async (req, res): Promise<void> => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 20);
  const offset = (page - 1) * limit;

  const [subscriptions, [totalRow]] = await Promise.all([
    db
      .select({
        id: subscriptionsTable.id,
        userId: subscriptionsTable.userId,
        productId: subscriptionsTable.productId,
        status: subscriptionsTable.status,
        currentPeriodStart: subscriptionsTable.currentPeriodStart,
        currentPeriodEnd: subscriptionsTable.currentPeriodEnd,
        createdAt: subscriptionsTable.createdAt,
        userEmail: usersTable.email,
        userFirstName: usersTable.firstName,
        userLastName: usersTable.lastName,
        productName: productsTable.name,
      })
      .from(subscriptionsTable)
      .leftJoin(usersTable, eq(subscriptionsTable.userId, usersTable.id))
      .leftJoin(productsTable, eq(subscriptionsTable.productId, productsTable.id))
      .orderBy(desc(subscriptionsTable.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(subscriptionsTable),
  ]);

  res.json({ subscriptions, total: Number(totalRow?.total ?? 0), page, limit });
});

// ── BLOG ───────────────────────────────────────────────────────────────────
router.get("/admin/blog", async (_req, res): Promise<void> => {
  const posts = await db.select().from(blogPostsTable).orderBy(desc(blogPostsTable.createdAt));
  res.json(posts);
});

router.post("/admin/blog", async (req, res): Promise<void> => {
  const { title, slug, excerpt, content, authorName, published } = req.body as Record<string, unknown>;
  if (!title || !slug || !content) {
    res.status(400).json({ error: "title, slug and content are required" });
    return;
  }
  const isPublished = Boolean(published);
  const [post] = await db
    .insert(blogPostsTable)
    .values({
      title: String(title),
      slug: String(slug),
      excerpt: excerpt ? String(excerpt) : null,
      content: String(content),
      authorName: authorName ? String(authorName) : "Midanic Team",
      published: isPublished,
      publishedAt: isPublished ? new Date() : null,
    })
    .returning();
  res.status(201).json(post);
});

router.patch("/admin/blog/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  const allowed = ["title", "slug", "excerpt", "content", "authorName"];
  for (const key of allowed) {
    if (key in req.body) updates[key] = req.body[key];
  }
  if ("published" in req.body) {
    updates.published = Boolean(req.body.published);
    if (req.body.published) updates.publishedAt = new Date();
  }

  const [post] = await db
    .update(blogPostsTable)
    .set(updates)
    .where(eq(blogPostsTable.id, id))
    .returning();
  if (!post) { res.status(404).json({ error: "Post not found" }); return; }
  res.json(post);
});

router.delete("/admin/blog/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(blogPostsTable).where(eq(blogPostsTable.id, id));
  res.status(204).end();
});

// ── NEWS ───────────────────────────────────────────────────────────────────
router.get("/admin/news", async (_req, res): Promise<void> => {
  const items = await db.select().from(newsItemsTable).orderBy(desc(newsItemsTable.createdAt));
  res.json(items);
});

router.post("/admin/news", async (req, res): Promise<void> => {
  const { title, slug, excerpt, content, published } = req.body as Record<string, unknown>;
  if (!title || !slug || !content) {
    res.status(400).json({ error: "title, slug and content are required" });
    return;
  }
  const isPublished = Boolean(published);
  const [item] = await db
    .insert(newsItemsTable)
    .values({
      title: String(title),
      slug: String(slug),
      excerpt: excerpt ? String(excerpt) : null,
      content: String(content),
      published: isPublished,
      publishedAt: isPublished ? new Date() : null,
    })
    .returning();
  res.status(201).json(item);
});

router.patch("/admin/news/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  const allowed = ["title", "slug", "excerpt", "content"];
  for (const key of allowed) {
    if (key in req.body) updates[key] = req.body[key];
  }
  if ("published" in req.body) {
    updates.published = Boolean(req.body.published);
    if (req.body.published) updates.publishedAt = new Date();
  }

  const [item] = await db
    .update(newsItemsTable)
    .set(updates)
    .where(eq(newsItemsTable.id, id))
    .returning();
  if (!item) { res.status(404).json({ error: "News item not found" }); return; }
  res.json(item);
});

router.delete("/admin/news/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(newsItemsTable).where(eq(newsItemsTable.id, id));
  res.status(204).end();
});

// ── CRM: CONTACT MESSAGES ──────────────────────────────────────────────────
router.get("/admin/contact-messages", async (req, res): Promise<void> => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 20);
  const offset = (page - 1) * limit;
  const [messages, [totalRow]] = await Promise.all([
    db.select().from(contactMessagesTable).orderBy(desc(contactMessagesTable.createdAt)).limit(limit).offset(offset),
    db.select({ total: count() }).from(contactMessagesTable),
  ]);
  res.json({ messages, total: Number(totalRow?.total ?? 0), page, limit });
});

router.patch("/admin/contact-messages/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { isRead } = req.body as { isRead?: boolean };
  const [msg] = await db
    .update(contactMessagesTable)
    .set({ isRead: Boolean(isRead) })
    .where(eq(contactMessagesTable.id, id))
    .returning();
  if (!msg) { res.status(404).json({ error: "Message not found" }); return; }
  res.json(msg);
});

// ── CRM: TRIAL REQUESTS ────────────────────────────────────────────────────
router.get("/admin/trial-requests", async (req, res): Promise<void> => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 20);
  const offset = (page - 1) * limit;
  const [requests, [totalRow]] = await Promise.all([
    db
      .select({
        id: trialRequestsTable.id,
        name: trialRequestsTable.name,
        email: trialRequestsTable.email,
        companyName: trialRequestsTable.companyName,
        phone: trialRequestsTable.phone,
        productId: trialRequestsTable.productId,
        message: trialRequestsTable.message,
        status: trialRequestsTable.status,
        createdAt: trialRequestsTable.createdAt,
        productName: productsTable.name,
      })
      .from(trialRequestsTable)
      .leftJoin(
        productsTable,
        eq(trialRequestsTable.productId, sql`${productsTable.id}::text`),
      )
      .orderBy(desc(trialRequestsTable.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(trialRequestsTable),
  ]);
  res.json({ requests, total: Number(totalRow?.total ?? 0), page, limit });
});

router.patch("/admin/trial-requests/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { status } = req.body as { status?: string };
  const [updated] = await db
    .update(trialRequestsTable)
    .set({ status: status as "pending" | "approved" | "rejected" | "expired" })
    .where(eq(trialRequestsTable.id, id))
    .returning();
  if (!updated) { res.status(404).json({ error: "Request not found" }); return; }
  res.json(updated);
});

// ── CRM: DEMO REQUESTS ─────────────────────────────────────────────────────
router.get("/admin/demo-requests", async (req, res): Promise<void> => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 20);
  const offset = (page - 1) * limit;
  const [requests, [totalRow]] = await Promise.all([
    db
      .select({
        id: demoRequestsTable.id,
        name: demoRequestsTable.name,
        email: demoRequestsTable.email,
        companyName: demoRequestsTable.companyName,
        phone: demoRequestsTable.phone,
        productId: demoRequestsTable.productId,
        preferredDate: demoRequestsTable.preferredDate,
        message: demoRequestsTable.message,
        status: demoRequestsTable.status,
        createdAt: demoRequestsTable.createdAt,
        productName: productsTable.name,
      })
      .from(demoRequestsTable)
      .leftJoin(
        productsTable,
        eq(demoRequestsTable.productId, sql`${productsTable.id}::text`),
      )
      .orderBy(desc(demoRequestsTable.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(demoRequestsTable),
  ]);
  res.json({ requests, total: Number(totalRow?.total ?? 0), page, limit });
});

router.patch("/admin/demo-requests/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { status } = req.body as { status?: string };
  const [updated] = await db
    .update(demoRequestsTable)
    .set({ status: status as "pending" | "scheduled" | "completed" | "cancelled" })
    .where(eq(demoRequestsTable.id, id))
    .returning();
  if (!updated) { res.status(404).json({ error: "Request not found" }); return; }
  res.json(updated);
});

// ── CRM: NEWSLETTER ────────────────────────────────────────────────────────
router.get("/admin/newsletter", async (req, res): Promise<void> => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 20);
  const offset = (page - 1) * limit;
  const [subscribers, [totalRow]] = await Promise.all([
    db.select().from(newsletterSubscribersTable).orderBy(desc(newsletterSubscribersTable.createdAt)).limit(limit).offset(offset),
    db.select({ total: count() }).from(newsletterSubscribersTable),
  ]);
  res.json({ subscribers, total: Number(totalRow?.total ?? 0), page, limit });
});

// ── SUPPORT TICKETS ────────────────────────────────────────────────────────
router.get("/admin/support-tickets", async (req, res): Promise<void> => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 20);
  const offset = (page - 1) * limit;
  const status = typeof req.query.status === "string" ? req.query.status : undefined;

  const condition = status ? eq(supportTicketsTable.status, status as "open" | "in_progress" | "waiting_customer" | "resolved" | "closed") : undefined;

  const [tickets, [totalRow]] = await Promise.all([
    db
      .select({
        id: supportTicketsTable.id,
        ticketNumber: supportTicketsTable.ticketNumber,
        subject: supportTicketsTable.subject,
        category: supportTicketsTable.category,
        status: supportTicketsTable.status,
        priority: supportTicketsTable.priority,
        userId: supportTicketsTable.userId,
        createdAt: supportTicketsTable.createdAt,
        userEmail: usersTable.email,
        userFirstName: usersTable.firstName,
        userLastName: usersTable.lastName,
      })
      .from(supportTicketsTable)
      .leftJoin(usersTable, eq(supportTicketsTable.userId, usersTable.id))
      .where(condition)
      .orderBy(desc(supportTicketsTable.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(supportTicketsTable).where(condition),
  ]);

  res.json({ tickets, total: Number(totalRow?.total ?? 0), page, limit });
});

router.get("/admin/support-tickets/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [ticket] = await db
    .select({
      id: supportTicketsTable.id,
      ticketNumber: supportTicketsTable.ticketNumber,
      subject: supportTicketsTable.subject,
      category: supportTicketsTable.category,
      status: supportTicketsTable.status,
      priority: supportTicketsTable.priority,
      userId: supportTicketsTable.userId,
      createdAt: supportTicketsTable.createdAt,
      userEmail: usersTable.email,
      userFirstName: usersTable.firstName,
      userLastName: usersTable.lastName,
    })
    .from(supportTicketsTable)
    .leftJoin(usersTable, eq(supportTicketsTable.userId, usersTable.id))
    .where(eq(supportTicketsTable.id, id));

  if (!ticket) { res.status(404).json({ error: "Ticket not found" }); return; }

  const messages = await db
    .select()
    .from(ticketMessagesTable)
    .where(eq(ticketMessagesTable.ticketId, id))
    .orderBy(ticketMessagesTable.createdAt);

  res.json({ ...ticket, messages });
});

router.patch("/admin/support-tickets/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { status, priority } = req.body as { status?: string; priority?: string };
  const updates: Record<string, unknown> = {};
  if (status) updates.status = status;
  if (priority) updates.priority = priority;

  const [ticket] = await db
    .update(supportTicketsTable)
    .set(updates)
    .where(eq(supportTicketsTable.id, id))
    .returning();
  if (!ticket) { res.status(404).json({ error: "Ticket not found" }); return; }
  res.json(ticket);
});

router.post("/admin/support-tickets/:id/reply", async (req, res): Promise<void> => {
  const ticketId = Number(req.params.id);
  if (isNaN(ticketId)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { message } = req.body as { message?: string };
  if (!message || !message.trim()) {
    res.status(400).json({ error: "message is required" });
    return;
  }

  const adminUserId = req.user!.userId;

  const [msg] = await db
    .insert(ticketMessagesTable)
    .values({
      ticketId,
      userId: adminUserId,
      message: message.trim(),
      isStaff: "true",
    })
    .returning();

  // Move ticket to in_progress if still open
  await db
    .update(supportTicketsTable)
    .set({ status: "in_progress" })
    .where(
      sql`${supportTicketsTable.id} = ${ticketId} AND ${supportTicketsTable.status} = 'open'`
    );

  res.status(201).json(msg);
});

export default router;
