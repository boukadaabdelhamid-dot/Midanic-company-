import type { Pool } from "pg";

/** Runs against both the shared ERP schema and every dedicated tenant database. */
export async function runWebOrdersMigration(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS erp.web_customers (
      store_id integer NOT NULL REFERENCES erp.stores(id),
      phone text NOT NULL,
      user_id integer REFERENCES erp.users(id),
      is_blocked boolean NOT NULL DEFAULT false,
      block_reason text,
      blocked_by integer REFERENCES erp.users(id),
      updated_at timestamp NOT NULL DEFAULT now(),
      PRIMARY KEY (store_id, phone)
    );
    CREATE TABLE IF NOT EXISTS erp.web_order_access (
      order_id integer PRIMARY KEY REFERENCES erp.orders(id) ON DELETE CASCADE,
      store_id integer NOT NULL REFERENCES erp.stores(id),
      account_user_id integer REFERENCES erp.users(id),
      request_key text NOT NULL,
      request_hash text NOT NULL,
      token_hash text NOT NULL,
      UNIQUE (store_id, request_key)
    );
    CREATE INDEX IF NOT EXISTS web_customers_user_idx ON erp.web_customers(store_id, user_id);
  `);
}