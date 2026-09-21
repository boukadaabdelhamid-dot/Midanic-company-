import { db, schema } from "./lib/db";
import bcrypt from "bcryptjs";
import { eq, asc, and, isNull } from "drizzle-orm";
import { getTenantDatabaseContext } from "./lib/db";

/**
 * bootstrap() — Production-safe initialisation.
 *
 * Creates ONLY the bare minimum required for a fresh ERP database:
 *   1. Magasin Principal (slug = "principal")
 *   2. Caisse Principale  (kind = "main")
 *   3. System-wide lookup tables: product types, price tiers, customer classifications
 *
 * Nothing else is created — no demo products, employees, suppliers,
 * customers, orders, transactions, or coupons.
 *
 * Safe to call multiple times (idempotent via onConflictDoNothing).
 */
export async function bootstrap() {
  const tenantContext = getTenantDatabaseContext();

  // Tenant databases must have one canonical store. The legacy bootstrap
  // created "principal" without a tenant id, which made the SSO path create
  // a second store in a freshly published tenant.
  if (tenantContext) {
    await db.update(schema.storesTable)
      .set({ platformTenantId: tenantContext.tenantId })
      .where(and(
        eq(schema.storesTable.slug, "principal"),
        isNull(schema.storesTable.platformTenantId),
      ));
  }

  // ── 1. Magasin Principal ──────────────────────────────────────────────────
  await db.insert(schema.storesTable).values({
    ...(tenantContext ? { platformTenantId: tenantContext.tenantId } : {}),
    nameAr: "ميدانيك الرئيسي",
    nameEn: "Midanic Principal",
    slug: "principal",
    isActive: true,
  }).onConflictDoNothing();

  const [principal] = await db
    .select()
    .from(schema.storesTable)
    .where(eq(schema.storesTable.slug, "principal"))
    .limit(1);

  if (!principal) throw new Error("Failed to ensure principal store.");

  // ── 2. Compte Administrateur ──────────────────────────────────────────────
  // The global Midanic Admin is only a local-development account. It must
  // never be seeded into an isolated tenant database, where it would appear
  // as one of the company's employees.
  if (!tenantContext) {
    const [existingAdmin] = await db
      .select({ id: schema.usersTable.id })
      .from(schema.usersTable)
      .where(eq(schema.usersTable.role, "admin"))
      .orderBy(asc(schema.usersTable.id))
      .limit(1);

    if (!existingAdmin) {
      const adminHash = await bcrypt.hash("admin1234", 10);
      await db.insert(schema.usersTable).values({
        name: "Midanic Admin",
        email: "admin@midanic.com",
        passwordHash: adminHash,
        role: "admin",
        preferredLang: "ar",
      }).onConflictDoNothing();
    }
  }

  // ── 3. Caisse Principale ────────────────────────────────────────────────
  // This is tenant data and must exist independently of the global admin
  // account. Tenant owners are provisioned later through Platform SSO.
  await db.insert(schema.caissesTable).values({
    kind: "main",
    balance: "0",
  }).onConflictDoNothing();

  // ── 4. Lookup tables (system-wide, always safe to insert) ─────────────────

  // Product types
  await db.insert(schema.productTypesTable).values([
    { nameFr: "ARTICLE",    nameAr: "مقال" },
    { nameFr: "PRODUITS",   nameAr: "منتجات" },
    { nameFr: "APPAREIL",   nameAr: "جهاز" },
    { nameFr: "ACCESSOIRE", nameAr: "إكسسوار" },
    { nameFr: "SERVICE",    nameAr: "خدمة" },
    { nameFr: "Vrac",       nameAr: "مجزأ" },
  ]).onConflictDoNothing();

  // Price tiers
  await db.insert(schema.priceTiersTable).values([
    { code: "detail",    labelFr: "Détail",        labelAr: "تجزئة",      sortOrder: 1 },
    { code: "semi_gros", labelFr: "Demi-gros",     labelAr: "نصف جملة",   sortOrder: 2 },
    { code: "gros",      labelFr: "Gros",          labelAr: "جملة",       sortOrder: 3 },
    { code: "special",   labelFr: "Tarif spécial", labelAr: "سعر خاص",    sortOrder: 4 },
  ]).onConflictDoNothing();

  // Customer classifications
  await db.insert(schema.customerClassificationsTable).values([
    { labelFr: "VIP",         labelAr: "كبار العملاء", color: "#F59E0B", sortOrder: 1 },
    { labelFr: "Grossiste",   labelAr: "جملة",          color: "#3B82F6", sortOrder: 2 },
    { labelFr: "Revendeur",   labelAr: "موزع",          color: "#8B5CF6", sortOrder: 3 },
    { labelFr: "Fidèle",      labelAr: "مخلص",          color: "#10B981", sortOrder: 4 },
    { labelFr: "Occasionnel", labelAr: "عرضي",          color: "#6B7280", sortOrder: 5 },
  ]).onConflictDoNothing();
}

/**
 * @deprecated  Use bootstrap() instead.
 * Kept only so existing `if (process.argv[1]?.includes("seed"))` CLI entry
 * point keeps working during development.
 */
export async function seed() {
  return bootstrap();
}

if (process.argv[1] && process.argv[1].includes("seed")) {
  seed().catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
}
