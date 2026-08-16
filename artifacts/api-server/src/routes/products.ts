import { Router, type IRouter } from "express";
import { db, productsTable, productVersionsTable, downloadFilesTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import {
  GetProductParams,
  ListProductVersionsParams,
  ListProductDownloadsParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/products", async (req, res): Promise<void> => {
  const { category, featured } = req.query;
  let conditions = [eq(productsTable.published, true)];
  if (category && typeof category === "string") {
    conditions.push(eq(productsTable.category, category));
  }
  const products = await db
    .select()
    .from(productsTable)
    .where(and(...conditions))
    .orderBy(productsTable.sortOrder, productsTable.createdAt);
  // filter by featured if requested
  const result = featured === "true" ? products.filter((p) => p.featured) : products;
  res.json(result);
});

router.get("/products/:slug", async (req, res): Promise<void> => {
  const params = GetProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid slug" });
    return;
  }
  const [product] = await db
    .select()
    .from(productsTable)
    .where(and(eq(productsTable.slug, params.data.slug), eq(productsTable.published, true)));
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  const versions = await db
    .select()
    .from(productVersionsTable)
    .where(eq(productVersionsTable.productId, product.id))
    .orderBy(desc(productVersionsTable.releasedAt));
  const downloads = await db
    .select()
    .from(downloadFilesTable)
    .where(and(eq(downloadFilesTable.productId, product.id), eq(downloadFilesTable.isPublic, true)));
  res.json({ ...product, versions, downloads });
});

router.get("/products/:slug/versions", async (req, res): Promise<void> => {
  const params = ListProductVersionsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid slug" });
    return;
  }
  const [product] = await db.select().from(productsTable).where(eq(productsTable.slug, params.data.slug));
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  const versions = await db
    .select()
    .from(productVersionsTable)
    .where(eq(productVersionsTable.productId, product.id))
    .orderBy(desc(productVersionsTable.releasedAt));
  res.json(versions);
});

router.get("/products/:slug/downloads", async (req, res): Promise<void> => {
  const params = ListProductDownloadsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid slug" });
    return;
  }
  const [product] = await db.select().from(productsTable).where(eq(productsTable.slug, params.data.slug));
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  const downloads = await db
    .select()
    .from(downloadFilesTable)
    .where(and(eq(downloadFilesTable.productId, product.id), eq(downloadFilesTable.isPublic, true)));
  res.json(downloads);
});

router.get("/downloads", async (_req, res): Promise<void> => {
  const downloads = await db
    .select()
    .from(downloadFilesTable)
    .where(eq(downloadFilesTable.isPublic, true))
    .orderBy(desc(downloadFilesTable.createdAt));
  res.json(downloads);
});

export default router;
