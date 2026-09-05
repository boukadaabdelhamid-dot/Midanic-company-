import { Router } from "express";
import { and, desc, eq, inArray, isNull, lt, ne, or, sql } from "drizzle-orm";
import { db, schema } from "../lib/db";
import {
  authenticate,
  requirePermission,
  requireStaff,
  requireStore,
  requireTenantAdmin,
  type AuthRequest,
} from "../lib/auth";
import { applyCaisseDelta } from "../lib/balance-sync";
import { ensureCaisse } from "./caisses";
import { broadcastCaisseChanged, broadcastToAdmins, broadcastToStaffByStores } from "../lib/ws";
import { mutateCustomerBalance } from "../lib/balance-sync";

const router = Router();
const pid = (req: { params: Record<string, string | string[]> }, key: string): number =>
  parseInt(req.params[key] as string);

router.get("/admin/low-stock", authenticate, requireTenantAdmin, requireStore, async (req: AuthRequest, res) => {
  try {
    const storeId = req.currentStoreId!;
    const raw = parseInt((req.query["threshold"] as string) || "5");
    const threshold = isNaN(raw) ? 5 : Math.max(0, raw);
    const lowStock = await db.select().from(schema.productsTable)
      .where(and(lt(schema.productsTable.stock, threshold), eq(schema.productsTable.storeId, storeId)))
      .orderBy(schema.productsTable.stock);
    res.json(lowStock);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/admin/analytics", authenticate, requireTenantAdmin, requireStore, async (req: AuthRequest, res) => {
  try {
    const storeId = req.currentStoreId!;
    const raw = parseInt((req.query["threshold"] as string) || "5");
    const threshold = isNaN(raw) ? 5 : Math.max(0, raw);
    const lowStock = await db.select().from(schema.productsTable)
      .where(and(lt(schema.productsTable.stock, threshold), eq(schema.productsTable.storeId, storeId)))
      .orderBy(schema.productsTable.stock);
    res.json(lowStock);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/admin/analytics", authenticate, requireTenantAdmin, requireStore, async (req: AuthRequest, res) => {
  try {
    const storeId = req.currentStoreId!;
    const [{ totalOrders }] = await db.select({ totalOrders: sql<number>`count(*)` })
      .from(schema.ordersTable).where(and(eq(schema.ordersTable.storeId, storeId), ne(schema.ordersTable.status, "draft")));
    // Only count confirmed (non-cancelled, non-draft, non-returned) orders for revenue
    const confirmedStatuses = sql`status NOT IN ('draft', 'cancelled')`;

    const [{ totalRevenue }] = await db.select({ totalRevenue: sql<number>`coalesce(sum(total_amount), 0)` })
      .from(schema.ordersTable)
      .where(and(eq(schema.ordersTable.storeId, storeId), sql`${confirmedStatuses}`));
    // Operating expenses only. Exclude category='purchase' (inventory acquisition,
    // not an operating charge — COGS is recognised at sale via order_items.cost_price;
    // covers legacy PO-receipt expense rows regardless of reference format). Exclude
    // RETOUR-% transactions: a refund's profit impact is already captured via
    // totalRetours (returned margin, deducted from grossProfit), so counting the cash
    // refund here too would double-deduct.
    const [{ totalExpenses }] = await db.select({ totalExpenses: sql<number>`coalesce(sum(amount), 0)` })
      .from(schema.transactionsTable)
      .where(and(
        eq(schema.transactionsTable.type, "expense"),
        eq(schema.transactionsTable.storeId, storeId),
        sql`category <> 'purchase'`,
        sql`(reference IS NULL OR reference NOT LIKE 'RETOUR-%')`,
        sql`(reference IS NULL OR reference NOT LIKE 'PO-%')`,
      ));
    const [{ pendingOrders }] = await db.select({ pendingOrders: sql<number>`count(*)` })
      .from(schema.ordersTable)
      .where(and(eq(schema.ordersTable.status, "pending"), eq(schema.ordersTable.storeId, storeId)));

    // COGS = sum of (quantity × cost_price) for all confirmed order items
    const cogsResult = await db.execute(sql`
      SELECT COALESCE(SUM(oi.quantity * oi.cost_price), 0) AS total_cogs
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE o.store_id = ${storeId} AND o.status NOT IN ('draft', 'cancelled')
        AND oi.cost_price IS NOT NULL
    `);
    const totalCogs = Number((cogsResult.rows[0] as Record<string, unknown>)?.["total_cogs"] ?? 0);

    const dailySales = await db.execute(sql`
      SELECT DATE(created_at) as date, COUNT(*) as orders, SUM(total_amount) as revenue
      FROM orders
      WHERE created_at >= NOW() - INTERVAL '30 days'
        AND store_id = ${storeId}
        AND status NOT IN ('draft', 'cancelled')
      GROUP BY DATE(created_at)
      ORDER BY DATE(created_at)
    `);

    // Channel split (online vs POS) for the same 30-day window as dailySales.
    // Uses order_source column (same logic as GET /admin/orders channel filter):
    //   online = order_source = 'online'  OR  (order_source IS NULL AND seller_user_id IS NULL)
    //   pos    = order_source IN ('pos', 'bon')
    const channelTotals = await db.execute(sql`
      SELECT
        COALESCE(SUM(CASE WHEN order_source = 'online' OR (order_source IS NULL AND seller_user_id IS NULL) THEN total_amount ELSE 0 END), 0) AS online_revenue,
        COUNT(*) FILTER (WHERE order_source = 'online' OR (order_source IS NULL AND seller_user_id IS NULL)) AS online_orders,
        COALESCE(SUM(CASE WHEN order_source IN ('pos', 'bon') THEN total_amount ELSE 0 END), 0) AS pos_revenue,
        COUNT(*) FILTER (WHERE order_source IN ('pos', 'bon')) AS pos_orders
      FROM orders
      WHERE created_at >= NOW() - INTERVAL '30 days'
        AND store_id = ${storeId}
        AND status NOT IN ('draft', 'cancelled')
    `);
    const ct = (channelTotals.rows[0] ?? {}) as Record<string, unknown>;

    const dailyChannelSales = await db.execute(sql`
      SELECT
        DATE(created_at) AS date,
        COALESCE(SUM(CASE WHEN order_source = 'online' OR (order_source IS NULL AND seller_user_id IS NULL) THEN total_amount ELSE 0 END), 0) AS online_revenue,
        COALESCE(SUM(CASE WHEN order_source IN ('pos', 'bon') THEN total_amount ELSE 0 END), 0) AS pos_revenue
      FROM orders
      WHERE created_at >= NOW() - INTERVAL '30 days'
        AND store_id = ${storeId}
        AND status NOT IN ('draft', 'cancelled')
      GROUP BY DATE(created_at)
      ORDER BY DATE(created_at)
    `);

    const topProducts = await db.execute(sql`
      SELECT p.id, p.name_ar, p.name_en, SUM(oi.quantity) as sold, SUM(oi.quantity * oi.unit_price) as revenue
      FROM order_items oi
      JOIN products p ON p.id = oi.product_id
      JOIN orders o ON o.id = oi.order_id
      WHERE o.store_id = ${storeId} AND o.status NOT IN ('draft', 'cancelled')
      GROUP BY p.id, p.name_ar, p.name_en
      ORDER BY sold DESC
      LIMIT 5
    `);

    const lowStock = await db.select().from(schema.productsTable)
      .where(and(lt(schema.productsTable.stock, 5), eq(schema.productsTable.storeId, storeId)))
      .orderBy(schema.productsTable.stock);

    // Returned PROFIT (not the refunded amount) via bon retours for this store.
    // A bon retour restocks the goods, so the item cost is recovered as inventory
    // and only the lost margin hits profit: Σ qty × (unit_price − cost). Cost comes
    // from the original order_items (the exact COGS booked), falling back to the
    // product cost for orderless comptoir returns. The full cash refund is recorded
    // separately in the caisse/treasury ledger.
    const retourResult = await db.execute(sql`
      SELECT COALESCE(SUM(bri.quantity * (bri.unit_price - COALESCE(oc.cost_price, p.cost_price, 0))), 0) AS total_retours
      FROM bon_retour_items bri
      JOIN bon_retours br ON br.id = bri.bon_retour_id
      LEFT JOIN (
        SELECT order_id, product_id, MAX(cost_price) AS cost_price
        FROM order_items GROUP BY order_id, product_id
      ) oc ON oc.order_id = br.original_order_id AND oc.product_id = bri.product_id
      LEFT JOIN products p ON p.id = bri.product_id
      WHERE br.store_id = ${storeId}
    `);
    const totalRetours = Number((retourResult.rows[0] as Record<string, unknown>)?.["total_retours"] ?? 0);

    // Sales gross profit = confirmed revenue − COGS − returned profit (discounts already embedded in order total_amount)
    const grossProfit = Number(totalRevenue) - totalCogs - totalRetours;
    const grossMargin = Number(totalRevenue) > 0 ? (grossProfit / Number(totalRevenue)) * 100 : 0;
    // Net profit = gross profit − operating expenses (accounting transactions)
    const netProfit = grossProfit - Number(totalExpenses);

    // Inventory value = SUM(stock × cost_price) for all products in this store
    const inventoryResult = await db.execute(sql`
      SELECT COALESCE(SUM(stock * cost_price), 0) AS inventory_value
      FROM products
      WHERE store_id = ${storeId} AND cost_price IS NOT NULL AND stock > 0
    `);
    const inventoryValue = Number((inventoryResult.rows[0] as Record<string, unknown>)?.["inventory_value"] ?? 0);

    // Customer debt = SUM of positive current_balance from customer_profiles for this store
    const customerDebtResult = await db.execute(sql`
      SELECT COALESCE(SUM(CASE WHEN current_balance > 0 THEN current_balance ELSE 0 END), 0) AS customer_debt
      FROM customer_profiles
      WHERE store_id = ${storeId}
    `);
    const customerDebt = Number((customerDebtResult.rows[0] as Record<string, unknown>)?.["customer_debt"] ?? 0);

    // Supplier payables = SUM of positive current_balance from suppliers for this store
    const supplierPayablesResult = await db.execute(sql`
      SELECT COALESCE(SUM(CASE WHEN current_balance > 0 THEN current_balance ELSE 0 END), 0) AS supplier_payables
      FROM suppliers
      WHERE store_id = ${storeId}
    `);
    const supplierPayables = Number((supplierPayablesResult.rows[0] as Record<string, unknown>)?.["supplier_payables"] ?? 0);

    res.json({
      totalOrders: Number(totalOrders),
      totalRevenue: Number(totalRevenue),
      totalExpenses: Number(totalExpenses),
      totalCogs,
      totalRetours,
      grossProfit,
      grossMargin: Math.round(grossMargin * 100) / 100,
      netProfit,
      inventoryValue,
      customerDebt,
      supplierPayables,
      pendingOrders: Number(pendingOrders),
      dailySales: dailySales.rows,
      topProducts: topProducts.rows,
      lowStock,
      channelBreakdown: {
        online: { revenue: Number(ct["online_revenue"] ?? 0), orders: Number(ct["online_orders"] ?? 0) },
        pos:    { revenue: Number(ct["pos_revenue"]    ?? 0), orders: Number(ct["pos_orders"]    ?? 0) },
      },
      dailyChannelSales: dailyChannelSales.rows.map((r) => {
        const row = r as Record<string, unknown>;
        return {
          date: String(row["date"]),
          onlineRevenue: Number(row["online_revenue"] ?? 0),
          posRevenue:    Number(row["pos_revenue"]    ?? 0),
        };
      }),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /admin/orders — store-scoped list used by ERP order screens.
router.get("/admin/orders", authenticate, requireStaff, requireStore, requirePermission("orders", "view"), async (req: AuthRequest, res) => {
  try {
    const storeId = req.currentStoreId!;
    const rawChannel = req.query["channel"];
    const channel = typeof rawChannel === "string" ? rawChannel : "all";

    if (!["all", "online", "pos"].includes(channel)) {
      res.status(400).json({ error: "Invalid channel. Must be one of: all, online, pos" });
      return;
    }

    const channelFilter =
      channel === "online"
        ? or(
            eq(schema.ordersTable.orderSource, "online"),
            and(isNull(schema.ordersTable.orderSource), isNull(schema.ordersTable.sellerUserId)),
          )
        : channel === "pos"
          ? or(
              eq(schema.ordersTable.orderSource, "pos"),
              eq(schema.ordersTable.orderSource, "bon"),
            )
          : undefined;
    const noDraft = ne(schema.ordersTable.status, "draft");
    const whereClause = channelFilter
      ? and(eq(schema.ordersTable.storeId, storeId), channelFilter, noDraft)
      : and(eq(schema.ordersTable.storeId, storeId), noDraft);

    const orders = await db
      .select()
      .from(schema.ordersTable)
      .where(whereClause)
      .orderBy(desc(schema.ordersTable.createdAt));
    const sellerIds = Array.from(
      new Set(orders.map((order) => order.sellerUserId).filter((id): id is number => id != null)),
    );
    const sellers = sellerIds.length
      ? await db
          .select({
            id: schema.usersTable.id,
            name: schema.usersTable.name,
            email: schema.usersTable.email,
          })
          .from(schema.usersTable)
          .where(inArray(schema.usersTable.id, sellerIds))
      : [];
    const sellerMap = new Map(sellers.map((seller) => [seller.id, seller]));

    res.json(
      orders.map((order) => ({
        ...order,
        sellerUser: order.sellerUserId ? sellerMap.get(order.sellerUserId) ?? null : null,
      })),
    );
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POS Bons en attente (Draft orders) ──────────────────────────────────────
// Drafts use the same ordersTable (status='draft') + orderItemsTable.
// They intentionally skip stock deduction, inventory movements,
// accounting transactions, caisse credit and WebSocket broadcasts.

// POST /erp/pos/drafts — save current POS cart as a draft
router.post("/erp/pos/drafts", authenticate, requireStaff, requireStore, requirePermission("orders", "view"), async (req: AuthRequest, res) => {
  try {
    const storeId = req.currentStoreId!;
    const sellerUserId = req.user!.id;
    const { customerName, customerPhone, linkedCustomerId, lines } = req.body as {
      customerName?: string;
      customerPhone?: string;
      linkedCustomerId?: number | null;
      lines: { productId: number; qty: number; pu: number }[];
    };
    if (!Array.isArray(lines) || lines.length === 0) {
      res.status(400).json({ error: "lines is required and must not be empty" });
      return;
    }
    const totalAmount = lines.reduce((s, l) => s + (l.qty ?? 0) * (l.pu ?? 0), 0);
    const [draft] = await db.insert(schema.ordersTable).values({
      storeId,
      sellerUserId,
      userId: linkedCustomerId ?? null,
      customerName: customerName || "BON EN ATTENTE",
      customerPhone: customerPhone || "0000000000",
      customerAddress: "En attente",
      totalAmount: totalAmount.toFixed(2),
      discountAmount: "0.00",
      status: "draft",
      orderSource: "pos",
    }).returning();
    for (const line of lines) {
      await db.insert(schema.orderItemsTable).values({
        orderId: draft.id,
        productId: line.productId,
        quantity: line.qty,
        unitPrice: (line.pu ?? 0).toFixed(2),
      });
    }
    res.status(201).json(draft);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /erp/pos/drafts — list all drafts for this store (with their items)
router.get("/erp/pos/drafts", authenticate, requireStaff, requireStore, requirePermission("orders", "view"), async (req: AuthRequest, res) => {
  try {
    const storeId = req.currentStoreId!;
    const drafts = await db.select().from(schema.ordersTable)
      .where(and(eq(schema.ordersTable.storeId, storeId), eq(schema.ordersTable.status, "draft")))
      .orderBy(desc(schema.ordersTable.createdAt));
    const result = await Promise.all(drafts.map(async (draft) => {
      const items = await db.select({
        productId: schema.orderItemsTable.productId,
        quantity: schema.orderItemsTable.quantity,
        unitPrice: schema.orderItemsTable.unitPrice,
        nameEn: schema.productsTable.nameEn,
        nameAr: schema.productsTable.nameAr,
      })
        .from(schema.orderItemsTable)
        .leftJoin(schema.productsTable, eq(schema.orderItemsTable.productId, schema.productsTable.id))
        .where(eq(schema.orderItemsTable.orderId, draft.id));
      return { ...draft, linkedCustomerId: draft.userId ?? null, items };
    }));
    res.json(result);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /erp/pos/drafts/:id — discard a draft and its items
router.delete("/erp/pos/drafts/:id", authenticate, requireStaff, requireStore, requirePermission("orders", "view"), async (req: AuthRequest, res) => {
  try {
    const storeId = req.currentStoreId!;
    const draftId = pid(req, "id");
    const [draft] = await db.select({ id: schema.ordersTable.id, status: schema.ordersTable.status })
      .from(schema.ordersTable)
      .where(and(eq(schema.ordersTable.id, draftId), eq(schema.ordersTable.storeId, storeId)))
      .limit(1);
    if (!draft) { res.status(404).json({ error: "Draft not found" }); return; }
    if (draft.status !== "draft") { res.status(400).json({ error: "Order is not a draft" }); return; }
    await db.delete(schema.orderItemsTable).where(eq(schema.orderItemsTable.orderId, draftId));
    await db.delete(schema.ordersTable).where(eq(schema.ordersTable.id, draftId));
    res.status(204).end();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /erp/pos/drafts/:id — replace items of an existing draft (update in-place)
router.put("/erp/pos/drafts/:id", authenticate, requireStaff, requireStore, requirePermission("orders", "view"), async (req: AuthRequest, res) => {
  try {
    const storeId = req.currentStoreId!;
    const draftId = pid(req, "id");
    const { customerName, customerPhone, linkedCustomerId, lines } = req.body as {
      customerName?: string;
      customerPhone?: string;
      linkedCustomerId?: number | null;
      lines: { productId: number; qty: number; pu: number }[];
    };
    if (!Array.isArray(lines) || lines.length === 0) {
      res.status(400).json({ error: "lines is required and must not be empty" });
      return;
    }
    const [draft] = await db.select({ id: schema.ordersTable.id, status: schema.ordersTable.status })
      .from(schema.ordersTable)
      .where(and(eq(schema.ordersTable.id, draftId), eq(schema.ordersTable.storeId, storeId)))
      .limit(1);
    if (!draft) { res.status(404).json({ error: "Draft not found" }); return; }
    if (draft.status !== "draft") { res.status(400).json({ error: "Order is not a draft" }); return; }

    const totalAmount = lines.reduce((s, l) => s + (l.qty ?? 0) * (l.pu ?? 0), 0);

    await db.transaction(async (tx) => {
      // Delete existing items then re-insert — atomic replace.
      await tx.delete(schema.orderItemsTable).where(eq(schema.orderItemsTable.orderId, draftId));
      await tx.update(schema.ordersTable)
        .set({
          userId: linkedCustomerId !== undefined ? (linkedCustomerId ?? null) : undefined,
          customerName: customerName || "BON EN ATTENTE",
          customerPhone: customerPhone || "0000000000",
          totalAmount: totalAmount.toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(schema.ordersTable.id, draftId));
      for (const line of lines) {
        await tx.insert(schema.orderItemsTable).values({
          orderId: draftId,
          productId: line.productId,
          quantity: line.qty,
          unitPrice: (line.pu ?? 0).toFixed(2),
        });
      }
    });

    const [updated] = await db.select().from(schema.ordersTable)
      .where(eq(schema.ordersTable.id, draftId)).limit(1);
    res.json(updated);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /erp/pos/drafts/:id/confirm — convert draft → real order
// Runs the full atomic pipeline: stock check, deduction, inventory movements,
// accounting transaction, caisse credit, and WebSocket broadcasts.
// The draft order row is updated in-place (status: draft → pending),
// so the order ID is preserved.
router.post("/erp/pos/drafts/:id/confirm", authenticate, requireStaff, requireStore, requirePermission("caisse", "create"), async (req: AuthRequest, res) => {
  try {
    const storeId = req.currentStoreId!;
    const draftId = pid(req, "id");
    const sellerUserId = (req.user!.role === "admin" || req.user!.role === "tenant_admin" || req.user!.role === "employee")
      ? req.user!.id : null;

    const [draft] = await db.select().from(schema.ordersTable)
      .where(and(
        eq(schema.ordersTable.id, draftId),
        eq(schema.ordersTable.storeId, storeId),
        eq(schema.ordersTable.status, "draft"),
      )).limit(1);
    if (!draft) { res.status(404).json({ error: "Draft not found" }); return; }

    const draftItems = await db.select({
      productId: schema.orderItemsTable.productId,
      quantity: schema.orderItemsTable.quantity,
      unitPrice: schema.orderItemsTable.unitPrice,
    }).from(schema.orderItemsTable).where(eq(schema.orderItemsTable.orderId, draftId));
    if (!draftItems.length) { res.status(400).json({ error: "Draft has no items" }); return; }

    const customerName = (req.body as { customerName?: string }).customerName || draft.customerName;
    const customerPhone = (req.body as { customerPhone?: string }).customerPhone || draft.customerPhone;
    const customerAddress = (req.body as { customerAddress?: string }).customerAddress || "Vente comptoir";

    const result = await db.transaction(async (tx) => {
      let totalAmount = 0;
      const enrichedItems: {
        productId: number; quantity: number; unitPrice: number;
        product: typeof schema.productsTable.$inferSelect;
      }[] = [];

      for (const item of draftItems) {
        const [product] = await tx.select().from(schema.productsTable)
          .where(and(eq(schema.productsTable.id, item.productId), eq(schema.productsTable.storeId, storeId)))
          .for("update").limit(1);
        if (!product) throw Object.assign(new Error(`Produit ${item.productId} introuvable`), { status: 400 });
        if (product.stock < item.quantity) {
          throw Object.assign(
            new Error(`Stock insuffisant pour ${product.nameEn}: ${product.stock} disponible`),
            { status: 400 },
          );
        }
        const unitPrice = parseFloat(item.unitPrice);
        totalAmount += unitPrice * item.quantity;
        enrichedItems.push({ productId: item.productId, quantity: item.quantity, unitPrice, product });
      }

      // Promote draft → pending (same order ID, recalculated total)
      const [order] = await tx.update(schema.ordersTable).set({
        status: "pending",
        customerName,
        customerPhone,
        customerAddress,
        sellerUserId,
        totalAmount: totalAmount.toFixed(2),
        orderSource: "pos",
        updatedAt: new Date(),
      }).where(eq(schema.ordersTable.id, draftId)).returning();

      // Stock deduction + inventory movements
      for (const item of enrichedItems) {
        const newStock = item.product.stock - item.quantity;
        await tx.update(schema.productsTable)
          .set({ stock: newStock })
          .where(eq(schema.productsTable.id, item.productId));
        await tx.update(schema.orderItemsTable)
          .set({ costPrice: item.product.costPrice ?? null })
          .where(and(
            eq(schema.orderItemsTable.orderId, order.id),
            eq(schema.orderItemsTable.productId, item.productId),
          ));
        await tx.insert(schema.inventoryMovementsTable).values({
          storeId,
          productId: item.productId,
          type: "out",
          quantity: item.quantity,
          reason: "Sale",
          reference: `ORDER-${order.id}`,
        });
        if (newStock < 5) item.product = { ...item.product, stock: newStock };
      }

      // Accounting
      await tx.insert(schema.transactionsTable).values({
        storeId,
        type: "income",
        category: "sales",
        amount: totalAmount.toFixed(2),
        description: `Order #${order.id} - ${customerName}`,
        date: new Date().toISOString().split("T")[0],
        reference: `ORDER-${order.id}`,
      });

      // Caisse credit
      let sellerCaisseId: number | null = null;
      if (sellerUserId !== null && totalAmount > 0) {
        const sellerCaisse = await ensureCaisse(storeId, sellerUserId, tx);
        sellerCaisseId = sellerCaisse.id;
        const { oldBalance: posCaisseOld, newBalance: posCaisseNew } = await applyCaisseDelta(tx, sellerCaisse.id, totalAmount);
        await tx.insert(schema.caisseMovementsTable).values({
          caisseId: sellerCaisse.id,
          type: "credit",
          amount: totalAmount.toFixed(2),
          reason: "sale",
          orderId: order.id,
          actorUserId: sellerUserId,
          notes: `POS sale to ${customerName}`,
          balanceBefore: posCaisseOld.toFixed(2),
          balanceAfter: posCaisseNew.toFixed(2),
        });
      }

      return { order, enrichedItems, totalAmount, sellerCaisseId };
    });

    // Broadcasts — identical to handleCreateOrder
    broadcastToStaffByStores([storeId], {
      type: "new_order",
      storeId,
      sellerUserId,
      order: {
        id: result.order.id, customerName, customerPhone, customerAddress,
        totalAmount: result.totalAmount, createdAt: result.order.createdAt,
      },
    });
    if (result.sellerCaisseId !== null) {
      await broadcastCaisseChanged(storeId, [result.sellerCaisseId]);
    }
    for (const item of result.enrichedItems) {
      if (item.product.stock < 5) {
        broadcastToAdmins({
          type: "low_stock", storeId,
          product: { id: item.productId, nameEn: item.product.nameEn, nameAr: item.product.nameAr, stock: item.product.stock },
        });
      }
    }

    res.json({
      ...result.order,
      items: result.enrichedItems.map((i) => ({ productId: i.productId, quantity: i.quantity, unitPrice: i.unitPrice })),
    });
  } catch (err) {
    const e = err as { status?: number; message?: string };
    if (e.status === 400) { res.status(400).json({ error: e.message }); return; }
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Bon Retour ──────────────────────────────────────────────────────────────

router.post("/admin/orders/:id/retours", authenticate, requireStaff, requireStore, requirePermission("orders", "create"), async (req: AuthRequest, res) => {
  try {
    const storeId = req.currentStoreId!;
    const orderId = pid(req, "id");
    const createdByUserId = req.user!.id;
    const { reason, retourType, items } = req.body as {
      reason?: string;
      retourType?: string;
      items: { productId: number; quantity: number }[];
    };

    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: "items is required and must not be empty" });
      return;
    }

    // Consolidate duplicate productIds in the same request
    const consolidatedItems = Object.values(
      items.reduce((acc: Record<number, { productId: number; quantity: number }>, item) => {
        const id = Number(item.productId);
        if (!acc[id]) acc[id] = { productId: id, quantity: 0 };
        acc[id].quantity += Number(item.quantity);
        return acc;
      }, {})
    );

    const [order] = await db.select().from(schema.ordersTable)
      .where(and(eq(schema.ordersTable.id, orderId), eq(schema.ordersTable.storeId, storeId)));
    if (!order) { res.status(404).json({ error: "Order not found" }); return; }
    if (order.status === "draft" || order.status === "cancelled") {
      res.status(400).json({ error: "Cannot create Bon Retour for draft or cancelled orders" });
      return;
    }
    // A "sans remboursement" retour credits the customer's account (avoir).
    // Without a linked customer there is nobody to credit, so reject instead
    // of silently creating a retour with no financial side-effect.
    if (retourType === "sans_remboursement" && !order.userId) {
      res.status(400).json({ error: "Un retour sans remboursement nécessite une commande liée à un client (avoir client)." });
      return;
    }

    const originalItems = await db.select().from(schema.orderItemsTable)
      .where(eq(schema.orderItemsTable.orderId, orderId));

    const existingRetours = await db.select({ id: schema.bonRetoursTable.id })
      .from(schema.bonRetoursTable)
      .where(eq(schema.bonRetoursTable.originalOrderId, orderId));
    const existingRetourIds = existingRetours.map(r => r.id);

    const alreadyReturned: Record<number, number> = {};
    if (existingRetourIds.length > 0) {
      const returnedItems = await db.select({
        productId: schema.bonRetourItemsTable.productId,
        quantity: schema.bonRetourItemsTable.quantity,
      }).from(schema.bonRetourItemsTable)
        .where(inArray(schema.bonRetourItemsTable.bonRetourId, existingRetourIds));
      for (const ri of returnedItems) {
        alreadyReturned[ri.productId] = (alreadyReturned[ri.productId] ?? 0) + ri.quantity;
      }
    }

    const originalQtyMap: Record<number, { qty: number; unitPrice: string }> = {};
    for (const oi of originalItems) {
      originalQtyMap[oi.productId] = { qty: oi.quantity, unitPrice: oi.unitPrice };
    }

    for (const item of consolidatedItems) {
      if (item.quantity <= 0) {
        res.status(400).json({ error: `Quantity must be positive for product ${item.productId}` });
        return;
      }
      const original = originalQtyMap[item.productId];
      if (!original) {
        res.status(400).json({ error: `Product ${item.productId} is not in the original order` });
        return;
      }
      const maxReturnable = original.qty - (alreadyReturned[item.productId] ?? 0);
      if (item.quantity > maxReturnable) {
        res.status(400).json({ error: `Cannot return ${item.quantity} of product ${item.productId}. Max returnable: ${maxReturnable}` });
        return;
      }
    }

    let retourCaisseId: number | null = null;
    const result = await db.transaction(async (tx) => {
      const [bonRetour] = await tx.insert(schema.bonRetoursTable).values({
        storeId,
        originalOrderId: orderId,
        reason: reason ?? null,
        retourType: retourType ?? null,
        createdByUserId,
      }).returning();

      const retourItems = [];
      let retourTotal = 0;
      for (const item of consolidatedItems) {
        const unitPrice = originalQtyMap[item.productId].unitPrice;
        const [retourItem] = await tx.insert(schema.bonRetourItemsTable).values({
          bonRetourId: bonRetour.id,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice,
        }).returning();
        retourItems.push(retourItem);
        retourTotal += item.quantity * parseFloat(unitPrice);

        await tx.update(schema.productsTable)
          .set({ stock: sql`${schema.productsTable.stock} + ${item.quantity}` })
          .where(eq(schema.productsTable.id, item.productId));

        await tx.insert(schema.inventoryMovementsTable).values({
          storeId,
          productId: item.productId,
          type: "in",
          quantity: item.quantity,
          reason: "Retour",
          reference: `RETOUR-${bonRetour.id}`,
        });
      }

      // Financial side-effect depends on the retour type:
      //  - "sans_remboursement": no cash leaves the till. Instead the linked
      //    customer is credited with an "avoir_retour" that reduces what they
      //    owe (current_balance). No caisse debit, no expense transaction.
      //  - otherwise (refund): cash leaves the till → expense + caisse debit.
      if (retourTotal > 0) {
        if (retourType === "sans_remboursement") {
          if (order.userId) {
            const { oldBalance: custOld, newBalance: custNew } = await mutateCustomerBalance(tx, order.userId, storeId, { delta: -retourTotal });
            await tx.insert(schema.customerOperationsTable).values({
              customerId: order.userId,
              storeId,
              type: "avoir_retour",
              amount: retourTotal.toFixed(2),
              date: new Date().toISOString().split("T")[0],
              reference: `RETOUR-${bonRetour.id}`,
              note: `Avoir retour — Bon Retour #${bonRetour.id} - commande #${orderId}`,
              createdBy: createdByUserId,
              caisseId: null,
              balanceBefore: custOld.toFixed(2),
              balanceAfter: custNew.toFixed(2),
            });
          }
        } else {
          await tx.insert(schema.transactionsTable).values({
            storeId,
            type: "expense",
            category: "other",
            amount: retourTotal.toFixed(2),
            description: `Bon Retour #${bonRetour.id} - commande #${orderId}`,
            date: new Date().toISOString().split("T")[0],
            reference: `RETOUR-${bonRetour.id}`,
          });

          // Debit the acting user's caisse — the refund cash leaves the actor's
          // till regardless of how the original order was sold (POS, COD, or web).
          const actorCaisse = await ensureCaisse(storeId, createdByUserId, tx);
          retourCaisseId = actorCaisse.id;
          const { oldBalance: retourCaisseOld, newBalance: retourCaisseNew } = await applyCaisseDelta(tx, actorCaisse.id, -retourTotal);
          await tx.insert(schema.caisseMovementsTable).values({
            caisseId: actorCaisse.id,
            type: "debit",
            balanceBefore: retourCaisseOld.toFixed(2),
            balanceAfter: retourCaisseNew.toFixed(2),
            amount: retourTotal.toFixed(2),
            reason: "adjustment",
            actorUserId: createdByUserId,
            notes: `Bon Retour #${bonRetour.id} - commande #${orderId}`,
          });
        }
      }

      return { bonRetour, items: retourItems, retourTotal };
    });

    if (retourCaisseId !== null) {
      await broadcastCaisseChanged(storeId, [retourCaisseId]);
    }
    res.status(201).json({
      ...result.bonRetour,
      totalAmount: result.retourTotal,
      items: result.items,
      originalOrder: order,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/admin/retours", authenticate, requireStaff, requireStore, requirePermission("orders", "create"), async (req: AuthRequest, res) => {
  try {
    const storeId = req.currentStoreId!;
    const createdByUserId = req.user!.id;
    const { clientName, clientUserId, reason, retourType, items } = req.body as {
      clientName?: string;
      clientUserId?: number;
      reason?: string;
      retourType?: string;
      items: { productId: number; quantity: number; unitPrice?: number }[];
    };

    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: "items is required and must not be empty" });
      return;
    }

    let resolvedClientName = clientName ?? null;
    if (clientUserId && !resolvedClientName) {
      const [cu] = await db.select({ name: schema.usersTable.name })
        .from(schema.usersTable).where(eq(schema.usersTable.id, clientUserId)).limit(1);
      if (cu) resolvedClientName = cu.name;
    }
    if (!resolvedClientName && !clientUserId) {
      resolvedClientName = "DIVERS COMPTOIR";
    }

    // A "sans remboursement" retour credits the customer's account (avoir).
    // Without a linked customer there is nobody to credit, so reject instead
    // of silently creating a retour with no financial side-effect.
    if (retourType === "sans_remboursement" && !clientUserId) {
      res.status(400).json({ error: "Un retour sans remboursement nécessite un client sélectionné (avoir client)." });
      return;
    }

    // When a known client is linked, validate that the quantities being returned
    // don't exceed what the client actually purchased across all their orders in
    // this store (already returned qty + new qty ≤ total purchased qty).
    if (clientUserId) {
      const productIds = [...new Set(items.map((i) => Number(i.productId)))];

      // Aggregate new request quantities per product
      const newQtyMap: Record<number, number> = {};
      for (const item of items) {
        const id = Number(item.productId);
        newQtyMap[id] = (newQtyMap[id] ?? 0) + Number(item.quantity);
      }

      // Total purchased by this client per product (non-cancelled, non-draft)
      const purchasedRows = await db
        .select({
          productId: schema.orderItemsTable.productId,
          totalQty: sql<number>`COALESCE(SUM(${schema.orderItemsTable.quantity}::numeric), 0)`,
        })
        .from(schema.orderItemsTable)
        .innerJoin(schema.ordersTable, eq(schema.orderItemsTable.orderId, schema.ordersTable.id))
        .where(
          and(
            eq(schema.ordersTable.userId, clientUserId),
            eq(schema.ordersTable.storeId, storeId),
            sql`${schema.ordersTable.status} NOT IN ('draft', 'cancelled')`,
            inArray(schema.orderItemsTable.productId, productIds),
          )
        )
        .groupBy(schema.orderItemsTable.productId);

      const purchasedMap: Record<number, number> = {};
      for (const row of purchasedRows) {
        purchasedMap[row.productId] = Number(row.totalQty);
      }

      // Total already returned by this client per product (via direct client_user_id
      // or via original_order_id belonging to one of their orders)
      const alreadyReturnedRows = await db
        .select({
          productId: schema.bonRetourItemsTable.productId,
          returnedQty: sql<number>`COALESCE(SUM(${schema.bonRetourItemsTable.quantity}::numeric), 0)`,
        })
        .from(schema.bonRetourItemsTable)
        .innerJoin(
          schema.bonRetoursTable,
          eq(schema.bonRetourItemsTable.bonRetourId, schema.bonRetoursTable.id)
        )
        .where(
          and(
            eq(schema.bonRetoursTable.storeId, storeId),
            inArray(schema.bonRetourItemsTable.productId, productIds),
            sql`(
              ${schema.bonRetoursTable.clientUserId} = ${clientUserId}
              OR ${schema.bonRetoursTable.originalOrderId} IN (
                SELECT id FROM orders WHERE user_id = ${clientUserId} AND store_id = ${storeId}
              )
            )`,
          )
        )
        .groupBy(schema.bonRetourItemsTable.productId);

      const returnedMap: Record<number, number> = {};
      for (const row of alreadyReturnedRows) {
        returnedMap[row.productId] = Number(row.returnedQty);
      }

      // Fetch product names for readable error messages
      const productRows = await db
        .select({ id: schema.productsTable.id, nameEn: schema.productsTable.nameEn, nameAr: schema.productsTable.nameAr })
        .from(schema.productsTable)
        .where(inArray(schema.productsTable.id, productIds));
      const nameMap: Record<number, string> = {};
      for (const p of productRows) nameMap[p.id] = p.nameEn || p.nameAr || `#${p.id}`;

      const violations: string[] = [];
      for (const [productIdStr, newQty] of Object.entries(newQtyMap)) {
        const productId = Number(productIdStr);
        const purchased = purchasedMap[productId] ?? 0;
        const alreadyReturned = returnedMap[productId] ?? 0;
        const maxReturnable = purchased - alreadyReturned;
        if (newQty > maxReturnable) {
          violations.push(
            `${nameMap[productId] ?? `Produit #${productId}`} : retour demandé ${newQty}, max autorisé ${Math.max(0, maxReturnable)} (acheté ${purchased}, déjà retourné ${alreadyReturned})`
          );
        }
      }

      if (violations.length > 0) {
        res.status(422).json({ error: violations.join("\n") });
        return;
      }
    }

    let retourCaisseId: number | null = null;
    const result = await db.transaction(async (tx) => {
      const [bonRetour] = await tx.insert(schema.bonRetoursTable).values({
        storeId,
        originalOrderId: null,
        clientName: resolvedClientName,
        clientUserId: clientUserId ?? null,
        reason: reason ?? null,
        retourType: retourType ?? null,
        createdByUserId,
      }).returning();

      const retourItems = [];
      let retourTotal = 0;
      for (const item of items) {
        if (typeof item.quantity !== "number" || !Number.isFinite(item.quantity) || item.quantity <= 0) {
          throw Object.assign(new Error(`Quantity must be a positive number for product ${item.productId}`), { status: 400 });
        }
        const [product] = await tx.select().from(schema.productsTable)
          .where(and(eq(schema.productsTable.id, item.productId), eq(schema.productsTable.storeId, storeId)))
          .limit(1);
        if (!product) throw Object.assign(new Error(`Product ${item.productId} not found in this store`), { status: 400 });

        // Validate client-supplied unitPrice strictly; fall back to product.price when omitted.
        let resolvedUnitPrice: string;
        if (item.unitPrice != null) {
          const up = Number(item.unitPrice);
          if (!Number.isFinite(up) || up < 0 || up > 9_999_999) {
            throw Object.assign(
              new Error(`unitPrice for product ${item.productId} must be a finite non-negative number ≤ 9 999 999`),
              { status: 400 },
            );
          }
          resolvedUnitPrice = up.toFixed(2);
        } else {
          resolvedUnitPrice = product.price;
        }
        const [retourItem] = await tx.insert(schema.bonRetourItemsTable).values({
          bonRetourId: bonRetour.id,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: resolvedUnitPrice,
        }).returning();
        retourItems.push(retourItem);
        retourTotal += item.quantity * parseFloat(resolvedUnitPrice);

        await tx.update(schema.productsTable)
          .set({ stock: sql`${schema.productsTable.stock} + ${item.quantity}` })
          .where(eq(schema.productsTable.id, item.productId));

        await tx.insert(schema.inventoryMovementsTable).values({
          storeId,
          productId: item.productId,
          type: "in",
          quantity: item.quantity,
          reason: "Retour",
          reference: `RETOUR-${bonRetour.id}`,
        });
      }

      // Financial side-effect depends on the retour type:
      //  - "sans_remboursement": no cash leaves the till. Instead the linked
      //    customer is credited with an "avoir_retour" that reduces what they
      //    owe (current_balance). No caisse debit, no expense transaction.
      //  - otherwise (refund): cash leaves the till → expense + caisse debit.
      if (retourTotal > 0) {
        if (retourType === "sans_remboursement") {
          if (clientUserId) {
            const { oldBalance: custOld, newBalance: custNew } = await mutateCustomerBalance(tx, clientUserId, storeId, { delta: -retourTotal });
            await tx.insert(schema.customerOperationsTable).values({
              customerId: clientUserId,
              storeId,
              type: "avoir_retour",
              amount: retourTotal.toFixed(2),
              date: new Date().toISOString().split("T")[0],
              reference: `RETOUR-${bonRetour.id}`,
              note: `Avoir retour — Bon Retour comptoir #${bonRetour.id}`,
              createdBy: createdByUserId,
              caisseId: null,
              balanceBefore: custOld.toFixed(2),
              balanceAfter: custNew.toFixed(2),
            });
          }
        } else {
          await tx.insert(schema.transactionsTable).values({
            storeId,
            type: "expense",
            category: "other",
            amount: retourTotal.toFixed(2),
            description: `Bon Retour comptoir #${bonRetour.id} - ${resolvedClientName ?? "client"}`,
            date: new Date().toISOString().split("T")[0],
            reference: `RETOUR-${bonRetour.id}`,
          });

          // Debit the acting user's caisse
          const actorCaisse = await ensureCaisse(storeId, createdByUserId, tx);
          retourCaisseId = actorCaisse.id;
          const { oldBalance: retourCaisseOld, newBalance: retourCaisseNew } = await applyCaisseDelta(tx, actorCaisse.id, -retourTotal);
          await tx.insert(schema.caisseMovementsTable).values({
            caisseId: actorCaisse.id,
            type: "debit",
            amount: retourTotal.toFixed(2),
            reason: "adjustment",
            actorUserId: createdByUserId,
            notes: `Bon Retour comptoir #${bonRetour.id}`,
            balanceBefore: retourCaisseOld.toFixed(2),
            balanceAfter: retourCaisseNew.toFixed(2),
          });
        }
      }

      return { bonRetour, items: retourItems, retourTotal };
    });

    if (retourCaisseId !== null) {
      await broadcastCaisseChanged(storeId, [retourCaisseId]);
    }
    res.status(201).json({ ...result.bonRetour, totalAmount: result.retourTotal, items: result.items });
  } catch (err) {
    const e = err as { status?: number; message?: string };
    if (e.status === 400) { res.status(400).json({ error: e.message }); return; }
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/admin/retours", authenticate, requireStaff, requireStore, requirePermission("orders", "view"), async (req: AuthRequest, res) => {
  try {
    const storeId = req.currentStoreId!;
    const clientUserIdParam = req.query.clientUserId ? parseInt(req.query.clientUserId as string, 10) : null;
    const retours = clientUserIdParam
      ? await db.execute(sql`
          SELECT * FROM bon_retours
          WHERE store_id = ${storeId}
            AND (
              client_user_id = ${clientUserIdParam}
              OR original_order_id IN (
                SELECT id FROM orders WHERE user_id = ${clientUserIdParam} AND store_id = ${storeId}
              )
            )
          ORDER BY created_at DESC
        `).then((r) => r.rows as typeof schema.bonRetoursTable.$inferSelect[])
      : await db.select().from(schema.bonRetoursTable)
          .where(eq(schema.bonRetoursTable.storeId, storeId))
          .orderBy(desc(schema.bonRetoursTable.createdAt));

    const enriched = await Promise.all(retours.map(async (r) => {
      const items = await db.select().from(schema.bonRetourItemsTable)
        .where(eq(schema.bonRetourItemsTable.bonRetourId, r.id));
      const totalAmount = items.reduce((s, i) => s + i.quantity * parseFloat(i.unitPrice), 0);
      const [originalOrder] = await db.select({
        id: schema.ordersTable.id,
        customerName: schema.ordersTable.customerName,
        customerPhone: schema.ordersTable.customerPhone,
        customerAddress: schema.ordersTable.customerAddress,
        status: schema.ordersTable.status,
        totalAmount: schema.ordersTable.totalAmount,
        discountAmount: schema.ordersTable.discountAmount,
        couponCode: schema.ordersTable.couponCode,
        createdAt: schema.ordersTable.createdAt,
        updatedAt: schema.ordersTable.updatedAt,
      }).from(schema.ordersTable).where(r.originalOrderId != null ? eq(schema.ordersTable.id, r.originalOrderId) : sql`false`);
      return { ...r, totalAmount, items, originalOrder: originalOrder ?? null };
    }));

    res.json(enriched);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/admin/retours/:id", authenticate, requireStaff, requireStore, requirePermission("orders", "view"), async (req: AuthRequest, res) => {
  try {
    const storeId = req.currentStoreId!;
    const retourId = pid(req, "id");

    const [retour] = await db.select().from(schema.bonRetoursTable)
      .where(and(eq(schema.bonRetoursTable.id, retourId), eq(schema.bonRetoursTable.storeId, storeId)));
    if (!retour) { res.status(404).json({ error: "Bon Retour not found" }); return; }

    const items = await db.select({
      id: schema.bonRetourItemsTable.id,
      productId: schema.bonRetourItemsTable.productId,
      quantity: schema.bonRetourItemsTable.quantity,
      unitPrice: schema.bonRetourItemsTable.unitPrice,
      product: {
        id: schema.productsTable.id,
        nameAr: schema.productsTable.nameAr,
        nameEn: schema.productsTable.nameEn,
        reference: schema.productsTable.reference,
        barcode: schema.productsTable.barcode,
      },
    }).from(schema.bonRetourItemsTable)
      .leftJoin(schema.productsTable, eq(schema.bonRetourItemsTable.productId, schema.productsTable.id))
      .where(eq(schema.bonRetourItemsTable.bonRetourId, retourId));

    const [originalOrder] = await db.select().from(schema.ordersTable)
      .where(retour.originalOrderId != null ? eq(schema.ordersTable.id, retour.originalOrderId) : sql`false`);

    const totalAmount = items.reduce((s, i) => s + i.quantity * parseFloat(i.unitPrice), 0);

    res.json({ ...retour, totalAmount, items, originalOrder: originalOrder ?? null });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Reports ─────────────────────────────────────────────────────────────────

// GET /admin/reports/products — per-product profit report
router.get("/admin/reports/products", authenticate, requireTenantAdmin, requireStore, async (req: AuthRequest, res) => {
  try {
    const storeId = req.currentStoreId!;
    const { from, to } = req.query as { from?: string; to?: string };

    // Aggregate sales data in a subquery with proper store+status+date filters,
    // then LEFT JOIN to products so products without sales still appear.
    const dateFilter = from && to
      ? sql`AND o.created_at BETWEEN ${from}::timestamp AND (${to}::timestamp + INTERVAL '1 day')`
      : sql``;

    const rows = await db.execute(sql`
      SELECT
        p.id,
        p.name_en,
        p.name_ar,
        p.reference,
        p.cost_price,
        p.stock,
        COALESCE(agg.total_sold, 0)    AS total_sold,
        COALESCE(agg.total_revenue, 0) AS total_revenue,
        COALESCE(agg.total_cogs, 0)    AS total_cogs,
        COALESCE(agg.total_revenue - agg.total_cogs, 0) AS gross_profit
      FROM products p
      LEFT JOIN (
        SELECT
          oi.product_id,
          SUM(oi.quantity)                                                              AS total_sold,
          SUM(oi.quantity * oi.unit_price)                                              AS total_revenue,
          SUM(CASE WHEN oi.cost_price IS NOT NULL THEN oi.quantity * oi.cost_price ELSE 0 END) AS total_cogs
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
          AND o.store_id = ${storeId}
          AND o.status NOT IN ('draft', 'cancelled')
          ${dateFilter}
        GROUP BY oi.product_id
      ) agg ON agg.product_id = p.id
      WHERE p.store_id = ${storeId}
      ORDER BY COALESCE(agg.total_revenue - agg.total_cogs, 0) DESC
    `);

    const result = rows.rows.map((r) => {
      const row = r as Record<string, unknown>;
      const revenue = Number(row["total_revenue"] ?? 0);
      const cogs = Number(row["total_cogs"] ?? 0);
      const profit = Number(row["gross_profit"] ?? 0);
      return {
        id: Number(row["id"]),
        nameEn: String(row["name_en"] ?? ""),
        nameAr: String(row["name_ar"] ?? ""),
        reference: row["reference"] ? String(row["reference"]) : null,
        costPrice: row["cost_price"] != null ? Number(row["cost_price"]) : null,
        stock: Number(row["stock"] ?? 0),
        totalSold: Number(row["total_sold"] ?? 0),
        totalRevenue: revenue,
        totalCogs: cogs,
        grossProfit: profit,
        grossMargin: revenue > 0 ? Math.round((profit / revenue) * 10000) / 100 : 0,
      };
    });

    res.json(result);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /admin/reports/customers — per-customer revenue + balance report
router.get("/admin/reports/customers", authenticate, requireTenantAdmin, requireStore, async (req: AuthRequest, res) => {
  try {
    const storeId = req.currentStoreId!;
    const { from, to } = req.query as { from?: string; to?: string };

    const dateFilter = from && to
      ? sql`AND created_at BETWEEN ${from}::timestamp AND (${to}::timestamp + INTERVAL '1 day')`
      : sql``;

    // Aggregate order revenue and COGS in separate subqueries to avoid
    // row multiplication (SUM(total_amount) × items count).
    const rows = await db.execute(sql`
      SELECT
        u.id,
        u.name,
        u.email,
        u.phone,
        cp.current_balance,
        cp.wilaya,
        COALESCE(ord.total_orders, 0)  AS total_orders,
        COALESCE(ord.total_revenue, 0) AS total_revenue,
        COALESCE(cogs.total_cogs, 0)   AS total_cogs,
        COALESCE(ord.total_revenue - cogs.total_cogs, 0) AS gross_profit
      FROM users u
      JOIN customer_profiles cp ON cp.user_id = u.id AND cp.store_id = ${storeId}
      LEFT JOIN (
        SELECT user_id,
               COUNT(*)            AS total_orders,
               SUM(total_amount)   AS total_revenue
        FROM orders
        WHERE store_id = ${storeId}
          AND status NOT IN ('draft', 'cancelled')
          AND user_id IS NOT NULL
          ${dateFilter}
        GROUP BY user_id
      ) ord ON ord.user_id = u.id
      LEFT JOIN (
        SELECT o.user_id,
               SUM(oi.quantity * oi.cost_price) AS total_cogs
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
          AND o.store_id = ${storeId}
          AND o.status NOT IN ('draft', 'cancelled')
          AND o.user_id IS NOT NULL
          ${dateFilter}
        WHERE oi.cost_price IS NOT NULL
        GROUP BY o.user_id
      ) cogs ON cogs.user_id = u.id
      ORDER BY COALESCE(ord.total_revenue, 0) DESC
    `);

    const result = rows.rows.map((r) => {
      const row = r as Record<string, unknown>;
      const revenue = Number(row["total_revenue"] ?? 0);
      const cogs = Number(row["total_cogs"] ?? 0);
      const profit = Number(row["gross_profit"] ?? 0);
      return {
        id: Number(row["id"]),
        name: String(row["name"] ?? ""),
        email: row["email"] ? String(row["email"]) : null,
        phone: row["phone"] ? String(row["phone"]) : null,
        wilaya: row["wilaya"] ? String(row["wilaya"]) : null,
        currentBalance: Number(row["current_balance"] ?? 0),
        totalOrders: Number(row["total_orders"] ?? 0),
        totalRevenue: revenue,
        totalCogs: cogs,
        grossProfit: profit,
        grossMargin: revenue > 0 ? Math.round((profit / revenue) * 10000) / 100 : 0,
      };
    });

    res.json(result);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /admin/reports/suppliers — per-supplier purchases + payables report
router.get("/admin/reports/suppliers", authenticate, requireTenantAdmin, requireStore, async (req: AuthRequest, res) => {
  try {
    const storeId = req.currentStoreId!;
    const { from, to } = req.query as { from?: string; to?: string };

    // Separate date filters — PO subquery uses no alias; item subquery uses po alias
    const poDateFilter = from && to
      ? sql`AND created_at BETWEEN ${from}::timestamp AND (${to}::timestamp + INTERVAL '1 day')`
      : sql``;
    const piDateFilter = from && to
      ? sql`AND po.created_at BETWEEN ${from}::timestamp AND (${to}::timestamp + INTERVAL '1 day')`
      : sql``;

    // Separate subqueries for PO-level totals vs item-level metrics to prevent row multiplication
    const rows = await db.execute(sql`
      SELECT
        s.id,
        s.name,
        s.contact_name,
        s.email,
        s.phone,
        s.current_balance,
        COALESCE(po_agg.total_pos, 0)         AS total_pos,
        COALESCE(po_agg.total_purchased, 0)   AS total_purchased,
        COALESCE(po_agg.total_received, 0)    AS total_received,
        COALESCE(pi_agg.distinct_products, 0) AS distinct_products,
        COALESCE(pi_agg.avg_unit_cost, 0)     AS avg_unit_cost
      FROM suppliers s
      LEFT JOIN (
        SELECT
          supplier_id,
          COUNT(*)                                                          AS total_pos,
          SUM(total_amount)                                                 AS total_purchased,
          SUM(CASE WHEN status = 'received' THEN total_amount ELSE 0 END)  AS total_received
        FROM purchase_orders
        WHERE store_id = ${storeId}
          ${poDateFilter}
        GROUP BY supplier_id
      ) po_agg ON po_agg.supplier_id = s.id
      LEFT JOIN (
        SELECT
          po.supplier_id,
          COUNT(DISTINCT pi.product_id)                                         AS distinct_products,
          CASE WHEN SUM(pi.quantity) > 0
               THEN ROUND(SUM(pi.quantity * pi.unit_cost)::numeric / SUM(pi.quantity), 2)
               ELSE 0 END                                                        AS avg_unit_cost
        FROM purchase_items pi
        JOIN purchase_orders po ON po.id = pi.purchase_order_id
          AND po.store_id = ${storeId}
          ${piDateFilter}
        GROUP BY po.supplier_id
      ) pi_agg ON pi_agg.supplier_id = s.id
      WHERE s.store_id = ${storeId}
      ORDER BY COALESCE(po_agg.total_purchased, 0) DESC
    `);

    const result = rows.rows.map((r) => {
      const row = r as Record<string, unknown>;
      return {
        id: Number(row["id"]),
        name: String(row["name"] ?? ""),
        contactName: row["contact_name"] ? String(row["contact_name"]) : null,
        email: row["email"] ? String(row["email"]) : null,
        phone: row["phone"] ? String(row["phone"]) : null,
        currentBalance: Number(row["current_balance"] ?? 0),
        totalPos: Number(row["total_pos"] ?? 0),
        totalPurchased: Number(row["total_purchased"] ?? 0),
        totalReceived: Number(row["total_received"] ?? 0),
        distinctProducts: Number(row["distinct_products"] ?? 0),
        avgUnitCost: Number(row["avg_unit_cost"] ?? 0),
      };
    });

    res.json(result);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /admin/reports/monthly — month-by-month revenue vs expenses vs profit
router.get("/admin/reports/monthly", authenticate, requireTenantAdmin, requireStore, async (req: AuthRequest, res) => {
  try {
    const storeId = req.currentStoreId!;
    const { from, to } = req.query as { from?: string; to?: string };

    // Note: 'returned' is not a valid order_status enum value in this schema,
    // so excluding only 'draft' and 'cancelled' correctly captures all confirmed orders.
    const orderDateFilter = from && to
      ? sql`AND created_at BETWEEN ${from}::timestamp AND (${to}::timestamp + INTERVAL '1 day')`
      : sql``;

    const txDateFilter = from && to
      ? sql`AND created_at BETWEEN ${from}::timestamp AND (${to}::timestamp + INTERVAL '1 day')`
      : sql``;

    const retourDateFilter = from && to
      ? sql`AND br.created_at BETWEEN ${from}::timestamp AND (${to}::timestamp + INTERVAL '1 day')`
      : sql``;

    // Revenue grouped by month — orders only (no item JOIN to avoid row multiplication)
    const revenueRows = await db.execute(sql`
      SELECT
        TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month,
        SUM(total_amount) AS total_revenue
      FROM orders
      WHERE store_id = ${storeId}
        AND status NOT IN ('draft', 'cancelled')
        ${orderDateFilter}
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY DATE_TRUNC('month', created_at)
    `);

    // COGS grouped by month — separate query via order_items to avoid multiplying order totals
    const cogsRows = await db.execute(sql`
      SELECT
        TO_CHAR(DATE_TRUNC('month', o.created_at), 'YYYY-MM') AS month,
        SUM(CASE WHEN oi.cost_price IS NOT NULL THEN oi.quantity * oi.cost_price ELSE 0 END) AS total_cogs
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
        AND o.store_id = ${storeId}
        AND o.status NOT IN ('draft', 'cancelled')
        ${orderDateFilter}
      GROUP BY DATE_TRUNC('month', o.created_at)
      ORDER BY DATE_TRUNC('month', o.created_at)
    `);

    const cogsMap = new Map<string, number>();
    for (const r of cogsRows.rows) {
      const row = r as Record<string, unknown>;
      cogsMap.set(String(row["month"]), Number(row["total_cogs"] ?? 0));
    }

    // Operating expenses (type = 'expense') grouped by month. Exclude
    // category='purchase' (inventory acquisition, not an operating expense — profit
    // recognised at sale via COGS; covers legacy PO-receipt rows regardless of
    // reference). Exclude RETOUR-% transactions (profit impact captured via retours
    // query — double-deduct if counted here) and PO-% transactions as a secondary guard.
    const expenseRows = await db.execute(sql`
      SELECT
        TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month,
        SUM(amount) AS total_expenses
      FROM transactions
      WHERE store_id = ${storeId}
        AND type = 'expense'
        AND category <> 'purchase'
        AND (reference IS NULL OR reference NOT LIKE 'RETOUR-%')
        AND (reference IS NULL OR reference NOT LIKE 'PO-%')
        ${txDateFilter}
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY DATE_TRUNC('month', created_at)
    `);

    // Returns grouped by month — returned PROFIT, Σ qty × (unit_price − cost).
    // A bon retour restocks the goods (cost recovered as inventory), so only the
    // lost margin is deducted from grossProfit (mirrors Analytics / Dashboard).
    // Cost is sourced from the original order_items, falling back to the product
    // cost for orderless comptoir returns.
    const retourRows = await db.execute(sql`
      SELECT
        TO_CHAR(DATE_TRUNC('month', br.created_at), 'YYYY-MM') AS month,
        SUM(bri.quantity * (bri.unit_price - COALESCE(oc.cost_price, p.cost_price, 0))) AS total_retours
      FROM bon_retour_items bri
      JOIN bon_retours br ON br.id = bri.bon_retour_id
        AND br.store_id = ${storeId}
        ${retourDateFilter}
      LEFT JOIN (
        SELECT order_id, product_id, MAX(cost_price) AS cost_price
        FROM order_items GROUP BY order_id, product_id
      ) oc ON oc.order_id = br.original_order_id AND oc.product_id = bri.product_id
      LEFT JOIN products p ON p.id = bri.product_id
      GROUP BY DATE_TRUNC('month', br.created_at)
      ORDER BY DATE_TRUNC('month', br.created_at)
    `);

    const retourMap = new Map<string, number>();
    for (const r of retourRows.rows) {
      const row = r as Record<string, unknown>;
      retourMap.set(String(row["month"]), Number(row["total_retours"] ?? 0));
    }

    // Merge by month key
    const expenseMap = new Map<string, number>();
    for (const r of expenseRows.rows) {
      const row = r as Record<string, unknown>;
      expenseMap.set(String(row["month"]), Number(row["total_expenses"] ?? 0));
    }

    // Build revenue map
    const revenueMap = new Map<string, number>();
    for (const r of revenueRows.rows) {
      const row = r as Record<string, unknown>;
      revenueMap.set(String(row["month"]), Number(row["total_revenue"] ?? 0));
    }

    // Union all month keys so expense-only, cogs-only or retour-only months are not dropped
    const allMonths = Array.from(
      new Set([...revenueMap.keys(), ...cogsMap.keys(), ...expenseMap.keys(), ...retourMap.keys()])
    ).sort();

    const result = allMonths.map((month) => {
      const revenue = revenueMap.get(month) ?? 0;
      const cogs = cogsMap.get(month) ?? 0;
      const retours = retourMap.get(month) ?? 0;
      const expenses = expenseMap.get(month) ?? 0;
      // Gross profit = revenue − COGS − returns (same formula as Analytics).
      const grossProfit = revenue - cogs - retours;
      const netProfit = grossProfit - expenses;
      return {
        month,
        totalRevenue: revenue,
        totalCogs: cogs,
        totalRetours: retours,
        totalExpenses: expenses,
        grossProfit,
        netProfit,
        grossMargin: revenue > 0 ? Math.round((grossProfit / revenue) * 10000) / 100 : 0,
      };
    });

    res.json(result);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
