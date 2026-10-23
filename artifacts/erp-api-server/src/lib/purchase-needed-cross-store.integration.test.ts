import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { eq, inArray } from "drizzle-orm";

if (process.env["NODE_ENV"] === "production") {
  throw new Error("Purchase-needed fixtures must not run in production");
}
const databaseUrl = process.env["ERP_TEST_DATABASE_URL"] ?? process.env["DATABASE_URL"];
if (databaseUrl) process.env["DATABASE_URL"] = databaseUrl;
process.env["NODE_ENV"] = "test";

test("smart purchase suppresses products stocked at another active company store", {
  skip: !databaseUrl,
}, async () => {
  const [{ default: app }, { db, pool, schema }, { signToken }] = await Promise.all([
    import("../app"),
    import("./db"),
    import("./auth"),
  ]);
  const suffix = randomUUID();
  const companyTenantId = 1_900_000_000;
  const otherTenantId = companyTenantId - 1;
  const storeSlugs = ["target", "source", "factory", "other-company"].map((part) => `purchase-check-${suffix}-${part}`);
  const stores: Array<{ id: number }> = [];
  const productIds: number[] = [];
  let userId: number | undefined;
  const server = createServer(app);

  try {
    const insertedStores = await db.insert(schema.storesTable).values([
      { nameAr: suffix, nameEn: suffix, slug: storeSlugs[0]!, platformTenantId: companyTenantId, kind: "store" },
      { nameAr: suffix, nameEn: suffix, slug: storeSlugs[1]!, platformTenantId: companyTenantId, kind: "store" },
      { nameAr: suffix, nameEn: suffix, slug: storeSlugs[2]!, platformTenantId: companyTenantId, kind: "factory" },
      { nameAr: suffix, nameEn: suffix, slug: storeSlugs[3]!, platformTenantId: otherTenantId, kind: "store" },
    ]).returning();
    stores.push(...insertedStores);
    const [target, source, factory, otherCompany] = insertedStores;
    assert.ok(target && source && factory && otherCompany);

    const [user] = await db.insert(schema.usersTable).values({
      name: "Purchase check",
      email: `purchase-check-${suffix}@example.test`,
      passwordHash: "test-fixture-not-a-login",
      role: "admin",
    }).returning();
    userId = user.id;
    await db.insert(schema.userStoresTable).values({ userId, storeId: target.id });

    const sharedId = `purchase-check-shared-${suffix}`;
    const entries = [
      {
        key: "shared-catalog-id", storeId: target.id, name: "Shared item",
        barcode: "SHARED-TARGET", reference: "SHARED-TARGET-REF", sharedCatalogId: sharedId,
      },
      {
        key: "same-reference", storeId: target.id, name: "Reference item",
        barcode: "REFERENCE-TARGET", reference: "DUPLICATE-REF",
      },
      {
        key: "same-primary-barcode", storeId: target.id, name: "Barcode item",
        barcode: "PRIMARY-CODE", reference: null,
      },
      {
        key: "same-extra-barcode", storeId: target.id, name: "Extra barcode item",
        barcode: "EXTRA-TARGET", reference: null,
      },
      {
        key: "other-store-out-of-stock", storeId: target.id, name: "Out of stock elsewhere",
        barcode: "OUT-OF-STOCK-CODE", reference: null,
      },
      {
        key: "factory-only-stock", storeId: target.id, name: "Factory-only match",
        barcode: "FACTORY-CODE", reference: null,
      },
      {
        key: "other-company-stock", storeId: target.id, name: "Other company match",
        barcode: "OTHER-COMPANY-CODE", reference: null,
      },
      {
        key: "no-other-stock", storeId: target.id, name: "No match",
        barcode: "NO-MATCH-CODE", reference: null,
      },
      {
        key: "shared-catalog-copy", storeId: source.id, name: "Shared copy",
        barcode: "DIFFERENT-BARCODE", reference: "DIFFERENT-REF", sharedCatalogId: sharedId, stock: 8,
      },
      {
        key: "same-reference-copy", storeId: source.id, name: "Reference copy",
        barcode: "REFERENCE-SOURCE", reference: "DUPLICATE-REF", stock: 6,
      },
      {
        key: "same-primary-barcode-copy", storeId: source.id, name: "Barcode copy",
        barcode: "PRIMARY-CODE", reference: "OTHER-REF", stock: 4,
      },
      {
        key: "same-extra-barcode-copy", storeId: source.id, name: "Extra barcode copy",
        barcode: "EXTRA-SOURCE", reference: "EXTRA-REF", stock: 9,
      },
      {
        key: "other-store-out-of-stock-copy", storeId: source.id, name: "Out of stock copy",
        barcode: "OUT-OF-STOCK-CODE", reference: null, stock: 0,
      },
      {
        key: "factory-stock-copy", storeId: factory.id, name: "Factory copy",
        barcode: "FACTORY-CODE", reference: null, stock: 5,
      },
      {
        key: "other-company-copy", storeId: otherCompany.id, name: "Other company copy",
        barcode: "OTHER-COMPANY-CODE", reference: null, stock: 7,
      },
    ];
    const products = await db.insert(schema.productsTable).values(entries.map((entry) => ({
      storeId: entry.storeId,
      nameEn: entry.name,
      nameAr: entry.name,
      price: "20.00",
      stock: "stock" in entry ? entry.stock! : 0,
      minStock: 5,
      barcode: entry.barcode,
      reference: entry.reference,
      sharedCatalogId: "sharedCatalogId" in entry ? entry.sharedCatalogId : null,
      isActive: true,
      excludedFromPurchase: false,
    }))).returning({ id: schema.productsTable.id });
    productIds.push(...products.map((product) => product.id));
    const idByKey = new Map(entries.map((entry, index) => [entry.key, products[index]!.id]));

    const targetExtra = idByKey.get("same-extra-barcode");
    const sourceExtra = idByKey.get("same-extra-barcode-copy");
    assert.ok(targetExtra && sourceExtra);
    await db.insert(schema.productBarcodesTable).values([
      { productId: targetExtra, storeId: target.id, barcode: "LINKED-EXTRA-CODE" },
      { productId: sourceExtra, storeId: source.id, barcode: "LINKED-EXTRA-CODE" },
    ]);

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const token = signToken({
      id: user.id,
      email: user.email,
      role: "admin",
      currentStoreId: target.id,
    });
    const response = await fetch(`http://127.0.0.1:${address.port}/api/erp/purchases/needed?limit=500`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Store-Slug": target.slug,
      },
    });
    const responseText = await response.text();
    assert.equal(response.status, 200, responseText);
    const data = JSON.parse(responseText) as { rows: Array<{ id: number }> };
    const suggestedIds = new Set(data.rows.map((row) => row.id));

    for (const key of [
      "shared-catalog-id",
      "same-reference",
      "same-primary-barcode",
      "same-extra-barcode",
    ]) {
      assert.equal(suggestedIds.has(idByKey.get(key)!), false, `${key} should be sourced from the other store`);
    }
    for (const key of ["other-store-out-of-stock", "factory-only-stock", "other-company-stock", "no-other-stock"]) {
      assert.equal(suggestedIds.has(idByKey.get(key)!), true, `${key} should remain a purchase need`);
    }
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (productIds.length) {
      await db.delete(schema.productBarcodesTable).where(inArray(schema.productBarcodesTable.productId, productIds));
      await db.delete(schema.productsTable).where(inArray(schema.productsTable.id, productIds));
    }
    if (userId) {
      await db.delete(schema.userStoresTable).where(eq(schema.userStoresTable.userId, userId));
      await db.delete(schema.usersTable).where(eq(schema.usersTable.id, userId));
    }
    if (stores.length) await db.delete(schema.storesTable).where(inArray(schema.storesTable.id, stores.map((store) => store.id)));
    await pool.end();
  }
});
