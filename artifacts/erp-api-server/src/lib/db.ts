import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@workspace/erp-db/schema";

const pool = new Pool({
  connectionString: process.env["DATABASE_URL"],
  options: "-c search_path=erp,public",
});

export const db = drizzle(pool, { schema });
export { schema, pool };
