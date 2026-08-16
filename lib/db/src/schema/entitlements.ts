import { pgTable, serial, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

/**
 * Per-customer usage limits — null means "unlimited".
 * One row per user (upserted on change).
 */
export const customerEntitlementsTable = pgTable("customer_entitlements", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .unique()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  maxStores: integer("max_stores"),   // null = unlimited
  maxUsers: integer("max_users"),
  storageGb: integer("storage_gb"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: integer("updated_by").references(() => usersTable.id, { onDelete: "set null" }),
});

/**
 * Immutable change log for entitlement edits.
 */
export const entitlementHistoryTable = pgTable("entitlement_history", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  changedBy: integer("changed_by").references(() => usersTable.id, { onDelete: "set null" }),
  oldValues: jsonb("old_values"),
  newValues: jsonb("new_values").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CustomerEntitlement = typeof customerEntitlementsTable.$inferSelect;
export type EntitlementHistory = typeof entitlementHistoryTable.$inferSelect;
