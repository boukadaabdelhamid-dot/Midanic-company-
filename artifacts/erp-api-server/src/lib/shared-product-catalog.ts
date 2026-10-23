import { randomUUID } from "node:crypto";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { db, schema } from "./db";

export type SharedProductImageInput = {
  url: string;
  sortOrder?: number;
  isPrimary?: boolean;
};

export type SharedCatalogSyncResult = {
  status: "synced" | "unlinked";
  updatedStores: number;
  failedStoreIds: number[];
  reason?: "missing_or_ambiguous_barcode";
};

const SHARED_PRODUCT_FIELDS = [
  "nameAr",
  "nameEn",
  "descriptionAr",
  "descriptionEn",
  "price",
  "imageUrl",
  "categoryId",
  "reference",
  "barcode",
  "costPrice",
  "catalogueType",
  "brand",
  "model",
  "color",
  "colisage",
  "unitSaleEnabled",
  "weight",
  "priceGros",
  "priceSemiGros",
  "priceMin",
  "catalogue1",
  "catalogue2",
  "catalogue3",
  "catalogue4",
  "catalogue5",
  "catalogue6",
  "isActive",
  "familyId",
  "brandId",
  "colorId",
  "excludedFromPurchase",
] as const;

const NUMERIC_FIELDS = new Set([
  "price",
  "costPrice",
  "colisage",
  "weight",
  "priceGros",
  "priceSemiGros",
  "priceMin",
  "categoryId",
  "familyId",
  "brandId",
  "colorId",
]);

function valuesEqual(field: string, left: unknown, right: unknown): boolean {
  if (left == null && right == null) return true;
  if (NUMERIC_FIELDS.has(field)) {
    if (left == null || right == null) return false;
    return Number(left) === Number(right);
  }
  return left === right;
}

export function changedSharedProductFields(
  current: typeof schema.productsTable.$inferSelect,
  updated: typeof schema.productsTable.$inferSelect,
  requestedFields: string[],
): string[] {
  const currentValues = current as unknown as Record<string, unknown>;
  const updatedValues = updated as unknown as Record<string, unknown>;
  return SHARED_PRODUCT_FIELDS.filter((field) =>
    requestedFields.includes(field) && !valuesEqual(field, currentValues[field], updatedValues[field]),
  );
}

export function hasSharedCatalogProductChanges(requestedFields: string[]): boolean {
  return SHARED_PRODUCT_FIELDS.some((field) => requestedFields.includes(field));
}

export function isSafeLegacyCatalogMatchGroup(
  matches: ReadonlyArray<{ storeId: number; sharedCatalogId: string | null }>,
): boolean {
  if (matches.length < 2) return false;
  if (new Set(matches.map((match) => match.storeId)).size !== matches.length) return false;
  return new Set(matches.map((match) => match.sharedCatalogId).filter((id): id is string => Boolean(id))).size <= 1;
}

export async function syncProductImages(productId: number, inputs: SharedProductImageInput[]) {
  const normalized = inputs
    .filter((image) => typeof image?.url === "string" && image.url.trim())
    .map((image, index) => ({
      url: image.url.trim(),
      sortOrder: image.sortOrder ?? index,
      isPrimary: image.isPrimary === true,
    }));
  if (normalized.length && !normalized.some((image) => image.isPrimary)) normalized[0].isPrimary = true;
  await db.delete(schema.productImagesTable).where(eq(schema.productImagesTable.productId, productId));
  if (normalized.length) {
    await db.insert(schema.productImagesTable).values(normalized.map((image) => ({ ...image, productId })));
  }
  await db.update(schema.productsTable)
    .set({ imageUrl: normalized.find((image) => image.isPrimary)?.url ?? normalized[0]?.url ?? null })
    .where(eq(schema.productsTable.id, productId));
  return db.select().from(schema.productImagesTable)
    .where(eq(schema.productImagesTable.productId, productId))
    .orderBy(schema.productImagesTable.sortOrder, schema.productImagesTable.id);
}

/**
 * Legacy shared copies were created with matching barcodes but no product
 * relationship. Link them lazily on the first shared-field edit, and only
 * when the barcode identifies exactly one product in each active store.
 */
export async function linkLegacySharedCatalogCopies(options: {
  productId: number;
  storeId: number;
  tenantId: number;
  sharedCatalogId: string | null;
  barcode: string | null;
}): Promise<string | null> {
  if (options.sharedCatalogId) return options.sharedCatalogId;
  const barcode = options.barcode?.trim();
  if (!barcode) return null;

  return db.transaction(async (tx) => {
    const lockKey = `erp:product-barcode:${barcode}`;
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`);
    const matches = await tx.select({
      id: schema.productsTable.id,
      storeId: schema.productsTable.storeId,
      sharedCatalogId: schema.productsTable.sharedCatalogId,
    })
      .from(schema.productsTable)
      .innerJoin(schema.storesTable, eq(schema.storesTable.id, schema.productsTable.storeId))
      .where(and(
        eq(schema.storesTable.platformTenantId, options.tenantId),
        eq(schema.storesTable.kind, "store"),
        eq(schema.storesTable.isActive, true),
        sql`trim(${schema.productsTable.barcode}) = ${barcode}`,
      ));

    if (!isSafeLegacyCatalogMatchGroup(matches)) return null;
    const existingIds = new Set(matches.map((match) => match.sharedCatalogId).filter((id): id is string => Boolean(id)));
    const sharedCatalogId = existingIds.values().next().value ?? randomUUID();
    const unlinkedIds = matches.filter((match) => !match.sharedCatalogId).map((match) => match.id);
    if (unlinkedIds.length) {
      await tx.update(schema.productsTable)
        .set({ sharedCatalogId })
        .where(and(
          inArray(schema.productsTable.id, unlinkedIds),
          sql`${schema.productsTable.sharedCatalogId} IS NULL`,
        ));
    }
    return sharedCatalogId;
  });
}

export async function resolveSharedCatalogProductCopies(options: {
  productId: number;
  storeId: number;
  tenantId: number;
  sharedCatalogId: string | null;
  barcode: string | null;
}): Promise<{ sharedCatalogId: string | null; productIds: number[]; ambiguous: boolean }> {
  const sharedCatalogId = await linkLegacySharedCatalogCopies(options);
  if (!sharedCatalogId) {
    const barcode = options.barcode?.trim();
    if (!barcode) {
      return { sharedCatalogId: null, productIds: [options.productId], ambiguous: true };
    }
    const matches = await db.select({
      id: schema.productsTable.id,
    })
      .from(schema.productsTable)
      .innerJoin(schema.storesTable, eq(schema.storesTable.id, schema.productsTable.storeId))
      .where(and(
        eq(schema.storesTable.platformTenantId, options.tenantId),
        eq(schema.storesTable.kind, "store"),
        eq(schema.storesTable.isActive, true),
        sql`trim(${schema.productsTable.barcode}) = ${barcode}`,
      ));
    return {
      sharedCatalogId: null,
      productIds: [options.productId],
      ambiguous: matches.length > 1,
    };
  }

  const copies = await db.select({ id: schema.productsTable.id })
    .from(schema.productsTable)
    .innerJoin(schema.storesTable, eq(schema.storesTable.id, schema.productsTable.storeId))
    .where(and(
      eq(schema.productsTable.sharedCatalogId, sharedCatalogId),
      eq(schema.storesTable.platformTenantId, options.tenantId),
      eq(schema.storesTable.kind, "store"),
      eq(schema.storesTable.isActive, true),
    ));
  return {
    sharedCatalogId,
    productIds: [...new Set([options.productId, ...copies.map((copy) => copy.id)])],
    ambiguous: false,
  };
}

async function mapCategoryId(sourceCategoryId: number | null, targetStoreId: number): Promise<number | null> {
  if (sourceCategoryId == null) return null;
  const [source] = await db.select().from(schema.categoriesTable)
    .where(eq(schema.categoriesTable.id, sourceCategoryId)).limit(1);
  if (!source) return null;
  const [target] = await db.select({ id: schema.categoriesTable.id }).from(schema.categoriesTable)
    .where(and(eq(schema.categoriesTable.storeId, targetStoreId), eq(schema.categoriesTable.nameAr, source.nameAr)))
    .limit(1);
  if (target) return target.id;
  const [created] = await db.insert(schema.categoriesTable).values({
    storeId: targetStoreId,
    nameAr: source.nameAr,
    nameEn: source.nameEn,
    imageUrl: source.imageUrl,
  }).returning({ id: schema.categoriesTable.id });
  return created?.id ?? null;
}

async function mapFamilyId(sourceFamilyId: number | null, targetStoreId: number): Promise<number | null> {
  if (sourceFamilyId == null) return null;
  const [source] = await db.select().from(schema.productFamiliesTable)
    .where(eq(schema.productFamiliesTable.id, sourceFamilyId)).limit(1);
  if (!source) return null;
  const [target] = await db.select({ id: schema.productFamiliesTable.id }).from(schema.productFamiliesTable)
    .where(and(
      eq(schema.productFamiliesTable.storeId, targetStoreId),
      sql`lower(${schema.productFamiliesTable.nameFr}) = ${source.nameFr.toLowerCase()}`,
    )).limit(1);
  if (target) return target.id;
  const [created] = await db.insert(schema.productFamiliesTable).values({
    storeId: targetStoreId,
    nameFr: source.nameFr,
    nameAr: source.nameAr,
  }).returning({ id: schema.productFamiliesTable.id });
  return created?.id ?? null;
}

async function mapBrandId(sourceBrandId: number | null, targetStoreId: number): Promise<number | null> {
  if (sourceBrandId == null) return null;
  const [source] = await db.select().from(schema.productBrandsTable)
    .where(eq(schema.productBrandsTable.id, sourceBrandId)).limit(1);
  if (!source) return null;
  const [target] = await db.select({ id: schema.productBrandsTable.id }).from(schema.productBrandsTable)
    .where(and(
      eq(schema.productBrandsTable.storeId, targetStoreId),
      sql`lower(${schema.productBrandsTable.nameFr}) = ${source.nameFr.toLowerCase()}`,
    )).limit(1);
  if (target) return target.id;
  const [created] = await db.insert(schema.productBrandsTable).values({
    storeId: targetStoreId,
    nameFr: source.nameFr,
    nameAr: source.nameAr,
  }).returning({ id: schema.productBrandsTable.id });
  return created?.id ?? null;
}

async function mapColorId(sourceColorId: number | null, targetStoreId: number): Promise<number | null> {
  if (sourceColorId == null) return null;
  const [source] = await db.select().from(schema.productColorsTable)
    .where(eq(schema.productColorsTable.id, sourceColorId)).limit(1);
  if (!source) return null;
  const [target] = await db.select({ id: schema.productColorsTable.id }).from(schema.productColorsTable)
    .where(and(
      eq(schema.productColorsTable.storeId, targetStoreId),
      sql`lower(${schema.productColorsTable.nameFr}) = ${source.nameFr.toLowerCase()}`,
    )).limit(1);
  if (target) return target.id;
  const [created] = await db.insert(schema.productColorsTable).values({
    storeId: targetStoreId,
    nameFr: source.nameFr,
    nameAr: source.nameAr,
    hexCode: source.hexCode,
  }).returning({ id: schema.productColorsTable.id });
  return created?.id ?? null;
}

export async function syncSharedCatalogProductCopies(options: {
  source: typeof schema.productsTable.$inferSelect;
  tenantId: number;
  changedFields: string[];
  syncImages: boolean;
  onTargetError?: (storeId: number, error: unknown) => void;
}): Promise<SharedCatalogSyncResult> {
  const { source, tenantId, changedFields, syncImages: shouldSyncImages } = options;
  const sharedCatalogId = source.sharedCatalogId;
  if (!sharedCatalogId) {
    return { status: "unlinked", updatedStores: 0, failedStoreIds: [], reason: "missing_or_ambiguous_barcode" };
  }

  const targets = await db.select({
    id: schema.productsTable.id,
    storeId: schema.productsTable.storeId,
  })
    .from(schema.productsTable)
    .innerJoin(schema.storesTable, eq(schema.storesTable.id, schema.productsTable.storeId))
    .where(and(
      eq(schema.productsTable.sharedCatalogId, sharedCatalogId),
      ne(schema.productsTable.id, source.id),
      eq(schema.storesTable.platformTenantId, tenantId),
      eq(schema.storesTable.kind, "store"),
      eq(schema.storesTable.isActive, true),
    ));

  const sourceRecord = source as unknown as Record<string, unknown>;
  const fieldSet = new Set(changedFields);
  const failedStoreIds: number[] = [];
  let updatedStores = 0;
  const sourceImages = shouldSyncImages
    ? await db.select({
        url: schema.productImagesTable.url,
        sortOrder: schema.productImagesTable.sortOrder,
        isPrimary: schema.productImagesTable.isPrimary,
      })
      .from(schema.productImagesTable)
      .where(eq(schema.productImagesTable.productId, source.id))
      .orderBy(schema.productImagesTable.sortOrder, schema.productImagesTable.id)
    : [];
  const imagesToCopy = sourceImages.length
    ? sourceImages
    : source.imageUrl
      ? [{ url: source.imageUrl, sortOrder: 0, isPrimary: true }]
      : [];

  for (const target of targets) {
    try {
      const values: Record<string, unknown> = { sharedCatalogId };
      for (const field of changedFields) {
        if (field === "categoryId" || field === "familyId" || field === "brandId" || field === "colorId") continue;
        values[field] = sourceRecord[field];
      }
      if (fieldSet.has("categoryId")) values.categoryId = await mapCategoryId(source.categoryId, target.storeId);
      if (fieldSet.has("familyId")) values.familyId = await mapFamilyId(source.familyId, target.storeId);
      if (fieldSet.has("brandId")) values.brandId = await mapBrandId(source.brandId, target.storeId);
      if (fieldSet.has("colorId")) values.colorId = await mapColorId(source.colorId, target.storeId);

      const updated = await db.transaction(async (tx) => {
        if (fieldSet.has("barcode") && source.barcode?.trim()) {
          const lockKey = `erp:product-barcode:${source.barcode.trim()}`;
          await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`);
          const [duplicateProduct] = await tx.select({ id: schema.productsTable.id })
            .from(schema.productsTable)
            .where(and(
              eq(schema.productsTable.storeId, target.storeId),
              sql`trim(${schema.productsTable.barcode}) = ${source.barcode.trim()}`,
              ne(schema.productsTable.id, target.id),
            )).limit(1);
          const [duplicateExtraBarcode] = await tx.select({ productId: schema.productBarcodesTable.productId })
            .from(schema.productBarcodesTable)
            .where(eq(schema.productBarcodesTable.barcode, source.barcode.trim()))
            .limit(1);
          if (duplicateProduct || (duplicateExtraBarcode && duplicateExtraBarcode.productId !== target.id)) {
            return false;
          }
        }
        const [updatedProduct] = await tx.update(schema.productsTable)
          .set(values as Partial<typeof schema.productsTable.$inferInsert>)
          .where(and(
            eq(schema.productsTable.id, target.id),
            eq(schema.productsTable.storeId, target.storeId),
            eq(schema.productsTable.sharedCatalogId, sharedCatalogId),
          ))
          .returning({ id: schema.productsTable.id });
        return Boolean(updatedProduct);
      });
      if (!updated) {
        failedStoreIds.push(target.storeId);
        continue;
      }
      if (shouldSyncImages) await syncProductImages(target.id, imagesToCopy);
      updatedStores += 1;
    } catch (error) {
      failedStoreIds.push(target.storeId);
      options.onTargetError?.(target.storeId, error);
    }
  }

  return { status: "synced", updatedStores, failedStoreIds };
}
