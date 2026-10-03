import { readFile, writeFile } from "node:fs/promises";
import { seedWebOrderFixture, cleanWebOrderFixture } from "../artifacts/erp-api-server/src/lib/web-order-fixture";
import { pool } from "../artifacts/erp-api-server/src/lib/db";
const path = "/tmp/web-checkout-fixture.json";
if (process.argv.includes("--cleanup")) {
  await cleanWebOrderFixture(JSON.parse(await readFile(path, "utf8")));
  console.log("Development checkout fixtures removed");
} else {
  await writeFile(path, JSON.stringify(await seedWebOrderFixture()), { mode: 0o600 });
  console.log(`Development checkout fixtures saved to ${path}`);
}
await pool.end();