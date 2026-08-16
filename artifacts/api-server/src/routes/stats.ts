import { Router, type IRouter } from "express";
import { db, usersTable, productsTable, downloadFilesTable, subscriptionsTable } from "@workspace/db";
import { eq, count, sum } from "drizzle-orm";

const router: IRouter = Router();

router.get("/stats/summary", async (_req, res): Promise<void> => {
  const [clientsRow] = await db
    .select({ total: count() })
    .from(usersTable)
    .where(eq(usersTable.role, "customer"));
  const [productsRow] = await db
    .select({ total: count() })
    .from(productsTable)
    .where(eq(productsTable.published, true));
  const [downloadsRow] = await db
    .select({ total: sum(downloadFilesTable.downloadCount) })
    .from(downloadFilesTable);

  res.json({
    totalProducts: Number(productsRow?.total ?? 0),
    totalClients: Number(clientsRow?.total ?? 0),
    totalDownloads: Number(downloadsRow?.total ?? 0),
    totalCountries: 15,
    yearsInBusiness: 5,
  });
});

router.get("/stats/featured-products", async (_req, res): Promise<void> => {
  const products = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.featured, true))
    .limit(6);
  res.json(products);
});

export default router;
