import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import vm from "node:vm";
import { transformSync } from "esbuild";
import { and, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { transactionsTable } from "../../../../lib/erp-db/src/schema/erp";

// Run the real route bodies and Drizzle SQL against a disposable PostgreSQL
// cluster. Never read DATABASE_URL or connect to an existing tenant database.
// Requires initdb and pg_ctl on PATH; fail explicitly if they are unavailable.
const source = readFileSync(new URL("../routes/orders.ts", import.meta.url), "utf8");
type Query = Record<string, unknown>;
type Handler = (req: unknown, res: unknown) => Promise<void>;
type Expense = { id: number; amount: number; createdAt: string };
type Monthly = { month: string; totalExpenses: number; netProfit: number };
const handlers = new Map<string, Handler>();
let directory: string;
let pool: pg.Pool;
let started = false;
let queries = 0;

before(async () => {
  directory = mkdtempSync(join(tmpdir(), "erp-expense-reports-"));
  const data = join(directory, "data");
  execFileSync("initdb", ["-D", data, "-A", "trust", "-U", "expense_test", "--no-locale"], { stdio: "pipe" });
  // Unix socket only, no TCP port and no dependency on the app's PostgreSQL.
  execFileSync("pg_ctl", [
    "-D", data, "-l", join(directory, "postgres.log"),
    "-o", `-F -c listen_addresses='' -k ${directory}`, "-w", "start",
  ], { stdio: "pipe" });
  started = true;
  pool = new pg.Pool({ host: directory, user: "expense_test", database: "postgres", max: 1 });
  await pool.query("SET TIME ZONE 'UTC'");
  await pool.query(`
    CREATE TABLE transactions (
      id integer PRIMARY KEY, store_id integer NOT NULL, type text NOT NULL,
      category text NOT NULL, amount numeric(10,2) NOT NULL,
      description text NOT NULL, reference text, created_at timestamp NOT NULL
    );
    CREATE TABLE orders (id integer, store_id integer, status text, total_amount numeric, created_at timestamp);
    CREATE TABLE order_items (order_id integer, product_id integer, quantity numeric, cost_price numeric);
    CREATE TABLE bon_retours (id integer, store_id integer, original_order_id integer, created_at timestamp);
    CREATE TABLE bon_retour_items (bon_retour_id integer, product_id integer, quantity numeric, unit_price numeric);
    CREATE TABLE products (id integer, cost_price numeric);
  `);
  const fixtures = [
    // Start/end instants, including exact next-month midnight.
    [1, 1, "expense", "rent", "999.00", null, "2026-01-09 23:59:59.999999"],
    [2, 1, "expense", "rent", "100.10", null, "2026-01-10 00:00:00"],
    [3, 1, "expense", "utilities", "20.20", "BILL-1", "2026-01-31 23:59:59.999999"],
    [4, 1, "expense", "rent", "7.30", null, "2026-02-01 00:00:00"],
    [5, 1, "expense", "other", "3.40", "", "2026-02-05 23:59:59.999999"],
    [6, 1, "expense", "other", "888.00", null, "2026-02-06 00:00:00"],
    // Inventory exclusion must work independently of reference.
    [10, 1, "expense", "purchase", "1000.00", null, "2026-01-15 12:00:00"],
    [11, 1, "expense", "purchase", "2000.00", "LEGACY-1", "2026-01-15 12:00:00"],
    [12, 1, "expense", "other", "3000.00", "PO-42", "2026-01-15 12:00:00"],
    [13, 1, "expense", "other", "4000.00", "RETOUR-42", "2026-01-15 12:00:00"],
    [14, 1, "income", "other", "5000.00", null, "2026-01-15 12:00:00"],
    // Identical dates/categories in another store must never affect store 1.
    [20, 2, "expense", "rent", "600.60", null, "2026-01-10 00:00:00"],
    [21, 2, "expense", "utilities", "60.06", "BILL-2", "2026-02-05 12:00:00"],
    [22, 2, "expense", "other", "700.00", "RETOUR-99", "2026-01-15 12:00:00"],
    // Leap day and year rollover.
    [30, 1, "expense", "rent", "10.01", null, "2024-02-29 00:00:00"],
    [31, 1, "expense", "rent", "20.02", null, "2024-02-29 23:59:59.999999"],
    [32, 1, "expense", "rent", "40.04", null, "2024-03-01 00:00:00"],
    [40, 1, "expense", "rent", "50.05", null, "2025-12-31 23:59:59.999999"],
    [41, 1, "expense", "rent", "60.06", null, "2026-01-01 00:00:00"],
  ];
  for (const row of fixtures) {
    await pool.query(
      "INSERT INTO transactions VALUES ($1,$2,$3,$4,$5,'Expense fixture',$6,$7)",
      row,
    );
  }
  const db = drizzle(pool);
  const noop = () => undefined;
  const context = {
    router: { get: (path: string, ...args: unknown[]) => handlers.set(path, args.at(-1) as Handler) },
    authenticate: noop, requireTenantAdmin: noop, requireStore: noop,
    and, desc, eq, sql, schema: { transactionsTable },
    db: {
      select: (...args: Parameters<typeof db.select>) => { queries++; return db.select(...args); },
      execute: (...args: Parameters<typeof db.execute>) => { queries++; return db.execute(...args); },
    },
  };
  for (const path of ["/admin/reports/expenses", "/admin/reports/monthly"]) {
    const start = source.indexOf(`router.get("${path}"`);
    assert.notEqual(start, -1, `missing route ${path}`);
    const nextRoute = source.indexOf("\nrouter.", start + 1);
    const end = nextRoute < 0 ? source.indexOf("\nexport default", start) : nextRoute;
    assert.ok(end > start);
    vm.runInNewContext(transformSync(source.slice(start, end), { loader: "ts" }).code, context);
  }
});

after(async () => {
  try {
    await pool?.end();
  } finally {
    if (started) execFileSync("pg_ctl", ["-D", join(directory, "data"), "-m", "immediate", "-w", "stop"], { stdio: "pipe" });
    if (directory) rmSync(directory, { recursive: true, force: true });
  }
});

async function request<T>(path: string, query: Query, storeId = 1) {
  let status = 200;
  let body: T | undefined;
  const res = {
    status: (value: number) => { status = value; return res; },
    json: (value: T) => { body = value; },
  };
  await handlers.get(`/admin/reports/${path}`)!({
    currentStoreId: storeId, query,
    log: { error: (error: unknown) => { throw error; } },
  }, res);
  // Remove VM realm prototypes so assertions compare normal JSON responses.
  return { status, body: JSON.parse(JSON.stringify(body)) as T };
}

async function details(from: string, to: string, storeId = 1, extra: Query = {}) {
  const result = await request<Expense[]>("expenses", { from, to, ...extra }, storeId);
  assert.equal(result.status, 200);
  return result.body;
}

async function reconcile(from: string, to: string, storeId: number, expected: Record<string, number>) {
  const monthly = await request<Monthly[]>("monthly", { from, to }, storeId);
  assert.equal(monthly.status, 200);
  assert.deepEqual(Object.fromEntries(monthly.body.map((row) => [row.month, row.totalExpenses])), expected);
  for (const row of monthly.body) {
    const [year, month] = row.month.split("-").map(Number);
    const first = `${row.month}-01`;
    const last = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
    const items = await details(from > first ? from : first, to < last ? to : last, storeId);
    const cents = items.reduce((sum, item) => sum + Math.round(item.amount * 100), 0);
    assert.equal(cents, Math.round(row.totalExpenses * 100), `Charges mismatch for ${row.month}, store ${storeId}`);
    assert.ok(items.every((item) => item.createdAt.startsWith(row.month)));
    assert.equal(row.netProfit, -row.totalExpenses, "expense-only months remain visible without sales");
  }
}

test("partial multi-month periods reconcile each month's Charges with its items", async () => {
  await reconcile("2026-01-10", "2026-02-05", 1, { "2026-01": 120.30, "2026-02": 10.70 });
});

test("full months do not include midnight from the following month", async () => {
  await reconcile("2026-01-01", "2026-01-31", 1, { "2026-01": 1179.36 });
  assert.deepEqual((await details("2026-01-10", "2026-01-31")).map((item) => item.id), [3, 2]);
});

test("one-day periods include both ends of that day, not the following midnight", async () => {
  await reconcile("2026-02-05", "2026-02-05", 1, { "2026-02": 3.40 });
  assert.deepEqual((await details("2026-02-05", "2026-02-05")).map((item) => item.id), [5]);
});

test("inventory, PO receipts, refunds and income are excluded independently", async () => {
  assert.deepEqual((await details("2026-01-10", "2026-02-05")).map((item) => item.id), [5, 4, 3, 2]);
});

test("current store is authoritative even when query parameters request another store", async () => {
  await reconcile("2026-01-10", "2026-02-05", 2, { "2026-01": 600.60, "2026-02": 60.06 });
  assert.deepEqual((await details("2026-01-10", "2026-02-05", 1, { storeId: "2" })).map((item) => item.id), [5, 4, 3, 2]);
  const monthly = await request<Monthly[]>("monthly", {
    from: "2026-01-10", to: "2026-02-05", storeId: "2",
  }, 1);
  assert.equal(monthly.body[0].totalExpenses, 120.30);
  assert.deepEqual(await details("2026-01-10", "2026-02-05", 999), []);
});

test("empty periods and excluded-only days return no expenses or monthly Charges", async () => {
  for (const date of ["2026-01-15", "2026-06-01"]) {
    assert.deepEqual(await details(date, date), []);
    await reconcile(date, date, 1, {});
  }
});

test("leap days and December/January boundaries reconcile without spillover", async () => {
  await reconcile("2024-02-29", "2024-03-01", 1, { "2024-02": 30.03, "2024-03": 40.04 });
  await reconcile("2025-12-31", "2026-01-01", 1, { "2025-12": 50.05, "2026-01": 60.06 });
});

test("invalid, missing, reversed and repeated dates are rejected before querying", async () => {
  for (const query of [
    {}, { from: "2026-01-01" }, { to: "2026-01-31" },
    { from: "2026-02-30", to: "2026-03-01" },
    { from: "2025-02-29", to: "2025-03-01" },
    { from: "2026-01-02", to: "2026-01-01" },
    { from: "2026-1-01", to: "2026-01-31" },
    { from: ["2026-01-01", "2026-02-01"], to: "2026-02-28" },
    { from: "2026-01-01' OR 1=1 --", to: "2026-01-31" },
  ]) {
    const before = queries;
    const result = await request<{ error: string }>("expenses", query);
    assert.equal(result.status, 400);
    assert.equal(result.body.error, "Valid from and to dates are required");
    assert.equal(queries, before);
  }
});
