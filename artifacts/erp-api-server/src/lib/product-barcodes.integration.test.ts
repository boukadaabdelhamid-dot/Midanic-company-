import { strict as assert } from "node:assert";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { and, eq, inArray } from "drizzle-orm";
import { db, pool, schema } from "./db";
import { addBarcodeToProductCopies, removeBarcodeFromProductCopies } from "./product-barcodes";
import { resolveSharedCatalogProductCopies } from "./shared-product-catalog";
import { runSharedProductCatalogMigration } from "./shared-product-catalog-migration";

test("shared barcodes are store-scoped, atomic, and exclude factory copies", {
  skip: process.env.ERP_BARCODE_DB_TEST !== "1",
}, async () => {
  assert.notEqual(process.env.NODE_ENV, "production", "Run this fixture test only in development");
  const marker = `barcode-test-${randomUUID()}`;
  const storeIds: number[] = [];
  const productIds: number[] = [];
  try {
    await runSharedProductCatalogMigration(pool);
    const stores = await db.insert(schema.storesTable).values(
      ["a", "b", "c", "factory"].map((suffix) => ({
        nameAr: marker, nameEn: marker, slug: `${marker}-${suffix}`,
        platformTenantId: 2_000_000_000, kind: suffix === "factory" ? "factory" : "store",
      })),
    ).returning();
    storeIds.push(...stores.map((store) => store.id));
    const primary = `${marker}-primary`;
    const products = await db.insert(schema.productsTable).values(stores.map((store, index) => ({
      storeId: store.id, nameAr: marker, nameEn: marker, price: "1.00",
      barcode: index === 2 ? `${marker}-other` : primary,
    }))).returning();
    productIds.push(...products.map((product) => product.id));
    const resolved = await resolveSharedCatalogProductCopies({
      productId: products[0].id, storeId: stores[0].id,
      tenantId: 2_000_000_000, sharedCatalogId: null, barcode: primary,
    });
    assert.equal(resolved.ambiguous, false);
    assert.deepEqual([...resolved.productIds].sort((a, b) => a - b), [products[0].id, products[1].id].sort((a, b) => a - b));
    const [factory] = await db.select().from(schema.productsTable).where(eq(schema.productsTable.id, products[3].id));
    assert.equal(factory.sharedCatalogId, null);

    const barcode = `${marker}-extra`;
    const added = await addBarcodeToProductCopies(resolved.productIds, products[0].id, barcode);
    assert.equal(added.ok, true);
    assert.equal(added.ok && added.synchronizedStores, 2);
    const repeated = await addBarcodeToProductCopies(resolved.productIds, products[1].id, barcode);
    assert.equal(repeated.ok, true);
    const copiedRows = await db.select().from(schema.productBarcodesTable)
      .where(and(inArray(schema.productBarcodesTable.productId, resolved.productIds), eq(schema.productBarcodesTable.barcode, barcode)));
    assert.equal(copiedRows.length, 2, "Repeated adds do not create duplicates");

    const unrelated = await addBarcodeToProductCopies([products[2].id], products[2].id, barcode);
    assert.equal(unrelated.ok, true, "The same code is allowed in a different store");
    await removeBarcodeFromProductCopies(resolved.productIds, barcode);
    const remaining = await db.select().from(schema.productBarcodesTable).where(eq(schema.productBarcodesTable.barcode, barcode));
    assert.deepEqual(remaining.map((row) => row.productId), [products[2].id]);

    const conflictingPrimary = `${marker}-primary-conflict`;
    const [blocker] = await db.insert(schema.productsTable).values({
      storeId: stores[1].id, nameAr: marker, nameEn: marker, price: "1.00", barcode: conflictingPrimary,
    }).returning();
    productIds.push(blocker.id);
    const blocked = await addBarcodeToProductCopies(resolved.productIds, products[0].id, conflictingPrimary);
    assert.equal(blocked.ok, false);
    const noPartialRows = await db.select().from(schema.productBarcodesTable)
      .where(eq(schema.productBarcodesTable.barcode, conflictingPrimary));
    assert.equal(noPartialRows.length, 0, "A target conflict leaves every copy unchanged");

    const conflictingExtra = `${marker}-extra-conflict`;
    await addBarcodeToProductCopies([blocker.id], blocker.id, conflictingExtra);
    const blockedExtra = await addBarcodeToProductCopies(resolved.productIds, products[0].id, conflictingExtra);
    assert.equal(blockedExtra.ok, false);
    const extras = await db.select().from(schema.productBarcodesTable)
      .where(eq(schema.productBarcodesTable.barcode, conflictingExtra));
    assert.deepEqual(extras.map((row) => row.productId), [blocker.id]);
  } finally {
    if (productIds.length) await db.delete(schema.productsTable).where(inArray(schema.productsTable.id, productIds));
    if (storeIds.length) await db.delete(schema.storesTable).where(inArray(schema.storesTable.id, storeIds));
    await pool.end();
  }
});
