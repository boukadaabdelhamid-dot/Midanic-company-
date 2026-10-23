import type { Pool } from "pg";

/**
 * Keep this migration idempotent: tenant databases can be provisioned from
 * older push-managed schemas and are reconciled every time the ERP API starts.
 */
export async function runManufacturingMigration(targetPool: Pool): Promise<void> {
  await targetPool.query(
    `ALTER TABLE "erp"."stores" ADD COLUMN IF NOT EXISTS "kind" text NOT NULL DEFAULT 'store'`,
  );
  await targetPool.query(`
    DO $$ BEGIN
      CREATE TYPE "erp"."manufacturing_order_status" AS ENUM ('planned', 'completed', 'cancelled');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `);
  await targetPool.query(`
    CREATE TABLE IF NOT EXISTS "erp"."manufacturing_recipes" (
      "id" serial PRIMARY KEY,
      "store_id" integer NOT NULL REFERENCES "erp"."stores"("id") ON DELETE CASCADE,
      "output_product_id" integer NOT NULL REFERENCES "erp"."products"("id"),
      "yield_quantity" double precision NOT NULL DEFAULT 1,
      "instructions" text,
      "is_active" boolean NOT NULL DEFAULT true,
      "created_by_user_id" integer NOT NULL REFERENCES "erp"."users"("id"),
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now()
    )
  `);
  await targetPool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS "manufacturing_recipes_store_output_uq"
      ON "erp"."manufacturing_recipes" ("store_id", "output_product_id")
  `);
  await targetPool.query(`
    CREATE INDEX IF NOT EXISTS "manufacturing_recipes_store_active_idx"
      ON "erp"."manufacturing_recipes" ("store_id", "is_active")
  `);
  await targetPool.query(`
    CREATE TABLE IF NOT EXISTS "erp"."manufacturing_recipe_items" (
      "id" serial PRIMARY KEY,
      "recipe_id" integer NOT NULL REFERENCES "erp"."manufacturing_recipes"("id") ON DELETE CASCADE,
      "product_id" integer NOT NULL REFERENCES "erp"."products"("id"),
      "quantity" double precision NOT NULL
    )
  `);
  await targetPool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS "manufacturing_recipe_items_recipe_product_uq"
      ON "erp"."manufacturing_recipe_items" ("recipe_id", "product_id")
  `);
  await targetPool.query(`
    CREATE TABLE IF NOT EXISTS "erp"."manufacturing_orders" (
      "id" serial PRIMARY KEY,
      "store_id" integer NOT NULL REFERENCES "erp"."stores"("id") ON DELETE CASCADE,
      "recipe_id" integer NOT NULL REFERENCES "erp"."manufacturing_recipes"("id"),
      "status" "erp"."manufacturing_order_status" NOT NULL DEFAULT 'planned',
      "planned_quantity" double precision NOT NULL,
      "total_material_cost" numeric(12, 2) NOT NULL DEFAULT 0,
      "notes" text,
      "created_by_user_id" integer NOT NULL REFERENCES "erp"."users"("id"),
      "completed_by_user_id" integer REFERENCES "erp"."users"("id"),
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "completed_at" timestamptz
    )
  `);
  await targetPool.query(`
    CREATE INDEX IF NOT EXISTS "manufacturing_orders_store_created_idx"
      ON "erp"."manufacturing_orders" ("store_id", "created_at")
  `);
  await targetPool.query(`
    CREATE INDEX IF NOT EXISTS "manufacturing_orders_store_status_idx"
      ON "erp"."manufacturing_orders" ("store_id", "status")
  `);
  await targetPool.query(`
    CREATE TABLE IF NOT EXISTS "erp"."manufacturing_order_items" (
      "id" serial PRIMARY KEY,
      "order_id" integer NOT NULL REFERENCES "erp"."manufacturing_orders"("id") ON DELETE CASCADE,
      "product_id" integer NOT NULL REFERENCES "erp"."products"("id"),
      "required_quantity" double precision NOT NULL,
      "consumed_quantity" double precision,
      "unit_cost" numeric(12, 4),
      "line_cost" numeric(12, 2)
    )
  `);
  await targetPool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS "manufacturing_order_items_order_product_uq"
      ON "erp"."manufacturing_order_items" ("order_id", "product_id")
  `);
}
