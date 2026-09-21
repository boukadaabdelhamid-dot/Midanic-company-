import type { Pool } from "pg";

/**
 * Idempotent reconciliation for purchase-order schema added after the original
 * tenant databases were provisioned. Older tenants can have purchase_orders
 * without the receipt image column or any of the annexe-charge tables.
 */
export async function runPurchaseOrdersSchemaMigration(pool: Pool): Promise<void> {
  try {
    await pool.query(`
      ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS receipt_image_url TEXT;

      CREATE TABLE IF NOT EXISTS purchase_annexe_charges (
        id SERIAL PRIMARY KEY,
        store_id INTEGER NOT NULL REFERENCES stores(id),
        description TEXT NOT NULL,
        total_amount NUMERIC(12, 2) NOT NULL,
        date DATE NOT NULL,
        notes TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS purchase_annexe_charge_orders (
        charge_id INTEGER NOT NULL REFERENCES purchase_annexe_charges(id) ON DELETE CASCADE,
        purchase_order_id INTEGER NOT NULL REFERENCES purchase_orders(id)
      );

      CREATE TABLE IF NOT EXISTS purchase_annexe_charge_lines (
        id SERIAL PRIMARY KEY,
        charge_id INTEGER NOT NULL REFERENCES purchase_annexe_charges(id) ON DELETE CASCADE,
        purchase_item_id INTEGER NOT NULL REFERENCES purchase_items(id),
        purchase_order_id INTEGER NOT NULL REFERENCES purchase_orders(id),
        product_id INTEGER NOT NULL REFERENCES products(id),
        allocated_amount NUMERIC(12, 2) NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_purchase_annexe_charges_store_id
        ON purchase_annexe_charges(store_id);
      CREATE INDEX IF NOT EXISTS idx_purchase_annexe_charge_orders_charge_id
        ON purchase_annexe_charge_orders(charge_id);
      CREATE INDEX IF NOT EXISTS idx_purchase_annexe_charge_orders_po_id
        ON purchase_annexe_charge_orders(purchase_order_id);
      CREATE INDEX IF NOT EXISTS idx_purchase_annexe_charge_lines_charge_id
        ON purchase_annexe_charge_lines(charge_id);
      CREATE INDEX IF NOT EXISTS idx_purchase_annexe_charge_lines_item_id
        ON purchase_annexe_charge_lines(purchase_item_id);
    `);
    console.info("[purchase-orders-schema-migration] Applied.");
  } catch (err) {
    console.warn("[purchase-orders-schema-migration] skipped:", (err as Error).message);
  }
}
