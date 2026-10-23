import {
  boolean,
  doublePrecision,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { storesTable } from "./stores";
import { productsTable } from "./products";

export const manufacturingOrderStatusEnum = pgEnum("manufacturing_order_status", [
  "planned",
  "completed",
  "cancelled",
]);

export const manufacturingRecipesTable = pgTable("manufacturing_recipes", {
  id: serial("id").primaryKey(),
  storeId: integer("store_id").references(() => storesTable.id, { onDelete: "cascade" }).notNull(),
  outputProductId: integer("output_product_id").references(() => productsTable.id).notNull(),
  yieldQuantity: doublePrecision("yield_quantity").notNull().default(1),
  instructions: text("instructions"),
  isActive: boolean("is_active").notNull().default(true),
  createdByUserId: integer("created_by_user_id").references(() => usersTable.id).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("manufacturing_recipes_store_output_uq").on(table.storeId, table.outputProductId),
  index("manufacturing_recipes_store_active_idx").on(table.storeId, table.isActive),
]);

export const manufacturingRecipeItemsTable = pgTable("manufacturing_recipe_items", {
  id: serial("id").primaryKey(),
  recipeId: integer("recipe_id").references(() => manufacturingRecipesTable.id, { onDelete: "cascade" }).notNull(),
  productId: integer("product_id").references(() => productsTable.id).notNull(),
  quantity: doublePrecision("quantity").notNull(),
}, (table) => [
  uniqueIndex("manufacturing_recipe_items_recipe_product_uq").on(table.recipeId, table.productId),
]);

export const manufacturingOrdersTable = pgTable("manufacturing_orders", {
  id: serial("id").primaryKey(),
  storeId: integer("store_id").references(() => storesTable.id, { onDelete: "cascade" }).notNull(),
  recipeId: integer("recipe_id").references(() => manufacturingRecipesTable.id).notNull(),
  status: manufacturingOrderStatusEnum("status").notNull().default("planned"),
  plannedQuantity: doublePrecision("planned_quantity").notNull(),
  totalMaterialCost: numeric("total_material_cost", { precision: 12, scale: 2 }).notNull().default("0"),
  notes: text("notes"),
  createdByUserId: integer("created_by_user_id").references(() => usersTable.id).notNull(),
  completedByUserId: integer("completed_by_user_id").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (table) => [
  index("manufacturing_orders_store_created_idx").on(table.storeId, table.createdAt),
  index("manufacturing_orders_store_status_idx").on(table.storeId, table.status),
]);

// Order lines are snapshots: later recipe edits must not rewrite production history.
export const manufacturingOrderItemsTable = pgTable("manufacturing_order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").references(() => manufacturingOrdersTable.id, { onDelete: "cascade" }).notNull(),
  productId: integer("product_id").references(() => productsTable.id).notNull(),
  requiredQuantity: doublePrecision("required_quantity").notNull(),
  consumedQuantity: doublePrecision("consumed_quantity"),
  unitCost: numeric("unit_cost", { precision: 12, scale: 4 }),
  lineCost: numeric("line_cost", { precision: 12, scale: 2 }),
}, (table) => [
  uniqueIndex("manufacturing_order_items_order_product_uq").on(table.orderId, table.productId),
]);

export type ManufacturingRecipe = typeof manufacturingRecipesTable.$inferSelect;
export type ManufacturingRecipeItem = typeof manufacturingRecipeItemsTable.$inferSelect;
export type ManufacturingOrder = typeof manufacturingOrdersTable.$inferSelect;
export type ManufacturingOrderItem = typeof manufacturingOrderItemsTable.$inferSelect;
