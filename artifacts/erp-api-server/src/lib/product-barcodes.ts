import { and, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "./db";

export async function addBarcodeToProductCopies(productIds: number[], sourceProductId: number, barcode: string) {
  return db.transaction(async (tx) => {
    const lockKey = `erp:product-barcode:${barcode}`;
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`);
    const ids = [...new Set(productIds)];
    const targets = await tx.select({
      id: schema.productsTable.id,
      storeId: schema.productsTable.storeId,
    }).from(schema.productsTable).where(inArray(schema.productsTable.id, ids));
    if (targets.length !== ids.length || !targets.some((target) => target.id === sourceProductId)) {
      return { ok: false as const, code: "PRODUCT_COPY_MISSING" as const, storeId: null };
    }

    // Validate every copy before inserting anything, so a conflict cannot
    // leave the barcode saved in only some stores.
    for (const target of targets) {
      const [primary] = await tx.select({ id: schema.productsTable.id }).from(schema.productsTable)
        .where(and(
          eq(schema.productsTable.storeId, target.storeId),
          sql`trim(${schema.productsTable.barcode}) = ${barcode}`,
        )).limit(1);
      if (primary) return { ok: false as const, code: "PRODUCT_BARCODE_EXISTS" as const, storeId: target.storeId };
      const [extra] = await tx.select({ productId: schema.productBarcodesTable.productId })
        .from(schema.productBarcodesTable)
        .where(and(
          eq(schema.productBarcodesTable.storeId, target.storeId),
          eq(schema.productBarcodesTable.barcode, barcode),
        )).limit(1);
      if (extra && extra.productId !== target.id) {
        return { ok: false as const, code: "PRODUCT_BARCODE_EXISTS" as const, storeId: target.storeId };
      }
    }

    for (const target of targets) {
      await tx.insert(schema.productBarcodesTable)
        .values({ productId: target.id, storeId: target.storeId, barcode })
        .onConflictDoNothing({
          target: [schema.productBarcodesTable.storeId, schema.productBarcodesTable.barcode],
        });
    }
    const [row] = await tx.select().from(schema.productBarcodesTable)
      .where(and(
        eq(schema.productBarcodesTable.productId, sourceProductId),
        eq(schema.productBarcodesTable.barcode, barcode),
      )).limit(1);
    if (!row) throw new Error("Source barcode was not saved");
    return { ok: true as const, row, synchronizedStores: new Set(targets.map((target) => target.storeId)).size };
  });
}

export async function removeBarcodeFromProductCopies(productIds: number[], barcode: string) {
  return db.transaction(async (tx) => {
    const lockKey = `erp:product-barcode:${barcode}`;
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`);
    return tx.delete(schema.productBarcodesTable)
      .where(and(
        inArray(schema.productBarcodesTable.productId, productIds),
        eq(schema.productBarcodesTable.barcode, barcode),
      ))
      .returning({ id: schema.productBarcodesTable.id });
  });
}
