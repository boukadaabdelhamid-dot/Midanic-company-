import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { normalizeCustomerPhone } from "./customer-phone";
import { db, pool, schema } from "./db";
import app from "../app";
import { seedWebOrderFixture, cleanWebOrderFixture } from "./web-order-fixture";
const json = async (response: Response): Promise<any> => response.json();

test("phone identity normalizes international, local and Arabic-digit mobile formats", () => {
  for (const phone of ["0555 123 456", "+213 555 123456", "00213-555-123456", "٠٥٥٥١٢٣٤٥٦", "۰۵۵۵۱۲۳۴۵۶", "+213 (0)555123456"]) {
    assert.equal(normalizeCustomerPhone(phone), "213555123456");
  }
  for (const phone of ["", "abc0555123456", "+", "123", "1".repeat(16)]) assert.equal(normalizeCustomerPhone(phone), null);
});

test("guest checkout, identity blocking and store isolation", { skip: !process.env.DATABASE_URL }, async t => {
  const f = await seedWebOrderFixture();
  const server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}/api`;
  const headers = { "Content-Type": "application/json", "X-Store-Slug": f.store.slug };
  const staffHeaders = { ...headers, Authorization: `Bearer ${f.staffToken}`, "X-Store-Id": String(f.store.id) };
  const payload = (phone = "0555123456", quantity = 2) => ({
    customerName: "Guest buyer", customerPhone: phone, customerAddress: "Development test address only",
    items: [{ productId: f.product, quantity }], requestKey: randomUUID(),
  });
  const post = (body: unknown, extra: Record<string, string> = {}) => fetch(`${base}/orders`,
    { method: "POST", headers: { ...headers, ...extra }, body: JSON.stringify(body) });
  let first: { id: number; trackingToken: string };
  let customerId: number;
  try {
    await t.test("anonymous order creates a CRM identity, uses authoritative prices, and retries exactly once", async () => {
      const body = payload();
      const response = await post({ ...body, totalAmount: "0.01", userId: f.staff });
      assert.equal(response.status, 201, await response.clone().text());
      const order = await json(response);
      first = order;
      assert.equal(order.totalAmount, "5000.00");
      const replay = await post(body);
      assert.equal(replay.status, 200);
      assert.equal((await json(replay)).id, order.id);
      assert.equal((await db.select().from(schema.productsTable).where(eq(schema.productsTable.id, f.product)))[0].stock, 28);
      const [record] = await db.select().from(schema.webCustomersTable)
        .where(and(eq(schema.webCustomersTable.storeId, f.store.id), eq(schema.webCustomersTable.phone, "213555123456")));
      assert.ok(record.userId);
      customerId = record.userId;
      const profile = await db.select().from(schema.customerProfilesTable).where(and(
        eq(schema.customerProfilesTable.userId, customerId), eq(schema.customerProfilesTable.storeId, f.store.id)));
      assert.equal(profile.length, 1);
      const conflict = await post({ ...body, customerName: "Different request" });
      assert.equal(conflict.status, 409);
    });
    await t.test("order detail requires its private token; another store cannot use it", async () => {
      assert.equal((await fetch(`${base}/orders/${first.id}`, { headers })).status, 404);
      assert.equal((await fetch(`${base}/orders/${first.id}`, { headers: { ...headers, "X-Order-Token": first.trackingToken } })).status, 200);
      assert.equal((await fetch(`${base}/orders/${first.id}`, { headers: {
        ...headers, "X-Store-Slug": f.otherStore.slug, "X-Order-Token": first.trackingToken,
      } })).status, 404);
      assert.equal((await fetch(`${base}/orders`, { headers })).status, 401);
      assert.equal((await fetch(`${base}/orders/${first.id}`, { headers: staffHeaders })).status, 200);
    });
    await t.test("ERP registry searches phone/name and exposes the linked customer", async () => {
      for (const search of ["Guest buyer", "0555123456"]) {
        const response = await fetch(`${base}/erp/web-customers?search=${encodeURIComponent(search)}`, { headers: staffHeaders });
        assert.equal(response.status, 200);
        const rows = await json(response);
        assert.equal(rows[0].customerId, customerId);
      }
      const standard = await fetch(`${base}/erp/customers?search=Guest%20buyer`, { headers: staffHeaders });
      assert.equal(standard.status, 200);
      assert.equal((await json(standard)).data[0].id, customerId);
    });
    await t.test("blocking customer or an unknown phone prevents orders; unblocking restores access", async () => {
      const block = (body: unknown, custom: Record<string, string> = staffHeaders) => fetch(`${base}/erp/web-customers`,
        { method: "PUT", headers: custom, body: JSON.stringify(body) });
      assert.equal((await block({ customerId, isBlocked: true, reason: "Test only" })).status, 200);
      assert.equal((await post(payload("+213555123456"))).status, 403);
      assert.equal((await block({ customerId, isBlocked: false })).status, 200);
      assert.equal((await post(payload("٠٥٥٥١٢٣٤٥٦", 1))).status, 201);
      assert.equal((await block({ phone: "0666123456", isBlocked: true })).status, 200);
      assert.equal((await post(payload("+213666123456"))).status, 403);
      assert.equal((await block({ customerId, isBlocked: true }, { ...staffHeaders, Authorization: `Bearer ${f.otherStaffToken}` })).status, 404);
      assert.equal((await block({ phone: "0555123456", isBlocked: true }, { ...headers, Authorization: `Bearer ${f.buyerToken}` })).status, 403);
      assert.equal((await fetch(`${base}/erp/web-customers`, { headers })).status, 401);
    });
    await t.test("same names do not merge distinct phone identities; registered ownership is separate", async () => {
      const response = await post(payload("0777123456", 1), { Authorization: `Bearer ${f.buyerToken}` });
      assert.equal(response.status, 201);
      const owned = await json(response);
      const history = await fetch(`${base}/orders`, { headers: { ...headers, Authorization: `Bearer ${f.buyerToken}` } });
      const rows = await json(history);
      assert.equal(rows.length, 1);
      assert.equal(rows[0].id, owned.id);
      assert.equal((await fetch(`${base}/orders/${first.id}`, {
        headers: { ...headers, Authorization: `Bearer ${f.buyerToken}` },
      })).status, 404);
      const [newIdentity] = await db.select().from(schema.webCustomersTable).where(and(
        eq(schema.webCustomersTable.storeId, f.store.id), eq(schema.webCustomersTable.phone, "213777123456")));
      assert.notEqual(newIdentity.userId, customerId);
    });
    await t.test("server enforces stock, duplicate lines, invalid input and disabled orders atomically", async () => {
      assert.equal((await post({ ...payload("0777999999"), items: [
        { productId: f.product, quantity: 20 }, { productId: f.product, quantity: 20 },
      ] })).status, 409);
      assert.equal((await post({ ...payload(), customerAddress: "" })).status, 400);
      await db.insert(schema.storeWebSettingsTable).values({ storeId: f.store.id, acceptOrders: false });
      assert.equal((await post(payload("0777999999", 1))).status, 403);
      await db.update(schema.storeWebSettingsTable).set({ acceptOrders: true, minOrderAmount: "99999" })
        .where(eq(schema.storeWebSettingsTable.storeId, f.store.id));
      assert.equal((await post(payload("0777999999", 1))).status, 400);
      await db.update(schema.storeWebSettingsTable).set({ minOrderAmount: "0" }).where(eq(schema.storeWebSettingsTable.storeId, f.store.id));
    });
    await t.test("cancellation releases stock once and terminal states cannot be revived", async () => {
      const before = (await db.select().from(schema.productsTable).where(eq(schema.productsTable.id, f.product)))[0].stock;
      const cancel = () => fetch(`${base}/admin/orders/${first.id}/status`, {
        method: "PUT", headers: staffHeaders, body: JSON.stringify({ status: "cancelled" }),
      });
      assert.equal((await cancel()).status, 200);
      assert.equal((await cancel()).status, 200);
      const after = (await db.select().from(schema.productsTable).where(eq(schema.productsTable.id, f.product)))[0].stock;
      assert.equal(after, before + 2);
      assert.equal((await fetch(`${base}/admin/orders/${first.id}/status`, {
        method: "PUT", headers: staffHeaders, body: JSON.stringify({ status: "pending" }),
      })).status, 409);
    });
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    await cleanWebOrderFixture(f);
    await pool.end();
  }
});