import { pgTable, integer, text, boolean, timestamp, primaryKey, uniqueIndex } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { storesTable } from "./stores";
import { ordersTable } from "./orders";

export const webCustomersTable = pgTable("web_customers", {
  storeId: integer("store_id").notNull().references(() => storesTable.id),
  phone: text("phone").notNull(),
  userId: integer("user_id").references(() => usersTable.id),
  isBlocked: boolean("is_blocked").notNull().default(false),
  blockReason: text("block_reason"),
  blockedBy: integer("blocked_by").references(() => usersTable.id),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, t => [primaryKey({ columns: [t.storeId, t.phone] })]);

export const webOrderAccessTable = pgTable("web_order_access", {
  orderId: integer("order_id").primaryKey().references(() => ordersTable.id, { onDelete: "cascade" }),
  storeId: integer("store_id").notNull().references(() => storesTable.id),
  accountUserId: integer("account_user_id").references(() => usersTable.id),
  requestKey: text("request_key").notNull(),
  requestHash: text("request_hash").notNull(),
  tokenHash: text("token_hash").notNull(),
}, t => [uniqueIndex("web_order_request_unique").on(t.storeId, t.requestKey)]);