"low" ? "low" : "all";
    const stockSql = sf === "rupture" ? sql` AND br.stock = 0`
                   : sf === "low"     ? sql` AND br.stock > 0`
                   : sql``;

    const supplierFilter = supplierId   ? sql` AND ls.supplier_id = ${parseInt(supplierId, 10)}`                                                                                                                                            : sql``;
    const familyFilter   = familyId     ? sql` AND p.family_id = ${parseInt(familyId, 10)}`                                                                                                                                                 : sql``;
    const brandFilter    = brandId      ? sql` AND p.brand_id = ${parseInt(brandId, 10)}`                                                                                                                                                   : sql``;
    const cityFilter     = supplierCity ? sql` AND lower(sup.address) LIKE ${`%${supplierCity.toLowerCase()}%`}`                                                                                                                             : sql``;
    const searchFilter   = search       ? sql` AND (lower(p.name_en) LIKE ${`%${search.toLowerCase()}%`} OR lower(p.name_ar) LIKE ${`%${search.toLowerCase()}%`} OR lower(COALESCE(p.reference,'')) LIKE ${`%${search.toLowerCase()}%`})` : sql``;
    const dateFilter     = (dateFrom && dateTo)
      ? sql` AND o.created_at BETWEEN ${dateFrom}::timestamp AND (${dateTo}::timestamp + INTERVAL '1 day')`
      : dateFrom ? sql` AND o.created_at >= ${dateFrom}::timestamp`
      : dateTo   ? sql` AND o.created_at < (${dateTo}::timestamp + INTERVAL '1 day')`
      : sql``;

    // ── Restructured query: base_rows CTE materialises the full filtered set (sans
    //    tab/stockFilter), counts CTE derives tab totals in one pass, outer SELECT
    //    applies the tab filter + pagination. All CTEs are scanned once each. ──
    const result = await db.execute(sql`
      WITH
      -- 1. Sales totals for every product in this store (one pass over order_items)
      sales_agg AS (
        SELECT
          oi.product_id,
          SUM(oi.quantity::numeric *
              (oi.unit_price::numeric
               - COALESCE(oi.cost_price, 0)::numeric))   AS benefice,
          SUM(oi.quantity::numeric)                       AS total_qty_sold
        FROM   order_items oi
        JOIN   orders      o  ON o.id = oi.order_id
        WHERE  o.store_id   = ${storeId}
          AND  o.status NOT IN ('cancelled', 'draft')
          ${dateFilter}
        GROUP  BY oi.product_id
      ),
      -- 2. Last received supplier per product (one pass over purchase_items)
      last_sup AS (
        SELECT DISTINCT ON (pi.product_id)
          pi.product_id,
          po.supplier_id
        FROM   purchase_items  pi
        JOIN   purchase_orders po ON po.id = pi.purchase_order_id
        WHERE  po.store_id = ${storeId}
          AND  po.status   = 'received'
        ORDER  BY pi.product_id,
                  COALESCE(po.received_at, po.created_at) DESC
      ),
      -- 3. Snoozed products for this store (tiny scan)
      snoozed AS (
        SELECT product_id
        FROM   purchase_snooze
        WHERE  store_id     = ${storeId}
          AND  snoozed_until > NOW()
      ),
      -- 4. Cross-store in-stock references/barcodes (one scan, used for anti-join)
      cross_avail AS (
        SELECT reference, barcode
        FROM   products
        WHERE  store_id  != ${storeId}
          AND  is_active  = true
          AND  stock      > 0
          AND  (
            (reference IS NOT NULL AND reference != '')
            OR (barcode IS NOT NULL AND barcode != '')
          )
      ),
      -- 5. Full filtered result set WITHOUT tab/stockFilter — used for counts + pagination
      base_rows AS (
        SELECT
          p.id,
          p.name_en        AS designation,
          p.name_ar        AS designation_ar,
          p.image_url,
          p.stock,
          p.min_stock,
          p.cost_price,
          p.price,
          p.reference,
          pf.name_fr       AS famille,
          pf.name_ar       AS famille_ar,
          pb.name_fr       AS marque,
          sup.id           AS supplier_id,
          sup.name         AS supplier_name,
          sup.address      AS supplier_city,
          sup.phone        AS supplier_phone,
          COALESCE(sa.benefice,       0) AS benefice,
          COALESCE(sa.total_qty_sold, 0) AS total_qty_sold
        FROM   products         p
        LEFT JOIN product_families  pf  ON pf.id  = p.family_id
        LEFT JOIN product_brands    pb  ON pb.id  = p.brand_id
        LEFT JOIN last_sup          ls  ON ls.product_id  = p.id
        LEFT JOIN suppliers         sup ON sup.id = ls.supplier_id
        LEFT JOIN sales_agg         sa  ON sa.product_id  = p.id
        LEFT JOIN snoozed           sn  ON sn.product_id  = p.id
        WHERE  p.store_id              = ${storeId}
          AND  p.is_active             = true
          AND  (
            p.stock = 0
            OR (p.min_stock IS NOT NULL AND p.stock <= p.min_stock)
          )
          AND  p.excluded_from_purchase = false
          AND  sn.product_id IS NULL
          AND NOT (
            (p.reference IS NOT NULL AND p.reference != ''
              AND EXISTS (SELECT 1 FROM cross_avail ca WHERE ca.reference = p.reference))
            OR
            (COALESCE(p.reference, '') = '' AND p.barcode IS NOT NULL AND p.barcode != ''
              AND EXISTS (SELECT 1 FROM cross_avail ca WHERE ca.barcode = p.barcode))
          )
          ${familyFilter}
          ${brandFilter}
          ${searchFilter}
          ${supplierFilter}
          ${cityFilter}
      ),
      -- 6. Tab totals derived in a single pass over base_rows
      counts AS (
        SELECT
          COUNT(*) FILTER (WHERE stock = 0)::int  AS rupture_total,
          COUNT(*) FILTER (WHERE stock > 0)::int  AS low_total
        FROM base_rows
      )
      -- Final: apply tab filter + sort + pagination; join counts as constant columns
      SELECT br.*, c.rupture_total, c.low_total
      FROM   base_rows br, counts c
      WHERE  TRUE ${stockSql}
      ORDER  BY ${orderByQty ? sql`br.total_qty_sold DESC NULLS LAST` : sql`br.benefice DESC NULLS LAST`}
      LIMIT  ${limit} OFFSET ${offset}
    `);

    type RawRow = Record<string, unknown> & { rupture_total: number; low_total: number };
    const raw         = result.rows as RawRow[];
    const ruptureTotal = raw[0]?.rupture_total ?? 0;
    const lowTotal     = raw[0]?.low_total     ?? 0;

    res.json({
      rows: raw.map(({ rupture_total, low_total, ...r }) => r),
      ruptureTotal,
      lowTotal,
    });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

// GET /erp/purchases/filter-options — families, brands & supplier cities (purchases:view, no settings perm needed)
router.get("/erp/purchases/filter-options", authenticate, requireStaff, requireStore, requirePermission("purchases", "view"), async (req: AuthRequest, res) => {
  try {
    const storeId = req.currentStoreId!;
    const [families, brands, citiesRaw] = await Promise.all([
      db.select({ id: schema.productFamiliesTable.id, nameFr: schema.productFamiliesTable.nameFr, nameAr: schema.productFamiliesTable.nameAr })
        .from(schema.productFamiliesTable)
        .where(eq(schema.productFamiliesTable.storeId, storeId))
        .orderBy(schema.productFamiliesTable.nameFr),
      db.select({ id: schema.productBrandsTable.id, nameFr: schema.productBrandsTable.nameFr, nameAr: schema.productBrandsTable.nameAr })
        .from(schema.productBrandsTable)
        .where(eq(schema.productBrandsTable.storeId, storeId))
        .orderBy(schema.productBrandsTable.nameFr),
      db.selectDistinct({ city: schema.suppliersTable.address })
        .from(schema.suppliersTable)
        .where(and(
          eq(schema.suppliersTable.storeId, storeId),
          sql`${schema.suppliersTable.address} IS NOT NULL AND TRIM(${schema.suppliersTable.address}) <> ''`,
        ))
        .orderBy(schema.suppliersTable.address),
    ]);
    const supplierCities = citiesRaw.map(r => r.city).filter((c): c is string => !!c);
    res.json({ families, brands, supplierCities });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

// GET /erp/purchases/auto-min-stock/preview — compute suggested thresholds without applying them
router.get("/erp/purchases/auto-min-stock/preview", authenticate, requireStaff, requireStore, requirePermission("purchases", "edit"), async (req: AuthRequest, res) => {
  try {
    const storeId = req.currentStoreId!;

    const rows = await db.execute(sql`
      WITH sales_3mo AS (
        SELECT
          oi.product_id,
          CEIL(SUM(oi.quantity::numeric) / 3.0)::int AS suggested
        FROM   order_items  oi
        JOIN   orders       o  ON o.id = oi.order_id
        WHERE  o.store_id  = ${storeId}
          AND  o.status   NOT IN ('cancelled', 'draft')
          AND  o.created_at >= NOW() - INTERVAL '3 months'
        GROUP  BY oi.product_id
        HAVING SUM(oi.quantity::numeric) > 0
      )
      SELECT
        p.id            AS product_id,
        p.name_en       AS name,
        p.name_ar       AS name_ar,
        p.min_stock     AS current_min_stock,
        s.suggested     AS suggested
      FROM   products   p
      JOIN   sales_3mo  s ON s.product_id = p.id
      WHERE  p.store_id  = ${storeId}
        AND  p.is_active = true
      ORDER BY p.name_en ASC
    `);

    res.json({ rows: rows.rows });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

// POST /erp/purchases/auto-min-stock — bulk-set min_stock = CEIL(avg monthly qty sold over 3 months)
// Body (optional): { productIds?: number[], protectManual?: boolean }
//   productIds    — when provided, only update these specific product IDs.
//                   An empty array [] is treated as "apply to none" (no-op, returns 0 updated).
//   protectManual — when true, skip products that already have a non-null min_stock
router.post("/erp/purchases/auto-min-stock", authenticate, requireStaff, requireStore, requirePermission("purchases", "edit"), async (req: AuthRequest, res) => {
  try {
    const storeId = req.currentStoreId!;
    const { productIds, protectManual } = req.body as { productIds?: number[]; protectManual?: boolean };

    const isSelective = Array.isArray(productIds);

    // Runtime validation — reject any non-integer values to prevent injection
    if (isSelective && !productIds!.every(id => Number.isFinite(id) && Number.isInteger(id))) {
      res.status(400).json({ error: "productIds must be an array of integers" });
      return;
    }

    // If caller sent an explicit empty array, there is nothing to update.
    if (isSelective && productIds!.length === 0) {
      res.json({ updated: 0, skipped: 0 });
      return;
    }

    // Use fully-bound ARRAY[...] syntax (same pattern as products.ts) — no raw interpolation
    const idFilter = isSelective
      ? sql` AND p.id = ANY(ARRAY[${sql.join(productIds!.map(id => sql`${id}`), sql`, `)}]::int[])`
      : sql``;
    const manualFilter = protectManual ? sql` AND p.min_stock IS NULL` : sql``;

    // Compute per-product ceiling of average monthly qty over the last 3 months,
    // then bulk-update min_stock only for products that have qualifying sales.
    const updated = await db.execute(sql`
      WITH sales_3mo AS (
        SELECT
          oi.product_id,
          CEIL(SUM(oi.quantity::numeric) / 3.0)::int AS monthly_avg
        FROM   order_items  oi
        JOIN   orders       o  ON o.id = oi.order_id
        WHERE  o.store_id  = ${storeId}
          AND  o.status   NOT IN ('cancelled', 'draft')
          AND  o.created_at >= NOW() - INTERVAL '3 months'
        GROUP  BY oi.product_id
        HAVING SUM(oi.quantity::numeric) > 0
      )
      UPDATE products p
         SET min_stock = s.monthly_avg
        FROM sales_3mo s
       WHERE p.id       = s.product_id
         AND p.store_id = ${storeId}
         AND p.is_active = true
         ${idFilter}
         ${manualFilter}
      RETURNING p.id
    `);
    const updatedCount = updated.rows.length;

    // Compute `skipped` relative to the scoped candidate set, not all active products.
    // Candidate = active products that qualified for update (had sales, passed id/manual filters).
    // We count those same candidates minus the ones actually written.
    const candidateResult = await db.execute(sql`
      WITH sales_3mo AS (
        SELECT oi.product_id
        FROM   order_items  oi
        JOIN   orders       o  ON o.id = oi.order_id
        WHERE  o.store_id  = ${storeId}
          AND  o.status   NOT IN ('cancelled', 'draft')
          AND  o.created_at >= NOW() - INTERVAL '3 months'
        GROUP  BY oi.product_id
        HAVING SUM(oi.quantity::numeric) > 0
      )
      SELECT COUNT(*)::int AS cnt
      FROM   products p
      JOIN   sales_3mo s ON s.product_id = p.id
      WHERE  p.store_id  = ${storeId}
        AND  p.is_active = true
        ${idFilter}
        ${manualFilter}
    `);
    const candidateCount = Number((candidateResult.rows[0] as { cnt: number } | undefined)?.cnt ?? 0);
    const skipped = Math.max(0, candidateCount - updatedCount);

    res.json({ updated: updatedCount, skipped });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

// POST /erp/purchases/reset-min-stock — set min_stock = NULL for all active products in store
router.post("/erp/purchases/reset-min-stock", authenticate, requireStaff, requireStore, requirePermission("purchases", "edit"), async (req: AuthRequest, res) => {
  try {
    const storeId = req.currentStoreId!;

    const result = await db.execute(sql`
      UPDATE products
         SET min_stock = NULL
       WHERE store_id = ${storeId}
         AND is_active = true
         AND min_stock IS NOT NULL
      RETURNING id
    `);

    res.json({ reset: result.rows.length });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

// POST /erp/purchases/snooze/:productId — mark a product as "bought", hide for 24 h
router.post("/erp/purchases/snooze/:productId", authenticate, requireStaff, requireStore, requirePermission("purchases", "edit"), async (req: AuthRequest, res) => {
  try {
    const storeId   = req.currentStoreId!;
    const productId = pid(req, "productId");
    // Store-ownership check: product must belong to current store
    const [prod] = await db.select({ id: schema.productsTable.id })
      .from(schema.productsTable)
      .where(and(eq(schema.productsTable.id, productId), eq(schema.productsTable.storeId, storeId)))
      .limit(1);
    if (!prod) { res.status(404).json({ error: "Product not found in current store" }); return; }
    await db.execute(sql`
      INSERT INTO purchase_snooze (product_id, store_id, snoozed_until)
      VALUES (${productId}, ${storeId}, NOW() + INTERVAL '24 hours')
      ON CONFLICT (product_id, store_id)
      DO UPDATE SET snoozed_until = NOW() + INTERVAL '24 hours'
    `);
    res.json({ success: true });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

// GET /erp/purchases/exclude/:productId — check if a product is permanently excluded
router.get("/erp/purchases/exclude/:productId", authenticate, requireStaff, requireStore, requirePermission("purchases", "view"), async (req: AuthRequest, res) => {
  try {
    const storeId   = req.currentStoreId!;
    const productId = pid(req, "productId");
    const result = await db.execute(sql`
      SELECT excluded_from_purchase FROM products WHERE id = ${productId} AND store_id = ${storeId} LIMIT 1
    `);
    const row = result.rows[0] as { excluded_from_purchase: boolean } | undefined;
    res.json({ excluded: row?.excluded_from_purchase ?? false });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

// POST /erp/purchases/exclude/:productId — permanently hide product from Besoin d'Achats
router.post("/erp/purchases/exclude/:productId", authenticate, requireStaff, requireStore, requirePermission("purchases", "edit"), async (req: AuthRequest, res) => {
  try {
    const storeId   = req.currentStoreId!;
    const productId = pid(req, "productId");
    await db.execute(sql`
      UPDATE products SET excluded_from_purchase = true WHERE id = ${productId} AND store_id = ${storeId}
    `);
    res.json({ success: true });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

// DELETE /erp/purchases/exclude/:productId — re-include product in Besoin d'Achats
router.delete("/erp/purchases/exclude/:productId", authenticate, requireStaff, requireStore, requirePermission("purchases", "edit"), async (req: AuthRequest, res) => {
  try {
    const storeId   = req.currentStoreId!;
    const productId = pid(req, "productId");
    await db.execute(sql`
      UPDATE products SET excluded_from_purchase = false WHERE id = ${productId} AND store_id = ${storeId}
    `);
    res.json({ success: true });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

// GET /erp/purchases/history/:productId — purchase history rows (received POs only)
router.get("/erp/purchases/history/:productId", authenticate, requireStaff, requireStore, requirePermission("purchases", "view"), async (req: AuthRequest, res) => {
  try {
    const storeId   = req.currentStoreId!;
    const productId = pid(req, "productId");
    const result = await db.execute(sql`
      SELECT
        po.id                                        AS po_id,
        COALESCE(po.received_at, po.created_at)      AS received_date,
        s.name                                       AS supplier_name,
        s.address                                    AS supplier_address,
        s.phone                                      AS supplier_phone,
        CAST(pi.unit_cost AS numeric)                AS unit_cost,
        CAST(pi.quantity  AS numeric)                AS quantity,
        p.image_url,
        p.name_en                                    AS product_name,
        p.name_ar                                    AS product_name_ar
      FROM   purchase_items  pi
      JOIN   purchase_orders po ON po.id  = pi.purchase_order_id
      JOIN   suppliers       s  ON s.id   = po.supplier_id
      JOIN   products        p  ON p.id   = pi.product_id
      WHERE  pi.product_id = ${productId}
        AND  po.store_id   = ${storeId}
        AND  po.status     = 'received'
      ORDER  BY COALESCE(po.received_at, po.created_at) DESC
      LIMIT  50
    `);
    res.json(result.rows);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

// ─────────────────────────────────────────────────────────────────────────────
// Bons de Vente  (order_source = 'bon')
// ─────────────────────────────────────────────────────────────────────────────
// Helpers for sale-order payload validation
// ─────────────────────────────────────────────────────────────────────────────

type SaleOrderItem = { productId: number; quantity: number; unitPrice: number };

function validateSaleItems(items: unknown): string | null {
  if (!Array.isArray(items) || items.length === 0) return "items must be a non-empty array";
  for (const it of items) {
    if (typeof it !== "object" || it === null) return "each item must be an object";
    const { productId, quantity, unitPrice } = it as Record<string, unknown>;
    if (!Number.isInteger(Number(productId)) || Number(productId) <= 0) return `invalid productId: ${String(productId)}`;
    if (typeof quantity !== "number" || !isFinite(quantity) || quantity <= 0) return `quantity must be a positive number`;
    if (typeof unitPrice !== "number" || !isFinite(unitPrice) || unitPrice < 0) return `unitPrice must be a non-negative number`;
  }
  return null;
}

// Verify all product IDs belong to the given store; return first invalid id or null.
async function checkProductsInStore(productIds: number[], storeId: number): Promise<number | null> {
  if (productIds.length === 0) return null;
  const rows = await db.execute(sql`SELECT id FROM products WHERE id = ANY(${sql.raw(`'{${productIds.join(",")}}'::int[]`)}) AND store_id = ${storeId}`);
  const found = new Set((rows.rows as Array<{ id: number }>).map(r => r.id));
  return productIds.find(id => !found.has(id)) ?? null;
}

// GET /erp/sale-orders
router.get("/erp/sale-orders", authenticate, requireStaff, requireStore, requirePermission("orders", "view"), async (req: AuthRequest, res) => {
  try {
    const storeId = req.currentStoreId!;
    const { page = "1", limit = "50", search, status, dateFrom, dateTo, orderSource, paymentMethod: pmFilter } = req.query as Record<string, string | undefined>;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(200, parseInt(limit, 10) || 50));
    const offset = (pageNum - 1) * limitNum;

    const searchClause = search ? `AND (lower(o.customer_name) LIKE lower('%${search.replace(/'/g, "''")}%') OR CAST(o.id AS TEXT) LIKE '%${search.replace(/'/g, "''")}%')` : "";
    const statusClause = status ? `AND o.status = '${status.replace(/'/g, "''")}'` : "";
    const dateFromClause = dateFrom ? `AND o.created_at >= '${dateFrom.replace(/'/g, "''")}'::date` : "";
    const dateToClause = dateTo ? `AND o.created_at < ('${dateTo.replace(/'/g, "''")}'::date + INTERVAL '1 day')` : "";
    const orderSourceClause = orderSource && ["bon", "pos", "online"].includes(orderSource) ? `AND o.order_source = '${orderSource}'` : "";
    const pmClause = pmFilter && ["comptant", "a_terme"].includes(pmFilter) ? `AND o.payment_method = '${pmFilter}'` : "";

    const result = await db.execute(sql`
      SELECT
        o.id,
        o.status,
        o.order_source,
        o.customer_name,
        o.customer_phone,
        o.user_id,
        o.total_amount,
        o.discount_amount,
        o.created_at,
        o.updated_at,
        o.payment_method,
        COALESCE(SUM(
          CAST(oi.quantity AS numeric) * (CAST(oi.unit_price AS numeric) - COALESCE(CAST(oi.cost_price AS numeric), 0))
        ), 0)::numeric(14,2) AS benefice,
        COUNT(*) OVER() AS total_count
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      WHERE o.store_id = ${storeId}
        AND o.order_source IN ('bon', 'pos', 'online')
        ${sql.raw(searchClause)}
        ${sql.raw(statusClause)}
        ${sql.raw(dateFromClause)}
        ${sql.raw(dateToClause)}
        ${sql.raw(orderSourceClause)}
        ${sql.raw(pmClause)}
      GROUP BY o.id
      ORDER BY o.created_at DESC
      LIMIT ${limitNum} OFFSET ${offset}
    `);

    const rows = result.rows as Array<Record<string, unknown>>;
    const total = rows.length > 0 ? Number(rows[0].total_count) : 0;
    res.json({ data: rows.map(({ total_count: _tc, ...r }) => r), total, page: pageNum, limit: limitNum });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

// GET /erp/sale-orders/:id
router.get("/erp/sale-orders/:id", authenticate, requireStaff, requireStore, requirePermission("orders", "view"), async (req: AuthRequest, res) => {
  try {
    const storeId = req.currentStoreId!;
    const id = pid(req, "id");
    const result = await db.execute(sql`
      SELECT
        o.id, o.status, o.customer_name, o.customer_phone, o.user_id,
        o.total_amount, o.discount_amount, o.created_at, o.updated_at, o.payment_method,
        COALESCE(json_agg(json_build_object(
          'id', oi.id,
          'product_id', oi.product_id,
          'quantity', oi.quantity,
          'unit_price', oi.unit_price,
          'cost_price', oi.cost_price,
          'product_name_en', p.name_en,
          'product_name_ar', p.name_ar,
          'product_reference', p.reference
        ) ORDER BY oi.id) FILTER (WHERE oi.id IS NOT NULL), '[]') AS items
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN products p ON p.id = oi.product_id
      WHERE o.id = ${id} AND o.store_id = ${storeId} AND o.order_source IN ('bon', 'pos', 'online')
      GROUP BY o.id
    `);
    if (!result.rows[0]) { res.status(404).json({ error: "Not found" }); return; }
    res.json(result.rows[0]);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

// POST /erp/sale-orders
router.post("/erp/sale-orders", authenticate, requireStaff, requireStore, requirePermission("orders", "edit"), async (req: AuthRequest, res) => {
  try {
    const storeId = req.currentStoreId!;
    const { customerUserId, customerName, customerPhone, items, notes, paymentMethod } = req.body as {
      customerUserId?: number | null;
      customerName?: string;
      customerPhone?: string;
      items: SaleOrderItem[];
      notes?: string;
      paymentMethod?: string;
    };

    const validErr = validateSaleItems(items);
    if (validErr) { res.status(400).json({ error: validErr }); return; }

    const pm = paymentMethod === "a_terme" ? "a_terme" : "comptant";

    const productIds = (items as SaleOrderItem[]).map(i => Number(i.productId));
    const badId = await checkProductsInStore(productIds, storeId);
    if (badId !== null) { res.status(400).json({ error: `Product ${badId} does not belong to this store` }); return; }

    let cName = (customerName ?? "").trim() || "DIVERS COMPTOIR";
    let cPhone = (customerPhone ?? "").trim();

    if (customerUserId) {
      const profRes = await db.execute(sql`SELECT name, phone FROM users WHERE id = ${customerUserId} LIMIT 1`);
      const u = profRes.rows[0] as { name?: string; phone?: string } | undefined;
      if (u) { cName = u.name ?? cName; cPhone = u.phone ?? cPhone; }
    }

    const total = (items as SaleOrderItem[]).reduce((s, i) => s + i.quantity * i.unitPrice, 0);

    // Atomic: create order + items in one transaction
    const orderId = await db.transaction(async (tx) => {
      const orderRes = await tx.execute(sql`
        INSERT INTO orders (store_id, user_id, seller_user_id, customer_name, customer_phone, customer_address,
          status, total_amount, discount_amount, order_source, payment_method, coupon_code, created_at, updated_at)
        VALUES (
          ${storeId}, ${customerUserId ?? null}, ${req.user!.id},
          ${cName}, ${cPhone}, ${notes ?? ""},
          'pending', ${total.toFixed(2)}, '0', 'bon', ${pm}, NULL, NOW(), NOW()
        ) RETURNING id
      `);
      const newId = (orderRes.rows[0] as { id: number }).id;

      for (const item of items as SaleOrderItem[]) {
        const prodRes = await tx.execute(sql`SELECT cost_price FROM products WHERE id = ${item.productId} AND store_id = ${storeId} LIMIT 1`);
        const costPrice = (prodRes.rows[0] as { cost_price?: string | null } | undefined)?.cost_price ?? "0";
        await tx.execute(sql`
          INSERT INTO order_items (order_id, product_id, quantity, unit_price, cost_price)
          VALUES (${newId}, ${item.productId}, ${item.quantity}, ${item.unitPrice.toFixed(2)}, ${costPrice})
        `);
      }
      return newId;
    });

    res.status(201).json({ id: orderId });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

// PUT /erp/sale-orders/:id
router.put("/erp/sale-orders/:id", authenticate, requireStaff, requireStore, requirePermission("orders", "edit"), async (req: AuthRequest, res) => {
  try {
    const storeId = req.currentStoreId!;
    const id = pid(req, "id");
    const { customerUserId, customerName, customerPhone, items, notes, paymentMethod } = req.body as {
      customerUserId?: number | null;
      customerName?: string;
      customerPhone?: string;
      items: SaleOrderItem[];
      notes?: string;
      paymentMethod?: string;
    };

    const validErr = validateSaleItems(items);
    if (validErr) { res.status(400).json({ error: validErr }); return; }

    const pm = paymentMethod === "a_terme" ? "a_terme" : "comptant";

    const existRes = await db.execute(sql`SELECT id, status FROM orders WHERE id = ${id} AND store_id = ${storeId} AND order_source IN ('bon', 'pos') LIMIT 1`);
    const existing = existRes.rows[0] as { id: number; status: string } | undefined;
    if (!existing) { res.status(404).json({ error: "Not found" }); return; }
    if (existing.status === "delivered" || existing.status === "cancelled") {
      res.status(400).json({ error: "Impossible de modifier un bon clôturé ou annulé" }); return;
    }

    const productIds = (items as SaleOrderItem[]).map(i => Number(i.productId));
    const badId = await checkProductsInStore(productIds, storeId);
    if (badId !== null) { res.status(400).json({ error: `Product ${badId} does not belong to this store` }); return; }

    let cName = (customerName ?? "").trim() || "DIVERS COMPTOIR";
    let cPhone = (customerPhone ?? "").trim();
    if (customerUserId) {
      const profRes = await db.execute(sql`SELECT name, phone FROM users WHERE id = ${customerUserId} LIMIT 1`);
      const u = profRes.rows[0] as { name?: string; phone?: string } | undefined;
      if (u) { cName = u.name ?? cName; cPhone = u.phone ?? cPhone; }
    }

    const total = (items as SaleOrderItem[]).reduce((s, i) => s + i.quantity * i.unitPrice, 0);

    // Atomic: update order + replace items in one transaction
    await db.transaction(async (tx) => {
      await tx.execute(sql`
        UPDATE orders SET
          user_id = ${customerUserId ?? null},
          customer_name = ${cName},
          customer_phone = ${cPhone},
          customer_address = ${notes ?? ""},
          total_amount = ${total.toFixed(2)},
          payment_method = ${pm},
          updated_at = NOW()
        WHERE id = ${id}
      `);
      await tx.execute(sql`DELETE FROM order_items WHERE order_id = ${id}`);
      for (const item of items as SaleOrderItem[]) {
        const prodRes = await tx.execute(sql`SELECT cost_price FROM products WHERE id = ${item.productId} AND store_id = ${storeId} LIMIT 1`);
        const costPrice = (prodRes.rows[0] as { cost_price?: string | null } | undefined)?.cost_price ?? "0";
        await tx.execute(sql`INSERT INTO order_items (order_id, product_id, quantity, unit_price, cost_price) VALUES (${id}, ${item.productId}, ${item.quantity}, ${item.unitPrice.toFixed(2)}, ${costPrice})`);
      }
    });

    res.json({ id, status: "updated" });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

// PUT /erp/sale-orders/:id/cloture
router.put("/erp/sale-orders/:id/cloture", authenticate, requireStaff, requireStore, requirePermission("orders", "edit"), async (req: AuthRequest, res) => {
  try {
    const storeId = req.currentStoreId!;
    const actorUserId = req.user!.id;
    const id = pid(req, "id");

    const existRes = await db.execute(sql`
      SELECT id, status, payment_method, total_amount, user_id, customer_name, order_source
      FROM orders WHERE id = ${id} AND store_id = ${storeId} AND order_source IN ('bon', 'pos', 'online') LIMIT 1
    `);
    const existing = existRes.rows[0] as {
      id: number; status: string; payment_method: string | null;
      total_amount: string; user_id: number | null; customer_name: string;
      order_source: string;
    } | undefined;
    if (!existing) { res.status(404).json({ error: "Not found" }); return; }
    if (existing.status !== "draft" && existing.status !== "pending" && existing.status !== "processing") {
      res.status(400).json({ error: "Seuls les bons en cours (draft/pending/processing) peuvent être clôturés" }); return;
    }

    const totalAmount = parseFloat(existing.total_amount ?? "0");
    const paymentMethod = existing.payment_method ?? "comptant";
    const customerId = existing.user_id;
    const customerName = existing.customer_name;
    const today = new Date().toISOString().split("T")[0];
    const isPos = existing.order_source === "pos";
    const isOnline = existing.order_source === "online";
    const prefix = isOnline ? "WS" : isPos ? "VR" : "BV";
    const refCode = `${prefix}-${String(id).padStart(6, "0")}`;
    const sourceLabel = isOnline ? "Commande en ligne" : isPos ? "Vente rapide" : "Bon de vente";

    const itemsRes = await db.execute(sql`SELECT product_id, quantity FROM order_items WHERE order_id = ${id}`);
    const lineItems = itemsRes.rows as Array<{ product_id: number; quantity: number }>;

    let cloturedCaisseId: number | null = null;

    // Atomic: mark delivered + deduct stock + accounting + payment in one transaction
    await db.transaction(async (tx) => {
      // 1. Mark delivered — conditional on allowed statuses to prevent race with a concurrent cancel/cloture
      const gateRes = await tx.execute(sql`
        UPDATE orders SET status = 'delivered', updated_at = NOW()
        WHERE id = ${id} AND status IN ('draft', 'pending', 'processing')
        RETURNING id
      `);
      if (!gateRes.rows[0]) {
        throw Object.assign(new Error("Seuls les bons en cours (draft/pending/processing) peuvent être clôturés"), { statusCode: 409 });
      }

      // 2. Deduct stock
      for (const item of lineItems) {
        await tx.execute(sql`
          UPDATE products
          SET stock = GREATEST(0, COALESCE(stock, 0) - ${item.quantity})
          WHERE id = ${item.product_id} AND store_id = ${storeId}
        `);
      }

      // 3. Accounting entry (always recorded regardless of payment method)
      if (totalAmount > 0) {
        await tx.insert(schema.transactionsTable).values({
          storeId,
          type: "income",
          category: "sales",
          amount: totalAmount.toFixed(2),
          description: `${sourceLabel} ${refCode} - ${customerName}`,
          date: today,
          reference: refCode,
        });
      }

      // 4. Payment effect
      if (paymentMethod === "comptant" && totalAmount > 0) {
        // Credit the clôturing staff member's caisse
        const caisse = await ensureCaisse(storeId, actorUserId, tx);
        cloturedCaisseId = caisse.id;
        const { oldBalance, newBalance } = await applyCaisseDelta(tx, caisse.id, totalAmount);
        await tx.insert(schema.caisseMovementsTable).values({
          caisseId: caisse.id,
          type: "credit",
          amount: totalAmount.toFixed(2),
          reason: "sale",
          orderId: id,
          actorUserId,
          notes: `${sourceLabel} ${refCode} - ${customerName}`,
          balanceBefore: oldBalance.toFixed(2),
          balanceAfter: newBalance.toFixed(2),
        });
      } else if (paymentMethod === "a_terme" && customerId && totalAmount > 0) {
        // Record as customer receivable (positive delta = customer owes store)
        await mutateCustomerBalance(tx, customerId, storeId, { delta: totalAmount });
      }
    });

    // Broadcast caisse update if cash payment
    if (cloturedCaisseId !== null) {
      await broadcastCaisseChanged(storeId, [cloturedCaisseId]);
    }

    res.json({ id, status: "delivered", paymentMethod });
  } catch (err) {
    const e = err as { statusCode?: number; message?: string };
    if (e.statusCode === 409) { res.status(409).json({ error: e.message }); return; }
    req.log.error(err); res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /erp/sale-orders/:id/cancel
// Cancels an online order that hasn't been confirmed yet. No stock changes needed
// because stock is only deducted at cloture time.
router.put("/erp/sale-orders/:id/cancel", authenticate, requireStaff, requireStore, requirePermission("orders", "edit"), async (req: AuthRequest, res) => {
  try {
    const storeId = req.currentStoreId!;
    const id = pid(req, "id");

    // First verify the order exists and is an online order (so we return 404 vs 409 correctly)
    const existRes = await db.execute(sql`
      SELECT id, status FROM orders WHERE id = ${id} AND store_id = ${storeId} AND order_source = 'online' LIMIT 1
    `);
    const existing = existRes.rows[0] as { id: number; status: string } | undefined;
    if (!existing) { res.status(404).json({ error: "Not found" }); return; }

    // Atomic conditional transition — status guard is part of the UPDATE to prevent races
    const gateRes = await db.execute(sql`
      UPDATE orders SET status = 'cancelled', updated_at = NOW()
      WHERE id = ${id} AND store_id = ${storeId} AND order_source = 'online'
        AND status IN ('draft', 'pending', 'processing')
      RETURNING id
    `);
    if (!gateRes.rows[0]) {
      res.status(409).json({ error: "Seules les commandes en ligne en cours (draft/pending/processing) peuvent être annulées" }); return;
    }

    res.json({ id, status: "cancelled" });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

// DELETE /erp/sale-orders/:id
router.delete("/erp/sale-orders/:id", authenticate, requireStaff, requireStore, requirePermission("orders", "edit"), async (req: AuthRequest, res) => {
  try {
    const storeId = req.currentStoreId!;
    const id = pid(req, "id");

    const existRes = await db.execute(sql`SELECT id, status FROM orders WHERE id = ${id} AND store_id = ${storeId} AND order_source = 'bon' LIMIT 1`);
    const existing = existRes.rows[0] as { id: number; status: string } | undefined;
    if (!existing) { res.status(404).json({ error: "Not found" }); return; }
    if (existing.status === "delivered") {
      res.status(400).json({ error: "Impossible de supprimer un bon clôturé" }); return;
    }

    // Atomic delete
    await db.transaction(async (tx) => {
      await tx.execute(sql`DELETE FROM order_items WHERE order_id = ${id}`);
      await tx.execute(sql`DELETE FROM orders WHERE id = ${id}`);
    });

    res.json({ deleted: true });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

// ─── Smart Alerts ────────────────────────────────────────────────────────────

// GET /erp/alerts/cross-store-missing
// Products available in sibling stores (stock > 0) but absent or stock=0 here.
// Matches by reference first, barcode as fallback (same logic as Besoin d'Achats).
router.get("/erp/alerts/cross-store-missing", authenticate, requireStaff, requireStore, requirePermission("alerts", "view"), async (req: AuthRequest, res) => {
  try {
    const storeId = req.currentStoreId!;
    const result = await db.execute(sql`
      SELECT DISTINCT ON (
        COALESCE(NULLIF(src.reference, ''), src.barcode)
      )
        src.id                                    AS source_product_id,
        src.name_en,
        src.name_ar,
        src.image_url,
        src.reference,
        src.barcode,
        CAST(src.stock AS numeric)               AS source_stock,
        src.store_id                             AS source_store_id,
        st.name_en                               AS source_store_name_en,
        st.name_ar                               AS source_store_name_ar,
        COALESCE(CAST(dst.stock AS numeric), 0)  AS local_stock
      FROM   products src
      JOIN   stores   st  ON st.id  = src.store_id
      LEFT JOIN products dst ON (
        dst.store_id = ${storeId}
        AND (
          (src.reference IS NOT NULL AND src.reference <> '' AND dst.reference = src.reference)
          OR (
            (src.reference IS NULL OR src.reference = '')
            AND src.barcode IS NOT NULL AND src.barcode <> ''
            AND dst.barcode = src.barcode
          )
        )
      )
      WHERE src.store_id <> ${storeId}
        AND (src.is_active IS NULL OR src.is_active = true)
        AND src.stock > 0
        AND (dst.id IS NULL OR dst.stock = 0)
        AND (
          (src.reference IS NOT NULL AND src.reference <> '')
          OR (src.barcode IS NOT NULL AND src.barcode <> '')
        )
      ORDER BY
        COALESCE(NULLIF(src.reference, ''), src.barcode),
        src.stock DESC
    `);
    res.json(result.rows);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

// GET /erp/alerts/slow-movers?days=30
// Products with stock > 0 that have not appeared in a completed sale in the last N days
// (or have never been sold at all).
// Returns { items: [...], stats: { count, slowValue, totalValue, pctOfTotal } }
router.get("/erp/alerts/slow-movers", authenticate, requireStaff, requireStore, requirePermission("alerts", "view"), async (req: AuthRequest, res) => {
  try {
    const storeId = req.currentStoreId!;
    const rawDays = parseInt((req.query["days"] as string | undefined) ?? "30", 10);
    const days = Number.isFinite(rawDays) && rawDays > 0 ? rawDays : 30;

    const [itemsResult, totalResult] = await Promise.all([
      db.execute(sql`
        SELECT
          p.id,
          p.name_en,
          p.name_ar,
          p.image_url,
          p.reference,
          p.barcode,
          CAST(p.stock AS numeric)                                  AS stock,
          CAST(p.price AS numeric)                                  AS selling_price,
          CAST(p.cost_price AS numeric)                             AS cost_price,
          c.name_en                                                 AS category_name_en,
          c.name_ar                                                 AS category_name_ar,
          MAX(o.created_at)                                         AS last_sold_at,
          EXTRACT(DAY FROM NOW() - MAX(o.created_at))::int          AS days_since_last_sale
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id AND c.store_id = ${storeId}
        LEFT JOIN order_items oi ON oi.product_id = p.id
        LEFT JOIN orders o
               ON o.id       = oi.order_id
              AND o.store_id = ${storeId}
              AND o.status  NOT IN ('cancelled', 'draft')
        WHERE p.store_id = ${storeId}
          AND p.stock    > 0
          AND (p.is_active IS NULL OR p.is_active = true)
        GROUP BY p.id, p.name_en, p.name_ar, p.image_url,
                 p.reference, p.barcode, p.stock, p.price, p.cost_price,
                 c.name_en, c.name_ar
        HAVING MAX(o.created_at) IS NULL
            OR MAX(o.created_at) < NOW() - (${days} * INTERVAL '1 day')
        ORDER BY MAX(o.created_at) ASC NULLS FIRST,
                 CAST(p.stock AS numeric) DESC
      `),
      db.execute(sql`
        SELECT COALESCE(SUM(CAST(stock AS numeric) * CAST(cost_price AS numeric)), 0)
               AS total_inventory_value
        FROM products
        WHERE store_id    = ${storeId}
          AND (is_active IS NULL OR is_active = true)
          AND stock > 0
          AND cost_price  > 0
      `),
    ]);

    type SlowRow = { stock: string; cost_price: string | null };
    const items = itemsResult.rows as SlowRow[];
    const totalValue = Number(
      (totalResult.rows[0] as { total_inventory_value: string }).total_inventory_value,
    );
    const slowValue = items.reduce(
      (sum, r) => sum + Number(r.stock) * Number(r.cost_price ?? 0),
      0,
    );
    const pctOfTotal = totalValue > 0
      ? Math.round((slowValue / totalValue) * 1000) / 10
      : 0;

    res.json({
      items,
      stats: {
        count:      items.length,
        slowValue:  Math.round(slowValue),
        totalValue: Math.round(totalValue),
        pctOfTotal,
      },
    });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

// ─── Product expiry batches ────────────────────────────────────────────────

// GET /erp/products/:id/expiry-batches — list batches for one product (store-scoped)
router.get("/erp/products/:id/expiry-batches", authenticate, requireStaff, requireStore, requirePermission("products", "view"), async (req: AuthRequest, res) => {
  try {
    const storeId = req.currentStoreId!;
    const productId = pid(req, "id");
    if (isNaN(productId)) return res.status(400).json({ error: "Invalid product id" });

    const rows = await db.execute(sql`
      SELECT id, product_id, store_id, quantity, expiry_date, lot_number, notes, created_at
      FROM product_expiry_batches
      WHERE product_id = ${productId} AND store_id = ${storeId}
      ORDER BY expiry_date ASC
    `);
    return res.json(rows.rows);
  } catch (err) { req.log.error(err); return res.status(500).json({ error: "Internal server error" }); }
});

// POST /erp/products/:id/expiry-batches — add a new batch
router.post("/erp/products/:id/expiry-batches", authenticate, requireStaff, requireStore, requirePermission("products", "edit"), async (req: AuthRequest, res) => {
  try {
    const storeId = req.currentStoreId!;
    const productId = pid(req, "id");
    if (isNaN(productId)) return res.status(400).json({ error: "Invalid product id" });

    const { quantity, expiryDate, lotNumber, notes } = req.body as {
      quantity?: unknown; expiryDate?: unknown; lotNumber?: unknown; notes?: unknown;
    };
    const qty = parseFloat(String(quantity ?? "0"));
    const dateStr = String(expiryDate ?? "").trim();
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return res.status(400).json({ error: "expiryDate must be YYYY-MM-DD" });
    }
    if (isNaN(qty) || qty < 0) return res.status(400).json({ error: "Invalid quantity" });

    // Verify product belongs to this store
    const prod = await db.execute(sql`SELECT id FROM products WHERE id = ${productId} AND store_id = ${storeId} LIMIT 1`);
    if (!prod.rows.length) return res.status(404).json({ error: "Product not found" });

    const result = await db.execute(sql`
      INSERT INTO product_expiry_batches (product_id, store_id, quantity, expiry_date, lot_number, notes)
      VALUES (${productId}, ${storeId}, ${qty}, ${dateStr}, ${lotNumber ?? null}, ${notes ?? null})
      RETURNING *
    `);
    return res.status(201).json(result.rows[0]);
  } catch (err) { req.log.error(err); return res.status(500).json({ error: "Internal server error" }); }
});

// DELETE /erp/expiry-batches/:batchId — remove a batch
router.delete("/erp/expiry-batches/:batchId", authenticate, requireStaff, requireStore, requirePermission("products", "edit"), async (req: AuthRequest, res) => {
  try {
    const storeId = req.currentStoreId!;
    const batchId = pid(req, "batchId");
    if (isNaN(batchId)) return res.status(400).json({ error: "Invalid batch id" });

    const result = await db.execute(sql`
      DELETE FROM product_expiry_batches
      WHERE id = ${batchId} AND store_id = ${storeId}
      RETURNING id
    `);
    if (!result.rows.length) return res.status(404).json({ error: "Batch not found" });
    return res.json({ ok: true });
  } catch (err) { req.log.error(err); return res.status(500).json({ error: "Internal server error" }); }
});

// ── Product extra barcodes ─────────────────────────────────────────────────
// GET /erp/products/:id/barcodes — list additional barcodes for a product
router.get("/erp/products/:id/barcodes", authenticate, requireStaff, requireStore, requirePermission("products", "view"), async (req: AuthRequest, res) => {
  try {
    const storeId = req.currentStoreId!;
    const productId = pid(req, "id");
    if (isNaN(productId)) return res.status(400).json({ error: "Invalid product id" });

    // Verify product belongs to store
    const prod = await db.execute(sql`SELECT id FROM products WHERE id = ${productId} AND store_id = ${storeId} LIMIT 1`);
    if (!prod.rows.length) return res.status(404).json({ error: "Product not found" });

    const rows = await db.execute(sql`
      SELECT id, barcode, created_at
      FROM product_barcodes
      WHERE product_id = ${productId} AND store_id = ${storeId}
      ORDER BY created_at ASC
    `);
    return res.json(rows.rows);
  } catch (err) { req.log.error(err); return res.status(500).json({ error: "Internal server error" }); }
});

// POST /erp/products/:id/barcodes — add a new barcode to a product
router.post("/erp/products/:id/barcodes", authenticate, requireStaff, requireStore, requirePermission("products", "manage_barcodes"), async (req: AuthRequest, res) => {
  try {
    const storeId = req.currentStoreId!;
    const productId = pid(req, "id");
    if (isNaN(productId)) return res.status(400).json({ error: "Invalid product id" });

    const { barcode } = req.body as { barcode?: string };
    if (!barcode || !String(barcode).trim()) return res.status(400).json({ error: "Barcode is required" });
    const bc = String(barcode).trim();

    // Verify product belongs to store
    const prod = await db.execute(sql`SELECT id FROM products WHERE id = ${productId} AND store_id = ${storeId} LIMIT 1`);
    if (!prod.rows.length) return res.status(404).json({ error: "Product not found" });

    const result = await db.execute(sql`
      INSERT INTO product_barcodes (product_id, store_id, barcode)
      VALUES (${productId}, ${storeId}, ${bc})
      RETURNING id, barcode, created_at
    `);
    return res.status(201).json(result.rows[0]);
  } catch (err: unknown) {
    const pg = err as { code?: string };
    if (pg.code === "23505") return res.status(409).json({ error: "Ce barcode existe déjà" });
    req.log.error(err); return res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /erp/products/:id/barcodes/:barcodeId — remove an extra barcode
router.delete("/erp/products/:id/barcodes/:barcodeId", authenticate, requireStaff, requireStore, requirePermission("products", "manage_barcodes"), async (req: AuthRequest, res) => {
  try {
    const storeId = req.currentStoreId!;
    const productId = pid(req, "id");
    const barcodeId = pid(req, "barcodeId");
    if (isNaN(productId) || isNaN(barcodeId)) return res.status(400).json({ error: "Invalid id" });

    const result = await db.execute(sql`
      DELETE FROM product_barcodes
      WHERE id = ${barcodeId} AND product_id = ${productId} AND store_id = ${storeId}
      RETURNING id
    `);
    if (!result.rows.length) return res.status(404).json({ error: "Barcode not found" });
    return res.json({ ok: true });
  } catch (err) { req.log.error(err); return res.status(500).json({ error: "Internal server error" }); }
});

// GET /erp/alerts/expiring-products?days=N — batches expiring within N days
router.get("/erp/alerts/expiring-products", authenticate, requireStaff, requireStore, requirePermission("alerts", "view"), async (req: AuthRequest, res) => {
  try {
    const storeId = req.currentStoreId!;
    const days = Math.max(1, Math.min(365, parseInt(String(req.query.days ?? "30"), 10) || 30));

    const rows = await db.execute(sql`
      SELECT
        b.id              AS batch_id,
        b.product_id,
        b.quantity,
        b.expiry_date,
        b.lot_number,
        b.notes,
        p.name_en,
        p.name_ar,
        p.reference,
        p.barcode,
        p.image_url,
        (b.expiry_date::date - CURRENT_DATE) AS days_left
      FROM product_expiry_batches b
      JOIN products p ON p.id = b.product_id
      WHERE b.store_id = ${storeId}
        AND b.expiry_date::date <= CURRENT_DATE + (${days} || ' days')::interval
      ORDER BY b.expiry_date ASC
    `);
    res.json(rows.rows);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

// GET /erp/alerts/count — lightweight badge count (sum of all alert types)
// Uses a fixed 30-day window for slow-movers in the badge (detail page can filter further).
router.get("/erp/alerts/count", authenticate, requireStaff, requireStore, requirePermission("alerts", "view"), async (req: AuthRequest, res) => {
  try {
    const storeId = req.currentStoreId!;

    const [crossResult, slowResult, expiryResult] = await Promise.all([
      db.execute(sql`
        SELECT COUNT(DISTINCT COALESCE(NULLIF(src.reference, ''), src.barcode))
               AS cross_store_missing
        FROM   products src
        LEFT JOIN products dst ON (
          dst.store_id = ${storeId}
          AND (
            (src.reference IS NOT NULL AND src.reference <> '' AND dst.reference = src.reference)
            OR (
              (src.reference IS NULL OR src.reference = '')
              AND src.barcode IS NOT NULL AND src.barcode <> ''
              AND dst.barcode = src.barcode
            )
          )
        )
        WHERE src.store_id <> ${storeId}
          AND (src.is_active IS NULL OR src.is_active = true)
          AND src.stock > 0
          AND (dst.id IS NULL OR dst.stock = 0)
          AND (
            (src.reference IS NOT NULL AND src.reference <> '')
            OR (src.barcode IS NOT NULL AND src.barcode <> '')
          )
      `),
      db.execute(sql`
        SELECT COUNT(*) AS slow_movers
        FROM products p
        WHERE p.store_id = ${storeId}
          AND p.stock    > 0
          AND (p.is_active IS NULL OR p.is_active = true)
          AND NOT EXISTS (
            SELECT 1
            FROM   order_items oi
            JOIN   orders o ON o.id = oi.order_id
                          AND o.store_id = ${storeId}
                          AND o.status NOT IN ('cancelled', 'draft')
            WHERE  oi.product_id  = p.id
              AND  o.created_at  >= NOW() - INTERVAL '30 days'
          )
      `),
      db.execute(sql`
        SELECT COUNT(*) AS expiring
        FROM product_expiry_batches
        WHERE store_id = ${storeId}
          AND expiry_date::date <= CURRENT_DATE + INTERVAL '30 days'
      `),
    ]);

    const crossRow  = crossResult.rows[0]  as { cross_store_missing: string };
    const slowRow   = slowResult.rows[0]   as { slow_movers: string };
    const expiryRow = expiryResult.rows[0] as { expiring: string };
    res.json({
      crossStoreMissing: Number(crossRow.cross_store_missing),
      slowMovers:        Number(slowRow.slow_movers),
      expiringProducts:  Number(expiryRow.expiring),
    });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

// ─── Purchase suggestions ────────────────────────────────────────────────────

// GET /erp/purchase-suggestions — list by store, ordered by demand_count DESC
router.get("/erp/purchase-suggestions", authenticate, requireStaff, requireStore, async (req: AuthRequest, res) => {
  try {
    const storeId = req.currentStoreId!;
    const rows = await db
      .select({
        id: schema.purchaseSuggestionsTable.id,
        product_name: schema.purchaseSuggestionsTable.productName,
        image_url: schema.purchaseSuggestionsTable.imageUrl,
        notes: schema.purchaseSuggestionsTable.notes,
        market_price: schema.purchaseSuggestionsTable.marketPrice,
        demand_count: schema.purchaseSuggestionsTable.demandCount,
        staff_id: schema.purchaseSuggestionsTable.staffId,
        staff_name: schema.usersTable.name,
        created_at: schema.purchaseSuggestionsTable.createdAt,
      })
      .from(schema.purchaseSuggestionsTable)
      .leftJoin(schema.usersTable, eq(schema.purchaseSuggestionsTable.staffId, schema.usersTable.id))
      .where(eq(schema.purchaseSuggestionsTable.storeId, storeId))
      .orderBy(desc(schema.purchaseSuggestionsTable.demandCount));
    res.json(rows);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

// POST /erp/purchase-suggestions — create a suggestion
router.post("/erp/purchase-suggestions", authenticate, requireStaff, requireStore, async (req: AuthRequest, res) => {
  try {
    const storeId = req.currentStoreId!;
    const staffId = req.user!.id;
    const { product_name, image_url, notes, market_price } = req.body as {
      product_name?: string;
      image_url?: string;
      notes?: string;
      market_price?: string;
    };
    if (!product_name || !String(product_name).trim()) {
      res.status(400).json({ error: "product_name is required" });
      return;
    }
    const [row] = await db
      .insert(schema.purchaseSuggestionsTable)
      .values({
        storeId,
        staffId,
        productName: String(product_name).trim(),
        imageUrl: image_url ?? null,
        notes: notes ?? null,
        marketPrice: market_price ?? null,
        demandCount: 0,
      })
      .returning();
    res.status(201).json(row);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

// PATCH /erp/purchase-suggestions/:id — edit (creator or admin only)
router.patch("/erp/purchase-suggestions/:id", authenticate, requireStaff, requireStore, async (req: AuthRequest, res) => {
  try {
    const storeId = req.currentStoreId!;
    const id = pid(req, "id");
    const userId = req.user!.id;
    const admin = isAdmin(req);
    const { product_name, image_url, notes, market_price } = req.body as {
      product_name?: string;
      image_url?: string;
      notes?: string;
      market_price?: string;
    };
    // Check ownership
    const [existing] = await db
      .select({ staffId: schema.purchaseSuggestionsTable.staffId })
      .from(schema.purchaseSuggestionsTable)
      .where(and(
        eq(schema.purchaseSuggestionsTable.id, id),
        eq(schema.purchaseSuggestionsTable.storeId, storeId),
      ));
    if (!existing) { res.status(404).json({ error: "Suggestion not found" }); return; }
    if (!admin && existing.staffId !== userId) {
      res.status(403).json({ error: "Not authorized to edit this suggestion" });
      return;
    }
    const updates: Record<string, unknown> = {};
    if (product_name !== undefined) updates.productName = String(product_name).trim() || undefined;
    if (image_url !== undefined) updates.imageUrl = image_url || null;
    if (notes !== undefined) updates.notes = notes.trim() || null;
    if (market_price !== undefined) updates.marketPrice = market_price.trim() || null;
    if (Object.keys(updates).length === 0) { res.json({ ok: true }); return; }
    const [updated] = await db
      .update(schema.purchaseSuggestionsTable)
      .set(updates)
      .where(eq(schema.purchaseSuggestionsTable.id, id))
      .returning();
    res.json(updated);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

// POST /erp/purchase-suggestions/:id/tap — increment demand_count by 1
router.post("/erp/purchase-suggestions/:id/tap", authenticate, requireStaff, requireStore, async (req: AuthRequest, res) => {
  try {
    const storeId = req.currentStoreId!;
    const id = pid(req, "id");
    const [row] = await db
      .update(schema.purchaseSuggestionsTable)
      .set({ demandCount: sql`${schema.purchaseSuggestionsTable.demandCount} + 1` })
      .where(and(
        eq(schema.purchaseSuggestionsTable.id, id),
        eq(schema.purchaseSuggestionsTable.storeId, storeId),
      ))
      .returning();
    if (!row) { res.status(404).json({ error: "Suggestion not found" }); return; }
    res.json({ demand_count: row.demandCount });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

// DELETE /erp/purchase-suggestions/:id — admin or creator only
router.delete("/erp/purchase-suggestions/:id", authenticate, requireStaff, requireStore, async (req: AuthRequest, res) => {
  try {
    const storeId = req.currentStoreId!;
    const id = pid(req, "id");
    const userId = req.user!.id;
    const admin = isAdmin(req);
    // Fetch first to check ownership
    const [existing] = await db
      .select({ staffId: schema.purchaseSuggestionsTable.staffId })
      .from(schema.purchaseSuggestionsTable)
      .where(and(
        eq(schema.purchaseSuggestionsTable.id, id),
        eq(schema.purchaseSuggestionsTable.storeId, storeId),
      ));
    if (!existing) { res.status(404).json({ error: "Suggestion not found" }); return; }
    if (!admin && existing.staffId !== userId) {
      res.status(403).json({ error: "Not authorized to delete this suggestion" });
      return;
    }
    await db
      .delete(schema.purchaseSuggestionsTable)
      .where(eq(schema.purchaseSuggestionsTable.id, id));
    res.json({ ok: true });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

export default router;
