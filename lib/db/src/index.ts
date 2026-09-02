import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import path from "path";
import { fileURLToPath } from "url";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

async function ensureUploadedAssetsSchema(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "uploaded_assets" (
      "id" uuid PRIMARY KEY NOT NULL,
      "content_type" text NOT NULL,
      "data" bytea NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    )
  `);
}

async function ensureEntitlementsSchema(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "customer_entitlements" (
      "id" serial PRIMARY KEY NOT NULL,
      "user_id" integer NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
      "max_stores" integer,
      "max_users" integer,
      "storage_gb" integer,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_by" integer REFERENCES "users"("id") ON DELETE SET NULL
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "entitlement_history" (
      "id" serial PRIMARY KEY NOT NULL,
      "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "changed_by" integer REFERENCES "users"("id") ON DELETE SET NULL,
      "old_values" jsonb,
      "new_values" jsonb NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    )
  `);
}

async function ensureCustomerProfileSchema(): Promise<void> {
  await pool.query(`
    ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "address" text,
      ADD COLUMN IF NOT EXISTS "last_login_at" timestamp with time zone
  `);
}

async function ensureErpCustomerLinksSchema(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "erp_customer_links" (
      "id" serial PRIMARY KEY NOT NULL,
      "user_id" integer NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
      "token_hash" text NOT NULL UNIQUE,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    )
  `);
}

async function ensureAdminSettingsSchema(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "admin_settings" (
      "id" serial PRIMARY KEY NOT NULL,
      "admin_name" text DEFAULT 'Midanic Admin' NOT NULL,
      "page_title" text DEFAULT 'Administration' NOT NULL,
      "page_subtitle" text DEFAULT 'Manage your platform from one place' NOT NULL,
      "admin_name_en" text DEFAULT 'Midanic Admin' NOT NULL,
      "admin_name_fr" text DEFAULT 'Midanic Admin' NOT NULL,
      "admin_name_ar" text DEFAULT 'ميدانيك' NOT NULL,
      "page_title_en" text DEFAULT 'Administration' NOT NULL,
      "page_title_fr" text DEFAULT 'Administration' NOT NULL,
      "page_title_ar" text DEFAULT 'الإدارة' NOT NULL,
      "page_subtitle_en" text DEFAULT 'Manage your platform from one place' NOT NULL,
      "page_subtitle_fr" text DEFAULT 'Gérez votre plateforme depuis un seul endroit' NOT NULL,
      "page_subtitle_ar" text DEFAULT 'أدر منصتك من مكان واحد' NOT NULL,
      "accent_color" text DEFAULT '#3b82f6' NOT NULL,
      "theme" text DEFAULT 'dark' NOT NULL,
      "sidebar_style" text DEFAULT 'default' NOT NULL,
      "background_image_url" text,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    )
  `);
  await pool.query(`
    ALTER TABLE "admin_settings"
      ADD COLUMN IF NOT EXISTS "admin_name_en" text DEFAULT 'Midanic Admin' NOT NULL,
      ADD COLUMN IF NOT EXISTS "admin_name_fr" text DEFAULT 'Midanic Admin' NOT NULL,
      ADD COLUMN IF NOT EXISTS "admin_name_ar" text DEFAULT 'ميدانيك' NOT NULL,
      ADD COLUMN IF NOT EXISTS "page_title_en" text DEFAULT 'Administration' NOT NULL,
      ADD COLUMN IF NOT EXISTS "page_title_fr" text DEFAULT 'Administration' NOT NULL,
      ADD COLUMN IF NOT EXISTS "page_title_ar" text DEFAULT 'الإدارة' NOT NULL,
      ADD COLUMN IF NOT EXISTS "page_subtitle_en" text DEFAULT 'Manage your platform from one place' NOT NULL,
      ADD COLUMN IF NOT EXISTS "page_subtitle_fr" text DEFAULT 'Gérez votre plateforme depuis un seul endroit' NOT NULL,
      ADD COLUMN IF NOT EXISTS "page_subtitle_ar" text DEFAULT 'أدر منصتك من مكان واحد' NOT NULL
  `);
  // Carry forward values saved by the previous single-language settings form.
  await pool.query(`
    UPDATE "admin_settings"
    SET
      "admin_name_en" = CASE
        WHEN "admin_name_en" = 'Midanic Admin' AND "admin_name" <> 'Midanic Admin'
        THEN "admin_name" ELSE "admin_name_en" END,
      "page_title_en" = CASE
        WHEN "page_title_en" = 'Administration' AND "page_title" <> 'Administration'
        THEN "page_title" ELSE "page_title_en" END,
      "page_subtitle_en" = CASE
        WHEN "page_subtitle_en" = 'Manage your platform from one place'
          AND "page_subtitle" <> 'Manage your platform from one place'
        THEN "page_subtitle" ELSE "page_subtitle_en" END
  `);
  await pool.query(`
    INSERT INTO "admin_settings" (
      "admin_name",
      "page_title",
      "page_subtitle",
      "accent_color",
      "theme",
      "sidebar_style"
    )
    SELECT 'Midanic Admin', 'Administration',
      'Manage your platform from one place', '#3b82f6', 'dark', 'default'
    WHERE NOT EXISTS (SELECT 1 FROM "admin_settings")
  `);
}

async function ensureErpManagementSchema(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "erp_tenants" (
      "id" serial PRIMARY KEY NOT NULL,
      "owner_user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "company_name" text NOT NULL,
      "status" text DEFAULT 'pending' NOT NULL,
      "subdomain" text,
      "hostname" text,
      "domain_status" text DEFAULT 'inactive' NOT NULL,
      "domain_activated_at" timestamp with time zone,
      "trial_started_at" timestamp with time zone,
      "trial_ends_at" timestamp with time zone,
      "approved_at" timestamp with time zone,
      "suspended_at" timestamp with time zone,
      "notes" text,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    )
  `);
  await pool.query(`
    ALTER TABLE "erp_tenants"
      ADD COLUMN IF NOT EXISTS "subdomain" text,
      ADD COLUMN IF NOT EXISTS "hostname" text,
      ADD COLUMN IF NOT EXISTS "domain_status" text DEFAULT 'inactive' NOT NULL,
      ADD COLUMN IF NOT EXISTS "domain_activated_at" timestamp with time zone
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS "erp_tenants_owner_user_id_idx"
    ON "erp_tenants" ("owner_user_id")
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS "erp_tenants_status_idx"
    ON "erp_tenants" ("status")
  `);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS "erp_tenants_subdomain_uq"
    ON "erp_tenants" ("subdomain") WHERE "subdomain" IS NOT NULL
  `);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS "erp_tenants_hostname_uq"
    ON "erp_tenants" ("hostname") WHERE "hostname" IS NOT NULL
  `);
}

async function ensureErpCompatibilitySchema(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "erp_stores" (
      "id" serial PRIMARY KEY,
      "owner_user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "name_ar" text NOT NULL DEFAULT 'المتجر الرئيسي',
      "name_en" text NOT NULL DEFAULT 'Main Store',
      "slug" text NOT NULL UNIQUE,
      "is_active" boolean NOT NULL DEFAULT true,
      "created_at" timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS "erp_product_types" (
      "id" serial PRIMARY KEY,
      "name_ar" text NOT NULL,
      "name_en" text NOT NULL,
      "store_id" integer NOT NULL REFERENCES "erp_stores"("id") ON DELETE CASCADE,
      "created_at" timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS "erp_products" (
      "id" serial PRIMARY KEY,
      "store_id" integer NOT NULL REFERENCES "erp_stores"("id") ON DELETE CASCADE,
      "name_ar" text NOT NULL DEFAULT '',
      "name_en" text NOT NULL DEFAULT '',
      "description_ar" text NOT NULL DEFAULT '',
      "description_en" text NOT NULL DEFAULT '',
      "price" numeric(12,2) NOT NULL DEFAULT 0,
      "image_url" text,
      "stock" numeric(14,3) NOT NULL DEFAULT 0,
      "reference" text,
      "barcode" text,
      "cost_price" numeric(12,2),
      "price_gros" numeric(12,2),
      "price_semi_gros" numeric(12,2),
      "price_min" numeric(12,2),
      "catalogue_type" text NOT NULL DEFAULT 'ARTICLE',
      "is_active" boolean NOT NULL DEFAULT true,
      "is_exposed" boolean NOT NULL DEFAULT true,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS "erp_products_store_id_idx" ON "erp_products" ("store_id");
  `);
}

async function ensureErpDemoData(): Promise<void> {
  const customer = await pool.query<{ id: number }>(
    `SELECT id FROM users WHERE lower(email) = 'customer@example.com' LIMIT 1`,
  );
  if (!customer.rows[0]) return;

  const ownerId = customer.rows[0].id;
  const tenant = await pool.query<{ id: number }>(
    `SELECT id FROM erp_tenants WHERE owner_user_id = $1 ORDER BY id LIMIT 1`,
    [ownerId],
  );
  let tenantId = tenant.rows[0]?.id;
  if (!tenantId) {
    const created = await pool.query<{ id: number }>(
      `INSERT INTO erp_tenants
        (owner_user_id, company_name, status, trial_started_at, trial_ends_at, approved_at, notes)
       VALUES ($1, 'شركة التجربة - Midanic', 'active', now(), now() + interval '7 days', now(),
               'Demo tenant created for ERP evaluation')
       RETURNING id`,
      [ownerId],
    );
    tenantId = created.rows[0].id;
  }
  // Keep the built-in evaluation tenant immediately reachable from Platform.
  // The notes predicate prevents this demo repair from touching a real tenant.
  await pool.query(
    `UPDATE erp_tenants
     SET subdomain = COALESCE(subdomain, 'demo'),
         hostname = COALESCE(hostname, 'demo.midanic.com'),
         domain_status = 'active',
         domain_activated_at = COALESCE(domain_activated_at, now()),
         status = 'active',
         trial_started_at = COALESCE(trial_started_at, now()),
         trial_ends_at = now() + interval '7 days',
         updated_at = now()
     WHERE id = $1 AND notes = 'Demo tenant created for ERP evaluation'`,
    [tenantId],
  );

  const store = await pool.query<{ id: number }>(
    `SELECT id FROM erp_stores WHERE slug = 'demo-store' LIMIT 1`,
  );
  let storeId = store.rows[0]?.id;
  if (!storeId) {
    const created = await pool.query<{ id: number }>(
      `INSERT INTO erp_stores
        (owner_user_id, name_ar, name_en, slug)
       VALUES ($1, 'متجر التجربة', 'Demo Store', 'demo-store')
       RETURNING id`,
      [ownerId],
    );
    storeId = created.rows[0].id;
  }

  await pool.query(
    `INSERT INTO erp_product_types (store_id, name_ar, name_en)
     SELECT $1, v.name_ar, v.name_en
     FROM (VALUES
       ('مواد غذائية', 'Grocery'),
       ('إلكترونيات', 'Electronics'),
       ('مستلزمات مكتبية', 'Office supplies')
     ) AS v(name_ar, name_en)
     WHERE NOT EXISTS (
       SELECT 1 FROM erp_product_types t
       WHERE t.store_id = $1 AND t.name_en = v.name_en
     )`,
    [storeId],
  );

  await pool.query(
    `INSERT INTO erp_products
      (store_id, name_ar, name_en, description_ar, description_en, price, stock,
       reference, barcode, cost_price, price_gros, price_semi_gros, price_min)
     SELECT $1, v.name_ar, v.name_en, v.description_ar, v.description_en,
            v.price, v.stock, v.reference, v.barcode, v.cost_price,
            v.price_gros, v.price_semi_gros, v.price_min
     FROM (VALUES
       ('قهوة جزائرية', 'Algerian Coffee', 'قهوة محمصة عالية الجودة', 'Premium roasted coffee',
        850.00::numeric, 45::numeric, 'DEMO-COF-001', '6110000000011',
        600.00::numeric, 720.00::numeric, 780.00::numeric, 820.00::numeric),
       ('سماعات لاسلكية', 'Wireless Headphones', 'سماعات بلوتوث للاستخدام اليومي', 'Bluetooth headphones for daily use',
        3200.00::numeric, 18::numeric, 'DEMO-AUD-001', '6110000000028',
        2400.00::numeric, 2800.00::numeric, 3000.00::numeric, 3100.00::numeric),
       ('دفتر أعمال', 'Business Notebook', 'دفتر عملي بغلاف فاخر', 'Premium business notebook',
        450.00::numeric, 80::numeric, 'DEMO-OFF-001', '6110000000035',
        280.00::numeric, 360.00::numeric, 400.00::numeric, 430.00::numeric)
     ) AS v(name_ar, name_en, description_ar, description_en, price, stock, reference, barcode,
            cost_price, price_gros, price_semi_gros, price_min)
     WHERE NOT EXISTS (
       SELECT 1 FROM erp_products p
       WHERE p.store_id = $1 AND p.reference = v.reference
     )`,
    [storeId],
  );
}

async function ensureProductManagementSchema(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Existing Railway databases may have been created with drizzle-kit push
    // before product versions/downloads were added. Keep this reconciliation
    // idempotent so startup can safely bring those databases up to date.
    await client.query(`
      ALTER TABLE "products"
        ADD COLUMN IF NOT EXISTS "image_url" text,
        ADD COLUMN IF NOT EXISTS "video_url" text,
        ADD COLUMN IF NOT EXISTS "default_license_type" text
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "product_versions" (
        "id" serial PRIMARY KEY NOT NULL,
        "product_id" integer NOT NULL,
        "version" text NOT NULL,
        "release_notes" text,
        "is_latest" boolean DEFAULT false NOT NULL,
        "released_at" timestamp with time zone DEFAULT now() NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "download_files" (
        "id" serial PRIMARY KEY NOT NULL,
        "product_id" integer NOT NULL,
        "version_id" integer,
        "file_name" text NOT NULL,
        "file_size" integer DEFAULT 0 NOT NULL,
        "platform" text DEFAULT 'windows' NOT NULL,
        "version" text,
        "download_url" text NOT NULL,
        "download_count" integer DEFAULT 0 NOT NULL,
        "is_public" boolean DEFAULT true NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL
      )
    `);

    // NOT VALID lets legacy rows remain untouched while enforcing the
    // relationship for all new writes. This avoids startup failure when an
    // old database contains orphaned records.
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'product_versions_product_id_products_id_fk'
            AND table_name = 'product_versions'
        ) THEN
          ALTER TABLE "product_versions"
            ADD CONSTRAINT "product_versions_product_id_products_id_fk"
            FOREIGN KEY ("product_id") REFERENCES "public"."products"("id")
            ON DELETE cascade ON UPDATE no action
            NOT VALID;
        END IF;
      END $$
    `);

    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'download_files_product_id_products_id_fk'
            AND table_name = 'download_files'
        ) THEN
          ALTER TABLE "download_files"
            ADD CONSTRAINT "download_files_product_id_products_id_fk"
            FOREIGN KEY ("product_id") REFERENCES "public"."products"("id")
            ON DELETE cascade ON UPDATE no action
            NOT VALID;
        END IF;
      END $$
    `);

    // Replace any existing version FK, regardless of its old delete rule.
    await client.query(`
      DO $$
      DECLARE constraint_row record;
      BEGIN
        FOR constraint_row IN
          SELECT conname
          FROM pg_constraint
          WHERE conrelid = 'download_files'::regclass
            AND contype = 'f'
            AND confrelid = 'product_versions'::regclass
        LOOP
          EXECUTE format(
            'ALTER TABLE "download_files" DROP CONSTRAINT %I',
            constraint_row.conname
          );
        END LOOP;

        ALTER TABLE "download_files"
          ADD CONSTRAINT "download_files_version_id_product_versions_id_fk"
          FOREIGN KEY ("version_id") REFERENCES "public"."product_versions"("id")
          ON DELETE set null ON UPDATE no action
          NOT VALID;
      END $$
    `);

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Apply all pending Drizzle migrations from the bundled ./drizzle folder.
 * Call once at application startup before serving requests.
 *
 * The migrations directory is resolved relative to this file so it works
 * both in development (TypeScript source) and in the esbuild bundle
 * (dist/index.mjs), provided the `drizzle/` folder is copied alongside
 * the bundle — handled by Dockerfile and build.mjs.
 *
 * Bootstrap behaviour: if the database was previously set up with
 * `drizzle-kit push` (tables exist but the migrations journal doesn't),
 * the initial migration is marked as already applied so `migrate()` only
 * runs subsequent schema changes — preventing duplicate-object errors on
 * types and tables that already exist.
 */
export async function runMigrations(): Promise<void> {
  const { createHash } = await import("crypto");
  const { readFileSync } = await import("fs");
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const migrationsFolder = path.join(__dirname, "drizzle");

  // Detect push-bootstrapped DB: products table exists but the Drizzle
  // migrations journal is absent or empty (no applied migrations recorded).
  // Keep the relation check separate: PostgreSQL resolves table references
  // in a CASE subquery even when that branch would not be selected.
  const { rows } = await pool.query<{
    has_products: boolean;
    has_journal: boolean;
  }>(`
    SELECT
      to_regclass('public.products') IS NOT NULL AS has_products,
      to_regclass('drizzle.__drizzle_migrations') IS NOT NULL AS has_journal
  `);
  const { has_products, has_journal } = rows[0];
  let hasAppliedMigrations = false;

  if (has_journal) {
    const journalCount = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM drizzle."__drizzle_migrations"`,
    );
    hasAppliedMigrations = Number(journalCount.rows[0]?.count ?? 0) > 0;
  }

  if (has_products) {
    // Drizzle tracks applied migrations by comparing each migration's journal
    // timestamp (folderMillis / "when") against the last recorded created_at.
    // If "created_at >= migration.when", the migration is skipped.
    // We read the journal to find the timestamp of the initial migration and
    // insert a sentinel record so that migrate() only runs *new* migrations.
    const journalPath = path.join(migrationsFolder, "meta", "_journal.json");
    const journal = JSON.parse(readFileSync(journalPath, "utf8")) as {
      entries: Array<{ idx: number; when: number; tag: string }>;
    };
    // Sort ascending; the initial migration (idx=0) has the lowest timestamp.
    const firstEntry = [...journal.entries].sort((a, b) => a.idx - b.idx)[0];
    if (!firstEntry) throw new Error("No migration entries found in _journal.json");

    await pool.query(`CREATE SCHEMA IF NOT EXISTS drizzle`);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS drizzle."__drizzle_migrations" (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint
      )
    `);

    const migrationRows = await pool.query<{ hash: string; created_at: string }>(
      `SELECT hash, created_at FROM drizzle."__drizzle_migrations"`
    );
    const appliedHashes = new Set(migrationRows.rows.map((row) => row.hash));

    // A push-bootstrapped DB already has the schema represented by 0000.
    // Record that baseline only when the journal is empty.
    if (!hasAppliedMigrations) {
      const sqlFile = path.join(migrationsFolder, `${firstEntry.tag}.sql`);
      const content = readFileSync(sqlFile, "utf8");
      const hash = createHash("sha256").update(content).digest("hex");
      await pool.query(
        `INSERT INTO drizzle."__drizzle_migrations" (hash, created_at)
         VALUES ($1, $2)`,
        [hash, BigInt(firstEntry.when)]
      );
      appliedHashes.add(hash);
    }

    // Reconcile the product-management schema before Drizzle evaluates
    // migration timestamps. This handles old journals and partial schemas.
    await ensureProductManagementSchema();

    // Mark 0001 applied after the reconciliation succeeds. This prevents
    // Drizzle from rerunning its historical FK DDL against a legacy schema,
    // while future migrations remain managed by Drizzle normally.
    const productMigration = journal.entries.find(
      (entry) => entry.tag === "0001_add_product_fields_and_fix_fk"
    );
    if (productMigration) {
      const sqlFile = path.join(migrationsFolder, `${productMigration.tag}.sql`);
      const content = readFileSync(sqlFile, "utf8");
      const hash = createHash("sha256").update(content).digest("hex");
      if (!appliedHashes.has(hash)) {
        const latestCreatedAt = migrationRows.rows.reduce(
          (latest, row) => Math.max(latest, Number(row.created_at)),
          0
        );
        await pool.query(
          `INSERT INTO drizzle."__drizzle_migrations" (hash, created_at)
           VALUES ($1, $2)`,
          [hash, BigInt(Math.max(Date.now(), latestCreatedAt + 1))]
        );
      }
    }
  }

  await migrate(db, { migrationsFolder });
  // These run after Drizzle migrations so they also cover a brand-new
  // database, where the products table did not exist during the bootstrap
  // detection above.
  await ensureUploadedAssetsSchema();
  await ensureCustomerProfileSchema();
  await ensureErpCustomerLinksSchema();
  await ensureEntitlementsSchema();
  await ensureAdminSettingsSchema();
  await ensureErpManagementSchema();
  await ensureErpCompatibilitySchema();
  await ensureErpDemoData();
}

export * from "./schema";
export { adminSettingsTable } from "./schema/admin-settings";
export type { AdminSettings } from "./schema/admin-settings";
