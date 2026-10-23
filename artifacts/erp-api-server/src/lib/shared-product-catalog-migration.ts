import type { Pool } from "pg";

/**
 * Tenant databases may already have been created from push-managed schemas.
 * Keep this idempotent so shared-product identifiers exist after every boot.
 */
export async function runSharedProductCatalogMigration(pool: Pool): Promise<void> {
  await pool.query(
    `ALTER TABLE "erp"."products" ADD COLUMN IF NOT EXISTS "shared_catalog_id" text`,
  );
  await pool.query(`
    CREATE INDEX IF NOT EXISTS "products_shared_catalog_id_idx"
      ON "erp"."products" ("shared_catalog_id")
      WHERE "shared_catalog_id" IS NOT NULL
  `);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS "products_store_shared_catalog_id_uq"
      ON "erp"."products" ("store_id", "shared_catalog_id")
      WHERE "shared_catalog_id" IS NOT NULL
  `);
  await pool.query(`
    ALTER TABLE "erp"."product_barcodes"
      DROP CONSTRAINT IF EXISTS "product_barcodes_barcode_unique"
  `);
  await pool.query(`DROP INDEX IF EXISTS "erp"."product_barcodes_barcode_unique"`);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS "product_barcodes_store_barcode_uq"
      ON "erp"."product_barcodes" ("store_id", "barcode")
  `);
}
