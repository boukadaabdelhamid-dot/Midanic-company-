import { Router, type NextFunction, type Response } from "express";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "../lib/db";
import {
  hasSufficientStock,
  requiredMaterialQuantity,
  weightedAverageCost,
} from "../lib/manufacturing-calculations";
import {
  authenticate,
  requirePermission,
  requireStore,
  type AuthRequest,
} from "../lib/auth";

const router = Router();

class ManufacturingError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

function sendError(req: AuthRequest, res: Response, error: unknown) {
  const status = error instanceof ManufacturingError ? error.status : 500;
  if (status >= 500) req.log.error({ err: error }, "Manufacturing request failed");
  res.status(status).json({
    error: status >= 500 ? "تعذر تنفيذ عملية الإنتاج" : error instanceof Error ? error.message : "Invalid request",
  });
}

async function requireFactoryStore(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const storeId = req.currentStoreId ?? req.user?.currentStoreId;
    if (typeof storeId !== "number") {
      res.status(400).json({ error: "Select a production unit first" });
      return;
    }
    const [store] = await db.select({ kind: schema.storesTable.kind })
      .from(schema.storesTable)
      .where(eq(schema.storesTable.id, storeId))
      .limit(1);
    if (store?.kind !== "factory") {
      res.status(403).json({ error: "This action is only available in the production unit" });
      return;
    }
    next();
  } catch (error) {
    next(error);
  }
}

const recipeInputSchema = z.object({
  outputProductId: z.coerce.number().int().positive().optional(),
  yieldQuantity: z.coerce.number().finite().positive().optional(),
  instructions: z.string().trim().max(2000).nullable().optional(),
  isActive: z.boolean().optional(),
  items: z.array(z.object({
    productId: z.coerce.number().int().positive(),
    quantity: z.coerce.number().finite().positive(),
  })).min(1).max(100).optional(),
});

const recipeCreateSchema = recipeInputSchema.extend({
  outputProductId: z.coerce.number().int().positive(),
  yieldQuantity: z.coerce.number().finite().positive(),
  items: z.array(z.object({
    productId: z.coerce.number().int().positive(),
    quantity: z.coerce.number().finite().positive(),
  })).min(1).max(100),
});

const productionOrderSchema = z.object({
  recipeId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().finite().positive(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

function parseId(value: string | string[] | undefined): number | null {
  const id = Number(Array.isArray(value) ? value[0] : value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

async function validateProductsInStore(
  storeId: number,
  outputProductId: number,
  items: Array<{ productId: number; quantity: number }>,
) {
  const ids = items.map((item) => item.productId);
  if (new Set(ids).size !== ids.length || ids.includes(outputProductId)) {
    throw new ManufacturingError("Each material must be unique and different from the finished product");
  }
  const products = await db.select({ id: schema.productsTable.id })
    .from(schema.productsTable)
    .where(and(
      eq(schema.productsTable.storeId, storeId),
      inArray(schema.productsTable.id, [...ids, outputProductId]),
    ));
  if (products.length !== ids.length + 1) {
    throw new ManufacturingError("Select products that belong to this production unit");
  }
}

router.get(
  "/erp/manufacturing/catalogue",
  authenticate,
  requireStore,
  requireFactoryStore,
  requirePermission("manufacturing", "view"),
  async (req: AuthRequest, res) => {
    try {
      const products = await db.select({
        id: schema.productsTable.id,
        nameAr: schema.productsTable.nameAr,
        nameEn: schema.productsTable.nameEn,
        barcode: schema.productsTable.barcode,
        reference: schema.productsTable.reference,
        stock: schema.productsTable.stock,
        costPrice: schema.productsTable.costPrice,
      })
        .from(schema.productsTable)
        .where(and(
          eq(schema.productsTable.storeId, req.currentStoreId!),
          eq(schema.productsTable.isActive, true),
        ))
        .orderBy(schema.productsTable.nameEn);
      res.json({ products });
    } catch (error) {
      sendError(req, res, error);
    }
  },
);

router.get(
  "/erp/manufacturing/recipes",
  authenticate,
  requireStore,
  requireFactoryStore,
  requirePermission("manufacturing", "view"),
  async (req: AuthRequest, res) => {
    try {
      const recipes = await db.select({
        id: schema.manufacturingRecipesTable.id,
        outputProductId: schema.manufacturingRecipesTable.outputProductId,
        yieldQuantity: schema.manufacturingRecipesTable.yieldQuantity,
        instructions: schema.manufacturingRecipesTable.instructions,
        isActive: schema.manufacturingRecipesTable.isActive,
        createdAt: schema.manufacturingRecipesTable.createdAt,
        outputNameAr: schema.productsTable.nameAr,
        outputNameEn: schema.productsTable.nameEn,
      })
        .from(schema.manufacturingRecipesTable)
        .innerJoin(
          schema.productsTable,
          eq(schema.manufacturingRecipesTable.outputProductId, schema.productsTable.id),
        )
        .where(eq(schema.manufacturingRecipesTable.storeId, req.currentStoreId!))
        .orderBy(desc(schema.manufacturingRecipesTable.createdAt));
      const recipeIds = recipes.map((recipe) => recipe.id);
      const components = recipeIds.length
        ? await db.select({
            recipeId: schema.manufacturingRecipeItemsTable.recipeId,
            productId: schema.manufacturingRecipeItemsTable.productId,
            quantity: schema.manufacturingRecipeItemsTable.quantity,
            nameAr: schema.productsTable.nameAr,
            nameEn: schema.productsTable.nameEn,
            stock: schema.productsTable.stock,
          })
            .from(schema.manufacturingRecipeItemsTable)
            .innerJoin(
              schema.productsTable,
              eq(schema.manufacturingRecipeItemsTable.productId, schema.productsTable.id),
            )
            .where(inArray(schema.manufacturingRecipeItemsTable.recipeId, recipeIds))
        : [];
      res.json({
        recipes: recipes.map((recipe) => ({
          ...recipe,
          components: components.filter((component) => component.recipeId === recipe.id),
        })),
      });
    } catch (error) {
      sendError(req, res, error);
    }
  },
);

router.post(
  "/erp/manufacturing/recipes",
  authenticate,
  requireStore,
  requireFactoryStore,
  requirePermission("manufacturing", "create"),
  async (req: AuthRequest, res) => {
    const parsed = recipeCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Enter the finished product, yield quantity, and at least one material" });
      return;
    }
    try {
      const storeId = req.currentStoreId!;
      await validateProductsInStore(storeId, parsed.data.outputProductId, parsed.data.items);
      const result = await db.transaction(async (tx) => {
        const [recipe] = await tx.insert(schema.manufacturingRecipesTable).values({
          storeId,
          outputProductId: parsed.data.outputProductId,
          yieldQuantity: parsed.data.yieldQuantity,
          instructions: parsed.data.instructions ?? null,
          createdByUserId: req.user!.id,
        }).returning({ id: schema.manufacturingRecipesTable.id });
        await tx.insert(schema.manufacturingRecipeItemsTable).values(
          parsed.data.items.map((item) => ({ recipeId: recipe.id, ...item })),
        );
        return recipe;
      });
      res.status(201).json(result);
    } catch (error) {
      if ((error as { code?: string })?.code === "23505") {
        res.status(409).json({ error: "A recipe already exists for this finished product" });
        return;
      }
      sendError(req, res, error);
    }
  },
);

router.patch(
  "/erp/manufacturing/recipes/:id",
  authenticate,
  requireStore,
  requireFactoryStore,
  requirePermission("manufacturing", "edit"),
  async (req: AuthRequest, res) => {
    const id = parseId(req.params["id"]);
    const parsed = recipeInputSchema.safeParse(req.body);
    if (!id || !parsed.success || Object.keys(parsed.data).length === 0) {
      res.status(400).json({ error: "Invalid recipe update" });
      return;
    }
    try {
      const storeId = req.currentStoreId!;
      const [recipe] = await db.select()
        .from(schema.manufacturingRecipesTable)
        .where(and(
          eq(schema.manufacturingRecipesTable.id, id),
          eq(schema.manufacturingRecipesTable.storeId, storeId),
        ))
        .limit(1);
      if (!recipe) {
        res.status(404).json({ error: "Recipe not found" });
        return;
      }
      const outputProductId = recipe.outputProductId;
      if (parsed.data.items) {
        await validateProductsInStore(storeId, outputProductId, parsed.data.items);
      }
      await db.transaction(async (tx) => {
        const update: Partial<typeof schema.manufacturingRecipesTable.$inferInsert> = {
          updatedAt: new Date(),
        };
        if (parsed.data.yieldQuantity !== undefined) update.yieldQuantity = parsed.data.yieldQuantity;
        if (parsed.data.instructions !== undefined) update.instructions = parsed.data.instructions;
        if (parsed.data.isActive !== undefined) update.isActive = parsed.data.isActive;
        await tx.update(schema.manufacturingRecipesTable)
          .set(update)
          .where(and(
            eq(schema.manufacturingRecipesTable.id, id),
            eq(schema.manufacturingRecipesTable.storeId, storeId),
          ));
        if (parsed.data.items) {
          await tx.delete(schema.manufacturingRecipeItemsTable)
            .where(eq(schema.manufacturingRecipeItemsTable.recipeId, id));
          await tx.insert(schema.manufacturingRecipeItemsTable).values(
            parsed.data.items.map((item) => ({ recipeId: id, ...item })),
          );
        }
      });
      res.json({ id, updated: true });
    } catch (error) {
      sendError(req, res, error);
    }
  },
);

router.get(
  "/erp/manufacturing/orders",
  authenticate,
  requireStore,
  requireFactoryStore,
  requirePermission("manufacturing", "view"),
  async (req: AuthRequest, res) => {
    try {
      const orders = await db.select({
        id: schema.manufacturingOrdersTable.id,
        recipeId: schema.manufacturingOrdersTable.recipeId,
        status: schema.manufacturingOrdersTable.status,
        quantity: schema.manufacturingOrdersTable.plannedQuantity,
        totalMaterialCost: schema.manufacturingOrdersTable.totalMaterialCost,
        notes: schema.manufacturingOrdersTable.notes,
        createdAt: schema.manufacturingOrdersTable.createdAt,
        completedAt: schema.manufacturingOrdersTable.completedAt,
        outputProductId: schema.manufacturingRecipesTable.outputProductId,
        outputNameAr: schema.productsTable.nameAr,
        outputNameEn: schema.productsTable.nameEn,
        yieldQuantity: schema.manufacturingRecipesTable.yieldQuantity,
      })
        .from(schema.manufacturingOrdersTable)
        .innerJoin(
          schema.manufacturingRecipesTable,
          eq(schema.manufacturingOrdersTable.recipeId, schema.manufacturingRecipesTable.id),
        )
        .innerJoin(
          schema.productsTable,
          eq(schema.manufacturingRecipesTable.outputProductId, schema.productsTable.id),
        )
        .where(eq(schema.manufacturingOrdersTable.storeId, req.currentStoreId!))
        .orderBy(desc(schema.manufacturingOrdersTable.createdAt))
        .limit(200);
      const orderIds = orders.map((order) => order.id);
      const lines = orderIds.length
        ? await db.select({
            orderId: schema.manufacturingOrderItemsTable.orderId,
            productId: schema.manufacturingOrderItemsTable.productId,
            requiredQuantity: schema.manufacturingOrderItemsTable.requiredQuantity,
            consumedQuantity: schema.manufacturingOrderItemsTable.consumedQuantity,
            unitCost: schema.manufacturingOrderItemsTable.unitCost,
            lineCost: schema.manufacturingOrderItemsTable.lineCost,
            nameAr: schema.productsTable.nameAr,
            nameEn: schema.productsTable.nameEn,
          })
            .from(schema.manufacturingOrderItemsTable)
            .innerJoin(
              schema.productsTable,
              eq(schema.manufacturingOrderItemsTable.productId, schema.productsTable.id),
            )
            .where(inArray(schema.manufacturingOrderItemsTable.orderId, orderIds))
        : [];
      res.json({
        orders: orders.map((order) => ({
          ...order,
          materials: lines.filter((line) => line.orderId === order.id),
        })),
      });
    } catch (error) {
      sendError(req, res, error);
    }
  },
);

router.post(
  "/erp/manufacturing/orders",
  authenticate,
  requireStore,
  requireFactoryStore,
  requirePermission("manufacturing", "create"),
  async (req: AuthRequest, res) => {
    const parsed = productionOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Enter a valid recipe and production quantity" });
      return;
    }
    try {
      const storeId = req.currentStoreId!;
      const result = await db.transaction(async (tx) => {
        const [recipe] = await tx.select()
          .from(schema.manufacturingRecipesTable)
          .where(and(
            eq(schema.manufacturingRecipesTable.id, parsed.data.recipeId),
            eq(schema.manufacturingRecipesTable.storeId, storeId),
            eq(schema.manufacturingRecipesTable.isActive, true),
          ))
          .for("update")
          .limit(1);
        if (!recipe) throw new ManufacturingError("Recipe not found or inactive", 404);
        const recipeItems = await tx.select()
          .from(schema.manufacturingRecipeItemsTable)
          .where(eq(schema.manufacturingRecipeItemsTable.recipeId, recipe.id));
        if (recipeItems.length === 0) throw new ManufacturingError("This recipe has no materials");
        const [order] = await tx.insert(schema.manufacturingOrdersTable).values({
          storeId,
          recipeId: recipe.id,
          plannedQuantity: parsed.data.quantity,
          notes: parsed.data.notes ?? null,
          createdByUserId: req.user!.id,
        }).returning({ id: schema.manufacturingOrdersTable.id });
        await tx.insert(schema.manufacturingOrderItemsTable).values(
          recipeItems.map((item) => ({
            orderId: order.id,
            productId: item.productId,
            requiredQuantity: requiredMaterialQuantity(
              item.quantity,
              recipe.yieldQuantity,
              parsed.data.quantity,
            ),
          })),
        );
        return order;
      });
      res.status(201).json(result);
    } catch (error) {
      sendError(req, res, error);
    }
  },
);

router.post(
  "/erp/manufacturing/orders/:id/complete",
  authenticate,
  requireStore,
  requireFactoryStore,
  requirePermission("manufacturing", "complete"),
  async (req: AuthRequest, res) => {
    const id = parseId(req.params["id"]);
    if (!id) {
      res.status(400).json({ error: "Invalid production order" });
      return;
    }
    try {
      const result = await db.transaction(async (tx) => {
        const [order] = await tx.select()
          .from(schema.manufacturingOrdersTable)
          .where(and(
            eq(schema.manufacturingOrdersTable.id, id),
            eq(schema.manufacturingOrdersTable.storeId, req.currentStoreId!),
          ))
          .for("update")
          .limit(1);
        if (!order) throw new ManufacturingError("Production order not found", 404);
        if (order.status !== "planned") {
          throw new ManufacturingError("Only planned production orders can be completed", 409);
        }
        const [recipe] = await tx.select()
          .from(schema.manufacturingRecipesTable)
          .where(eq(schema.manufacturingRecipesTable.id, order.recipeId))
          .limit(1);
        if (!recipe) throw new ManufacturingError("Recipe not found", 404);
        const lines = await tx.select()
          .from(schema.manufacturingOrderItemsTable)
          .where(eq(schema.manufacturingOrderItemsTable.orderId, order.id));
        const productIds = [...new Set([...lines.map((line) => line.productId), recipe.outputProductId])];
        const lockedProducts = await tx.select()
          .from(schema.productsTable)
          .where(and(
            eq(schema.productsTable.storeId, req.currentStoreId!),
            inArray(schema.productsTable.id, productIds),
          ))
          .orderBy(asc(schema.productsTable.id))
          .for("update");
        const productsById = new Map(lockedProducts.map((product) => [product.id, product]));
        if (lockedProducts.length !== productIds.length) {
          throw new ManufacturingError("A recipe product is no longer available in this production unit", 409);
        }
        const outputProduct = productsById.get(recipe.outputProductId)!;
        const materialCosts: Array<{ productId: number; quantity: number; unitCost: number; lineCost: number }> = [];
        let totalCost = 0;
        for (const line of lines) {
          const product = productsById.get(line.productId)!;
          const required = line.requiredQuantity;
          if (!hasSufficientStock(product.stock, required)) {
            throw new ManufacturingError(
              `Insufficient stock for ${product.nameEn}: ${product.stock} available, ${required} required`,
              409,
            );
          }
          const unitCost = Number(product.costPrice ?? 0);
          const lineCost = unitCost * required;
          totalCost += lineCost;
          materialCosts.push({ productId: product.id, quantity: required, unitCost, lineCost });
          await tx.update(schema.productsTable)
            .set({ stock: Math.max(0, product.stock - required) })
            .where(and(
              eq(schema.productsTable.id, product.id),
              eq(schema.productsTable.storeId, req.currentStoreId!),
            ));
          await tx.insert(schema.inventoryMovementsTable).values({
            storeId: req.currentStoreId!,
            productId: product.id,
            type: "out",
            quantity: required,
            reason: "manufacturing_material_consumption",
            reference: `OF-${order.id}`,
            userId: req.user!.id,
          });
        }
        const nextOutputStock = outputProduct.stock + order.plannedQuantity;
        const nextAverageCost = weightedAverageCost(
          outputProduct.stock,
          Number(outputProduct.costPrice ?? 0),
          order.plannedQuantity,
          totalCost,
        );
        await tx.update(schema.productsTable)
          .set({
            stock: nextOutputStock,
            costPrice: nextAverageCost.toFixed(2),
          })
          .where(and(
            eq(schema.productsTable.id, outputProduct.id),
            eq(schema.productsTable.storeId, req.currentStoreId!),
          ));
        await tx.insert(schema.inventoryMovementsTable).values({
          storeId: req.currentStoreId!,
          productId: outputProduct.id,
          type: "in",
          quantity: order.plannedQuantity,
          reason: "manufacturing_finished_product",
          reference: `OF-${order.id}`,
          userId: req.user!.id,
        });
        for (const cost of materialCosts) {
          await tx.update(schema.manufacturingOrderItemsTable)
            .set({
              consumedQuantity: cost.quantity,
              unitCost: cost.unitCost.toFixed(4),
              lineCost: cost.lineCost.toFixed(2),
            })
            .where(and(
              eq(schema.manufacturingOrderItemsTable.orderId, order.id),
              eq(schema.manufacturingOrderItemsTable.productId, cost.productId),
            ));
        }
        await tx.update(schema.manufacturingOrdersTable)
          .set({
            status: "completed",
            totalMaterialCost: totalCost.toFixed(2),
            completedByUserId: req.user!.id,
            completedAt: new Date(),
          })
          .where(eq(schema.manufacturingOrdersTable.id, order.id));
        return { id: order.id, status: "completed", quantity: order.plannedQuantity, totalMaterialCost: totalCost };
      });
      res.json(result);
    } catch (error) {
      sendError(req, res, error);
    }
  },
);

router.post(
  "/erp/manufacturing/orders/:id/cancel",
  authenticate,
  requireStore,
  requireFactoryStore,
  requirePermission("manufacturing", "edit"),
  async (req: AuthRequest, res) => {
    const id = parseId(req.params["id"]);
    if (!id) {
      res.status(400).json({ error: "Invalid production order" });
      return;
    }
    try {
      const [order] = await db.update(schema.manufacturingOrdersTable)
        .set({ status: "cancelled" })
        .where(and(
          eq(schema.manufacturingOrdersTable.id, id),
          eq(schema.manufacturingOrdersTable.storeId, req.currentStoreId!),
          eq(schema.manufacturingOrdersTable.status, "planned"),
        ))
        .returning({ id: schema.manufacturingOrdersTable.id });
      if (!order) {
        res.status(409).json({ error: "Only planned production orders can be cancelled" });
        return;
      }
      res.json({ id: order.id, status: "cancelled" });
    } catch (error) {
      sendError(req, res, error);
    }
  },
);

export default router;
