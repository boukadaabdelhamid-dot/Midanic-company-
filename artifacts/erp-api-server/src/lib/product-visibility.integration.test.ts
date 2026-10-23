import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { eq } from "drizzle-orm";

// Fixtures are isolated in a new development/test store; existing products are never edited.
if (process.env["NODE_ENV"] === "production") {
  throw new Error("Product visibility fixtures must not run in production");
}
const databaseUrl = process.env["ERP_TEST_DATABASE_URL"] ?? process.env["DATABASE_URL"];
if (databaseUrl) process.env["DATABASE_URL"] = databaseUrl;
process.env["NODE_ENV"] = "test";

test("storefront visibility, complete pagination, and ERP toggles", {
  skip: !databaseUrl,
}, async () => {
  const [{ default: app }, { db, pool, schema }, { signToken }] = await Promise.all([
    import("../app"),
    import("./db"),
    import("./auth"),
  ]);
  const suffix = randomUUID();
  const slug = `visibility-test-${suffix}`;
  const factorySlug = `factory-visibility-${suffix}`;
  let storeId: number | undefined;
  let factoryStoreId: number | undefined;
  let userId: number | undefined;
  let customerUserId: number | undefined;
  const server = createServer(app);
  try {
    const [store] = await db.insert(schema.storesTable).values({
      nameAr: "اختبار الظهور",
      nameEn: "Visibility fixture",
      slug,
      isActive: true,
    }).returning();
    storeId = store.id;
    const [factoryStore] = await db.insert(schema.storesTable).values({
      nameAr: "وحدة إنتاج للاختبار",
      nameEn: "Factory visibility fixture",
      slug: factorySlug,
      kind: "factory",
      isActive: true,
    }).returning();
    factoryStoreId = factoryStore.id;
    const [user] = await db.insert(schema.usersTable).values({
      name: "Visibility fixture",
      email: `visibility-${suffix}@example.test`,
      passwordHash: "test-fixture-not-a-login",
      role: "admin",
    }).returning();
    userId = user.id;
    await db.insert(schema.userStoresTable).values({ userId, storeId });
    const [customer] = await db.insert(schema.usersTable).values({
      name: "Visibility customer fixture",
      email: `visibility-customer-${suffix}@example.test`,
      passwordHash: "test-fixture-not-a-login",
      role: "customer",
    }).returning();
    customerUserId = customer.id;
    await db.insert(schema.userStoresTable).values({ userId: customer.id, storeId });
    const products = await db.insert(schema.productsTable).values(
      Array.from({ length: 28 }, (_, index) => ({
        storeId: store.id,
        nameEn: `Visibility fixture ${index}`,
        nameAr: `اختبار ${index}`,
        price: "10.00",
        isExposed: index < 26,
      })),
    ).returning();
    const hidden = products[27];
    const exposed = products[0];
    const factoryProducts = await db.insert(schema.productsTable).values([
      {
        storeId: factoryStore.id,
        nameEn: "Private raw material",
        nameAr: "مادة أولية داخلية",
        price: "10.00",
        stock: 4,
        manufacturingRole: "raw_material",
        isExposed: true,
      },
      {
        storeId: factoryStore.id,
        nameEn: "Factory finished good",
        nameAr: "منتج جاهز",
        price: "25.00",
        stock: 3,
        manufacturingRole: "finished_good",
        isExposed: true,
      },
    ]).returning();

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const base = `http://127.0.0.1:${address.port}/api`;
    const headers = { "X-Store-Slug": slug };
    const staffHeaders = {
      ...headers,
      Authorization: `Bearer ${signToken({ id: user.id, email: user.email, role: "tenant_admin", currentStoreId: store.id })}`,
    };
    const customerHeaders = {
      ...headers,
      Authorization: `Bearer ${signToken({ id: customer.id, email: customer.email, role: "customer", currentStoreId: store.id })}`,
    };
    const list = async (query: string, requestHeaders = headers) => {
      const response = await fetch(`${base}/products?${query}`, { headers: requestHeaders });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("cache-control"), "no-store");
      return response.json() as Promise<{
        total: number; products: { id: number; isExposed: boolean }[];
      }>;
    };
    const first = await list("page=1&limit=24");
    const second = await list("page=2&limit=24");
    assert.equal(first.total, 26);
    assert.equal(first.products.length, 24);
    assert.equal(second.total, 26);
    assert.equal(second.products.length, 2);
    assert.equal(new Set([...first.products, ...second.products].map((p) => p.id)).size, 26);
    assert.ok([...first.products, ...second.products].every((p) => p.isExposed));
    assert.equal((await list("limit=100&filterExposed=false")).total, 26);
    assert.equal((await list("limit=100&filterExposed=false", customerHeaders)).total, 26);
    assert.equal((await list("limit=100", staffHeaders)).total, 28);
    assert.equal((await list("filterExposed=false", staffHeaders)).total, 2);
    for (const requestHeaders of [headers, customerHeaders]) {
      const response = await fetch(`${base}/products/${hidden.id}`, { headers: requestHeaders });
      assert.equal(response.status, 404);
    }
    assert.equal((await fetch(`${base}/products/${hidden.id}`, { headers: staffHeaders })).status, 200);
    const factoryHeaders = { "X-Store-Slug": factorySlug };
    const factoryListResponse = await fetch(`${base}/products?limit=100`, { headers: factoryHeaders });
    assert.equal(factoryListResponse.status, 200);
    const factoryList = await factoryListResponse.json() as { total: number; products: { id: number }[] };
    assert.equal(factoryList.total, 1);
    assert.deepEqual(factoryList.products.map((p) => p.id), [factoryProducts[1].id]);
    assert.equal((await fetch(`${base}/products/${factoryProducts[0].id}`, { headers: factoryHeaders })).status, 404);
    assert.equal((await fetch(`${base}/products/${factoryProducts[1].id}`, { headers: factoryHeaders })).status, 200);
    const factoryCustomerHeaders = {
      Authorization: `Bearer ${signToken({
        id: customer.id,
        email: customer.email,
        role: "customer",
        currentStoreId: factoryStore.id,
      })}`,
    };
    await db.insert(schema.cartItemsTable).values({
      userId: customer.id,
      productId: factoryProducts[0].id,
      quantity: 1,
      storeId: factoryStore.id,
    });
    const cartResponse = await fetch(`${base}/cart`, { headers: factoryCustomerHeaders });
    assert.equal(cartResponse.status, 200);
    assert.deepEqual(await cartResponse.json(), []);
    const addRawMaterial = await fetch(`${base}/cart`, {
      method: "POST",
      headers: { ...factoryCustomerHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ productId: factoryProducts[0].id, quantity: 1 }),
    });
    assert.equal(addRawMaterial.status, 404);
    for (const visible of [false, true]) {
      const response = await fetch(`${base}/products/${exposed.id}`, {
        method: "PUT",
        headers: { ...staffHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ isExposed: visible }),
      });
      assert.equal(response.status, 200);
      const saved = await response.json() as { isExposed: boolean };
      assert.equal(saved.isExposed, visible);
      assert.equal((await list("limit=100")).total, visible ? 26 : 25);
      assert.equal(
        (await fetch(`${base}/products/${exposed.id}`, { headers })).status,
        visible ? 200 : 404,
      );
    }
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    try {
      if (storeId) {
        await db.delete(schema.productsTable).where(eq(schema.productsTable.storeId, storeId));
        await db.delete(schema.userStoresTable).where(eq(schema.userStoresTable.storeId, storeId));
        await db.delete(schema.storesTable).where(eq(schema.storesTable.id, storeId));
      }
      if (factoryStoreId) {
        await db.delete(schema.cartItemsTable).where(eq(schema.cartItemsTable.storeId, factoryStoreId));
        await db.delete(schema.productsTable).where(eq(schema.productsTable.storeId, factoryStoreId));
        await db.delete(schema.storesTable).where(eq(schema.storesTable.id, factoryStoreId));
      }
      if (userId) await db.delete(schema.usersTable).where(eq(schema.usersTable.id, userId));
      if (customerUserId) await db.delete(schema.usersTable).where(eq(schema.usersTable.id, customerUserId));
    } finally {
      await pool.end();
    }
  }
});
