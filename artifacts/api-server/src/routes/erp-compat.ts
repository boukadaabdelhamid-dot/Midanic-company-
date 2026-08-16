import { Router, type Request } from "express";
import { pool } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router = Router();

function userId(req: Request): number {
  return Number(req.user?.userId);
}

async function canUseErp(req: Request): Promise<boolean> {
  if (req.user?.role === "super_admin" || req.user?.role === "admin") return true;
  const result = await pool.query(
    `SELECT 1 FROM erp_tenants
     WHERE owner_user_id = $1
       AND status IN ('active', 'converted')
       AND (trial_ends_at IS NULL OR trial_ends_at > now())
     LIMIT 1`,
    [userId(req)],
  );
  return (result.rowCount ?? 0) > 0;
}

async function getOrCreateStore(req: Request) {
  const ownerId = userId(req);
  const existing = await pool.query(
    `SELECT * FROM erp_stores WHERE owner_user_id = $1 AND is_active = true ORDER BY id LIMIT 1`,
    [ownerId],
  );
  if (existing.rows[0]) return existing.rows[0];
  const slug = `store-${ownerId}`;
  const created = await pool.query(
    `INSERT INTO erp_stores (owner_user_id, slug)
     VALUES ($1, $2)
     ON CONFLICT (slug) DO UPDATE SET owner_user_id = EXCLUDED.owner_user_id
     RETURNING *`,
    [ownerId, slug],
  );
  return created.rows[0];
}

async function guard(req: Request, res: any, next: () => void) {
  if (!(await canUseErp(req))) {
    res.status(403).json({ error: "ERP access is not active" });
    return;
  }
  next();
}

// Compatibility routes use ERP-owned tables and intentionally do not touch
// Midanic's digital products table.
router.get("/products", async (req, res, next) => {
  // Public storefront requests must continue to use Midanic's digital catalog.
  if (!req.headers.authorization) {
    next();
    return;
  }
  requireAuth(req, res, () => {
    void guard(req, res, () => {
      void (async () => {
        const store = await getOrCreateStore(req);
        const result = await pool.query(
          `SELECT id, store_id AS "storeId", name_ar AS "nameAr", name_en AS "nameEn",
             description_ar AS "descriptionAr", description_en AS "descriptionEn",
             price, image_url AS "imageUrl", stock, reference, barcode,
             cost_price AS "costPrice", price_gros AS "priceGros",
             price_semi_gros AS "priceSemiGros", price_min AS "priceMin",
             catalogue_type AS "catalogueType", is_active AS "isActive",
             is_exposed AS "isExposed", created_at AS "createdAt"
           FROM erp_products WHERE store_id = $1 ORDER BY id DESC`,
          [store.id],
        );
        res.json(result.rows);
      })().catch(next);
    });
  });
});

router.get("/product-types", requireAuth, guard, async (req, res) => {
  const store = await getOrCreateStore(req);
  const result = await pool.query(
    `SELECT id, name_ar AS "nameAr", name_en AS "nameEn" FROM erp_product_types WHERE store_id = $1 ORDER BY id`,
    [store.id],
  );
  res.json(result.rows);
});

router.get("/erp/stores/mine", requireAuth, guard, async (req, res) => {
  const store = await getOrCreateStore(req);
  res.json([store]);
});

router.get("/erp/stores", requireAuth, guard, async (req, res) => {
  const store = await getOrCreateStore(req);
  res.json([store]);
});

router.get("/erp/products", requireAuth, guard, async (req, res) => {
  const store = await getOrCreateStore(req);
  const result = await pool.query(
    `SELECT * FROM erp_products WHERE store_id = $1 ORDER BY id DESC`,
    [store.id],
  );
  res.json(result.rows);
});

router.post("/products", requireAuth, guard, async (req, res) => {
  const store = await getOrCreateStore(req);
  const b = req.body ?? {};
  const result = await pool.query(
    `INSERT INTO erp_products
      (store_id, name_ar, name_en, description_ar, description_en, price, image_url,
       stock, reference, barcode, cost_price, price_gros, price_semi_gros, price_min,
       catalogue_type, is_active, is_exposed)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
     RETURNING *`,
    [
      store.id, b.nameAr ?? b.nameEn ?? "", b.nameEn ?? b.nameAr ?? "",
      b.descriptionAr ?? "", b.descriptionEn ?? "", Number(b.price ?? b.priceDetail ?? 0),
      b.imageUrl ?? null, Number(b.stock ?? 0), b.reference ?? null, b.barcode ?? null,
      b.costPrice ?? b.cost ?? null, b.priceGros ?? b.wholesalePrice ?? null,
      b.priceSemiGros ?? null, b.priceMin ?? null, b.catalogueType ?? "ARTICLE",
      b.isActive !== false, b.isExposed !== false,
    ],
  );
  res.status(201).json(result.rows[0]);
});

router.put("/products/:id", requireAuth, guard, async (req, res) => {
  const store = await getOrCreateStore(req);
  const b = req.body ?? {};
  const result = await pool.query(
    `UPDATE erp_products SET
      name_ar = COALESCE($1, name_ar), name_en = COALESCE($2, name_en),
      price = COALESCE($3, price), stock = COALESCE($4, stock),
      price_gros = COALESCE($5, price_gros), price_semi_gros = COALESCE($6, price_semi_gros),
      price_min = COALESCE($7, price_min), is_active = COALESCE($8, is_active),
      updated_at = now()
     WHERE id = $9 AND store_id = $10 RETURNING *`,
    [b.nameAr, b.nameEn, b.price ?? b.priceDetail, b.stock, b.priceGros,
      b.priceSemiGros, b.priceMin, b.isActive, Number(req.params.id), store.id],
  );
  if (!result.rows[0]) {
    res.status(404).json({ error: "ERP product not found" });
    return;
  }
  res.json(result.rows[0]);
});

router.delete("/products/:id", requireAuth, guard, async (req, res) => {
  const store = await getOrCreateStore(req);
  const result = await pool.query(
    `DELETE FROM erp_products WHERE id = $1 AND store_id = $2 RETURNING id`,
    [Number(req.params.id), store.id],
  );
  if (!result.rows[0]) {
    res.status(404).json({ error: "ERP product not found" });
    return;
  }
  res.status(204).send();
});

export default router;