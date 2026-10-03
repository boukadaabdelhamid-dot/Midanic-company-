import { Router, type RequestHandler } from "express";
import { and, eq, inArray, sql } from "drizzle-orm";
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { hash } from "bcryptjs";
import rateLimit from "express-rate-limit";
import { SubmitStoreOrderBody, SetWebCustomerBlockBody } from "@workspace/erp-api-zod";
import { db, schema } from "../lib/db";
import { authenticate, requireStaff, requireStore, requirePermission, type AuthRequest } from "../lib/auth";
import { resolvePublicStore } from "../lib/store-context";
import { normalizeCustomerPhone, normalizedPhoneSql } from "../lib/customer-phone";
import { broadcastToStaffByStores } from "../lib/ws";

const router = Router();
const optionalAuth: RequestHandler = (req, res, next) =>
  req.headers.authorization ? authenticate(req as AuthRequest, res, next) : next();
const resolveDetailStore: RequestHandler = (req: AuthRequest, res, next) => {
  if (req.user && req.user.role !== "customer") {
    requireStaff(req, res, () => requireStore(req, res, () => requirePermission("orders", "view")(req, res, next)));
  } else resolvePublicStore(req, res, next);
};
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const trackingToken = (storeId: number, id: number, key: string) => digest(`${storeId}:${id}:${key}`);
class OrderError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
const orderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: "draft-7", legacyHeaders: false,
  message: { error: "Too many order attempts. Please try again later." },
});

router.post("/orders", orderLimiter, optionalAuth, resolvePublicStore, async (req: AuthRequest, res): Promise<void> => {
  const parsed = SubmitStoreOrderBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Please provide valid order details." }); return; }
  const input = parsed.data;
  const phone = normalizeCustomerPhone(input.customerPhone);
  if (!phone || input.customerName.trim().length < 2 || input.customerAddress.trim().length < 5) {
    res.status(400).json({ error: "Please provide a valid name, phone number and delivery address." }); return;
  }
  const storeId = req.currentStoreId!;
  const quantities = new Map<number, number>();
  for (const item of input.items) quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
  if ([...quantities.values()].some(q => q > 10000)) { res.status(400).json({ error: "Invalid quantity." }); return; }
  const lines = [...quantities].sort((a, b) => a[0] - b[0]);
  const fingerprint = digest(JSON.stringify([input.customerName.trim(), phone, input.customerAddress.trim(), input.couponCode ?? null, lines]));
  try {
    const result = await db.transaction(async tx => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`order:${storeId}:${input.requestKey}`}, 0))`);
      const [replay] = await tx.select().from(schema.webOrderAccessTable)
        .where(and(eq(schema.webOrderAccessTable.storeId, storeId), eq(schema.webOrderAccessTable.requestKey, input.requestKey)));
      if (replay) {
        if (replay.requestHash !== fingerprint || replay.accountUserId !== (req.user?.id ?? null)) {
          throw new OrderError(409, "This request reference was already used for a different order.");
        }
        const [order] = await tx.select().from(schema.ordersTable).where(eq(schema.ordersTable.id, replay.orderId));
        return { order, replay: true };
      }
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`phone:${storeId}:${phone}`}, 0))`);
      const [settings] = await tx.select().from(schema.storeWebSettingsTable).where(eq(schema.storeWebSettingsTable.storeId, storeId));
      if (settings?.acceptOrders === false) throw new OrderError(403, "This store is not accepting orders right now.");
      const [registry] = await tx.select().from(schema.webCustomersTable)
        .where(and(eq(schema.webCustomersTable.storeId, storeId), eq(schema.webCustomersTable.phone, phone)));
      if (registry?.isBlocked) throw new OrderError(403, "This customer cannot place orders. Please contact the store.");
      let customerId = registry?.userId;
      if (!customerId) {
        const candidates = await tx.select({ id: schema.usersTable.id }).from(schema.customerProfilesTable)
          .innerJoin(schema.usersTable, eq(schema.usersTable.id, schema.customerProfilesTable.userId))
          .where(and(eq(schema.customerProfilesTable.storeId, storeId), eq(schema.usersTable.role, "customer"),
            sql`${normalizedPhoneSql(sql`${schema.usersTable.phone}`)} = ${phone}`)).limit(2);
        // Ambiguous legacy matches must not merge two distinct CRM identities.
        if (candidates.length > 1) throw new OrderError(409, "Please contact the store to confirm your customer details.");
        customerId = candidates[0]?.id;
      }
      const blockedIdentities = [customerId, req.user?.id].filter((id): id is number => typeof id === "number");
      if (blockedIdentities.length) {
        const [blocked] = await tx.select().from(schema.webCustomersTable)
          .where(and(eq(schema.webCustomersTable.storeId, storeId),
            inArray(schema.webCustomersTable.userId, blockedIdentities), eq(schema.webCustomersTable.isBlocked, true))).limit(1);
        if (blocked) throw new OrderError(403, "This customer cannot place orders. Please contact the store.");
      }
      const products = await tx.select().from(schema.productsTable)
        .where(and(eq(schema.productsTable.storeId, storeId), inArray(schema.productsTable.id, lines.map(l => l[0]))))
        .orderBy(schema.productsTable.id).for("update");
      let subtotal = 0;
      for (const [id, quantity] of lines) {
        const p = products.find(p => p.id === id);
        if (!p || !p.isExposed || p.stock < quantity) throw new OrderError(409, "A product is unavailable or has insufficient stock.");
        const price = Number(p.price);
        if (!Number.isFinite(price) || price < 0) throw new OrderError(409, "A product price is unavailable.");
        subtotal += Math.round(price * quantity * 100);
      }
      let discount = 0;
      if (input.couponCode) {
        const [coupon] = await tx.select().from(schema.couponsTable).where(and(
          eq(schema.couponsTable.storeId, storeId), sql`upper(${schema.couponsTable.code}) = ${input.couponCode.trim().toUpperCase()}`,
        )).for("update");
        if (!coupon || (coupon.expiresAt && coupon.expiresAt <= new Date()) ||
          (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) || subtotal < Number(coupon.minOrder) * 100) {
          throw new OrderError(400, "Invalid or expired coupon.");
        }
        discount = Math.min(subtotal, Math.round(coupon.type === "percent" ? subtotal * Number(coupon.value) / 100 : Number(coupon.value) * 100));
        await tx.update(schema.couponsTable).set({ usedCount: sql`${schema.couponsTable.usedCount} + 1` }).where(eq(schema.couponsTable.id, coupon.id));
      }
      const total = subtotal - discount;
      if (total > 99_999_999_99) throw new OrderError(400, "The order amount is too large.");
      if (total < Number(settings?.minOrderAmount ?? 0) * 100) throw new OrderError(400, "The minimum order amount has not been reached.");
      if (!customerId) {
        if (req.user?.role === "customer") customerId = req.user.id;
      }
      if (!customerId) {
        // ERP requires a user-backed customer profile. This is a CRM identity,
        // not a usable account: no real email or known password is assigned.
        const [customer] = await tx.insert(schema.usersTable).values({
          name: input.customerName.trim(), email: `guest-${randomUUID()}@guest.invalid`,
          passwordHash: await hash(randomUUID(), 10), role: "customer", phone, address: input.customerAddress.trim(),
        }).returning();
        customerId = customer.id;
        const [contact] = await tx.insert(schema.contactsTable).values({
          storeId, name: customer.name, phone, address: customer.address,
          contactType: "customer", globalContactId: randomUUID(),
        }).returning();
        await tx.insert(schema.customerProfilesTable).values({ userId: customerId, storeId, contactId: contact.id });
      }
      const [profile] = await tx.select({ id: schema.customerProfilesTable.id }).from(schema.customerProfilesTable)
        .where(and(eq(schema.customerProfilesTable.userId, customerId), eq(schema.customerProfilesTable.storeId, storeId)));
      if (!profile) {
        const [contact] = await tx.insert(schema.contactsTable).values({
          storeId, name: input.customerName.trim(), phone, address: input.customerAddress.trim(),
          contactType: "customer", globalContactId: randomUUID(),
        }).returning();
        await tx.insert(schema.customerProfilesTable).values({ userId: customerId, storeId, contactId: contact.id })
          .onConflictDoNothing({ target: [schema.customerProfilesTable.userId, schema.customerProfilesTable.storeId] });
      }
      await tx.insert(schema.webCustomersTable).values({ storeId, phone, userId: customerId })
        .onConflictDoUpdate({ target: [schema.webCustomersTable.storeId, schema.webCustomersTable.phone],
          set: { userId: customerId, updatedAt: new Date() } });
      const [order] = await tx.insert(schema.ordersTable).values({
        storeId, userId: customerId, customerName: input.customerName.trim(), customerPhone: phone,
        customerAddress: input.customerAddress.trim(), status: "pending", orderSource: "online",
        paymentMethod: "a_terme", totalAmount: (total / 100).toFixed(2),
        discountAmount: (discount / 100).toFixed(2), couponCode: input.couponCode || null,
      }).returning();
      for (const [id, quantity] of lines) {
        const p = products.find(p => p.id === id)!;
        await tx.insert(schema.orderItemsTable).values({ orderId: order.id, productId: id, quantity, unitPrice: p.price, costPrice: p.costPrice });
        await tx.update(schema.productsTable).set({ stock: sql`${schema.productsTable.stock} - ${quantity}` }).where(eq(schema.productsTable.id, id));
        await tx.insert(schema.inventoryMovementsTable).values({
          storeId, productId: id, type: "out", quantity, reason: "Web order reservation", reference: `WEB-${order.id}`,
        });
      }
      const token = trackingToken(storeId, order.id, input.requestKey);
      await tx.insert(schema.webOrderAccessTable).values({
        orderId: order.id, storeId, accountUserId: req.user?.id ?? null, requestKey: input.requestKey,
        requestHash: fingerprint, tokenHash: digest(token),
      });
      if (req.user) await tx.delete(schema.cartItemsTable).where(and(eq(schema.cartItemsTable.userId, req.user.id), eq(schema.cartItemsTable.storeId, storeId)));
      return { order, replay: false };
    });
    if (!result.replay) broadcastToStaffByStores([storeId], { type: "order_created", order: result.order });
    res.status(result.replay ? 200 : 201).json({
      id: result.order.id, status: result.order.status, totalAmount: result.order.totalAmount,
      createdAt: result.order.createdAt.toISOString(), trackingToken: trackingToken(storeId, result.order.id, input.requestKey),
    });
  } catch (err) {
    if (err instanceof OrderError) { res.status(err.status).json({ error: err.message }); return; }
    req.log.error({ err }, "Web order submission failed");
    res.status(500).json({ error: "Unable to save the order. Please retry with the same request reference." });
  }
});

router.get("/orders", optionalAuth, resolvePublicStore, async (req: AuthRequest, res): Promise<void> => {
  if (!req.user) { res.status(401).json({ error: "Sign in to view your account orders." }); return; }
  const rows = await db.select({ order: schema.ordersTable }).from(schema.ordersTable)
    .innerJoin(schema.webOrderAccessTable, eq(schema.webOrderAccessTable.orderId, schema.ordersTable.id))
    .where(and(eq(schema.webOrderAccessTable.storeId, req.currentStoreId!), eq(schema.webOrderAccessTable.accountUserId, req.user.id)))
    .orderBy(sql`${schema.ordersTable.createdAt} DESC`);
  res.json(rows.map(r => r.order));
});

router.get("/orders/:id", optionalAuth, resolveDetailStore, async (req: AuthRequest, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) { res.status(400).json({ error: "Invalid order." }); return; }
  const [access] = await db.select().from(schema.webOrderAccessTable)
    .where(and(eq(schema.webOrderAccessTable.orderId, id), eq(schema.webOrderAccessTable.storeId, req.currentStoreId!)));
  const token = req.get("X-Order-Token");
  const tokenValid = access && token && token.length === 64 &&
    timingSafeEqual(Buffer.from(digest(token)), Buffer.from(access.tokenHash));
  const [order] = await db.select().from(schema.ordersTable)
    .where(and(eq(schema.ordersTable.id, id), eq(schema.ordersTable.storeId, req.currentStoreId!)));
  const isStaff = req.user && req.user.role !== "customer";
  const isAccountOwner = req.user && (access ? access.accountUserId === req.user.id :
    order?.userId === req.user.id && order?.orderSource === "online");
  if (!order || (!isStaff && !tokenValid && !isAccountOwner)) {
    res.status(404).json({ error: "Order not found." }); return;
  }
  const items = await db.select({ id: schema.orderItemsTable.id, quantity: schema.orderItemsTable.quantity,
    unitPrice: schema.orderItemsTable.unitPrice, product: {
      id: schema.productsTable.id, nameAr: schema.productsTable.nameAr, nameEn: schema.productsTable.nameEn,
      imageUrl: schema.productsTable.imageUrl, price: schema.productsTable.price,
    },
  }).from(schema.orderItemsTable).innerJoin(schema.productsTable, eq(schema.productsTable.id, schema.orderItemsTable.productId))
    .where(eq(schema.orderItemsTable.orderId, id));
  res.json({ ...order, items });
});

// Online orders reserve stock on submission; cancellation must release it once.
// POS/bon orders keep their existing accounting and return workflows.
router.put("/admin/orders/:id/status", authenticate, requireStaff, requireStore, requirePermission("orders", "edit"),
  async (req: AuthRequest, res): Promise<void> => {
    const id = Number(req.params.id);
    const status = req.body?.status as string;
    const transitions: Record<string, string[]> = {
      pending: ["processing", "cancelled"], processing: ["shipped", "cancelled"],
      shipped: ["delivered", "cancelled"], delivered: [], cancelled: [],
    };
    if (!Number.isSafeInteger(id) || !Object.hasOwn(transitions, status)) {
      res.status(400).json({ error: "Invalid order status." }); return;
    }
    try {
      const order = await db.transaction(async tx => {
        const [current] = await tx.select().from(schema.ordersTable)
          .where(and(eq(schema.ordersTable.id, id), eq(schema.ordersTable.storeId, req.currentStoreId!))).for("update");
        if (!current || current.orderSource !== "online") throw new OrderError(404, "Online order not found.");
        if (current.status === status) return current;
        if (!transitions[current.status]?.includes(status)) throw new OrderError(409, "This order status transition is not allowed.");
        if (status === "cancelled") {
          const items = await tx.select().from(schema.orderItemsTable).where(eq(schema.orderItemsTable.orderId, id))
            .orderBy(schema.orderItemsTable.productId);
          for (const item of items) {
            await tx.update(schema.productsTable).set({ stock: sql`${schema.productsTable.stock} + ${item.quantity}` })
              .where(and(eq(schema.productsTable.id, item.productId), eq(schema.productsTable.storeId, req.currentStoreId!)));
            await tx.insert(schema.inventoryMovementsTable).values({
              storeId: req.currentStoreId!, productId: item.productId, type: "in", quantity: item.quantity,
              reason: "Cancelled Web order reservation", reference: `WEB-${id}`, userId: req.user!.id,
            });
          }
        }
        const [updated] = await tx.update(schema.ordersTable)
          .set({ status: status as typeof current.status, updatedAt: new Date() }).where(eq(schema.ordersTable.id, id)).returning();
        return updated;
      });
      broadcastToStaffByStores([req.currentStoreId!], { type: "order_updated", order });
      res.json(order);
    } catch (err) {
      if (err instanceof OrderError) { res.status(err.status).json({ error: err.message }); return; }
      req.log.error({ err }, "Web order status update failed");
      res.status(500).json({ error: "Unable to update the order." });
    }
  });

router.get("/erp/web-customers", authenticate, requireStaff, requireStore, requirePermission("customers", "view"),
  async (req: AuthRequest, res): Promise<void> => {
    const search = String(req.query.search ?? "").trim().slice(0, 100);
    const result = await db.execute(sql`
      SELECT wc.phone, u.name, wc.user_id AS "customerId", wc.is_blocked AS "isBlocked", wc.block_reason AS reason,
        COUNT(o.id)::integer AS "orderCount", MAX(o.created_at) AS "lastOrderAt"
      FROM web_customers wc LEFT JOIN users u ON u.id = wc.user_id
      LEFT JOIN orders o ON o.user_id = wc.user_id AND o.store_id = wc.store_id AND o.order_source = 'online'
      WHERE wc.store_id = ${req.currentStoreId!}
        AND (${search === ""} OR coalesce(u.name, '') ILIKE ${`%${search}%`} OR wc.phone LIKE ${`%${normalizeCustomerPhone(search) ?? search}%`})
      GROUP BY wc.store_id, wc.phone, u.name, wc.user_id, wc.is_blocked, wc.block_reason, wc.updated_at
      ORDER BY wc.updated_at DESC LIMIT 200
    `);
    res.json(result.rows);
  });

router.put("/erp/web-customers", authenticate, requireStaff, requireStore, requirePermission("customers", "edit"),
  async (req: AuthRequest, res): Promise<void> => {
    const parsed = SetWebCustomerBlockBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid block details." }); return; }
    const { customerId, isBlocked, reason } = parsed.data;
    let phone = normalizeCustomerPhone(parsed.data.phone ?? "");
    const storeId = req.currentStoreId!;
    if (customerId) {
      const [customer] = await db.select({ phone: schema.usersTable.phone }).from(schema.customerProfilesTable)
        .innerJoin(schema.usersTable, eq(schema.usersTable.id, schema.customerProfilesTable.userId))
        .where(and(eq(schema.customerProfilesTable.storeId, storeId), eq(schema.customerProfilesTable.userId, customerId)));
      if (!customer) { res.status(404).json({ error: "Customer not found in this store." }); return; }
      if (!phone) phone = normalizeCustomerPhone(customer.phone ?? "");
    }
    if (!phone) { res.status(400).json({ error: "A valid customer phone number is required." }); return; }
    await db.transaction(async tx => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`phone:${storeId}:${phone}`}, 0))`);
      await tx.insert(schema.webCustomersTable).values({
        storeId, phone: phone!, userId: customerId ?? null, isBlocked, blockReason: isBlocked ? reason?.trim() || null : null, blockedBy: req.user!.id,
      }).onConflictDoUpdate({
        target: [schema.webCustomersTable.storeId, schema.webCustomersTable.phone],
        set: { isBlocked, blockReason: isBlocked ? reason?.trim() || null : null,
          blockedBy: req.user!.id, updatedAt: new Date(), ...(customerId ? { userId: customerId } : {}) },
      });
      if (customerId) await tx.update(schema.webCustomersTable).set({
        isBlocked, blockReason: isBlocked ? reason?.trim() || null : null, blockedBy: req.user!.id, updatedAt: new Date(),
      }).where(and(eq(schema.webCustomersTable.storeId, storeId), eq(schema.webCustomersTable.userId, customerId)));
    });
    res.json({ success: true });
  });

export default router;