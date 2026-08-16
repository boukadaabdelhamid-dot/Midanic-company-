import { pgTable, serial, text, boolean, timestamp, integer, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { productsTable } from "./products";

export const licenseTypeEnum = pgEnum("license_type", [
  "trial",
  "monthly",
  "quarterly",
  "semi_annual",
  "yearly",
  "lifetime",
]);

export const licenseStatusEnum = pgEnum("license_status", [
  "active",
  "expired",
  "suspended",
  "revoked",
]);

export const licensesTable = pgTable("licenses", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  userId: integer("user_id").references(() => usersTable.id),
  productId: integer("product_id").notNull().references(() => productsTable.id),
  type: licenseTypeEnum("type").notNull().default("trial"),
  status: licenseStatusEnum("status").notNull().default("active"),
  maxDevices: integer("max_devices").notNull().default(1),
  activatedDevices: integer("activated_devices").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  autoRenew: boolean("auto_renew").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const devicesTable = pgTable("devices", {
  id: serial("id").primaryKey(),
  licenseId: integer("license_id").notNull().references(() => licensesTable.id, { onDelete: "cascade" }),
  deviceName: text("device_name").notNull(),
  deviceFingerprint: text("device_fingerprint").notNull(),
  platform: text("platform"),
  isActive: boolean("is_active").notNull().default(true),
  activatedAt: timestamp("activated_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
});

export const licenseActivationsTable = pgTable("license_activations", {
  id: serial("id").primaryKey(),
  licenseId: integer("license_id").notNull().references(() => licensesTable.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  deviceName: text("device_name"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type License = typeof licensesTable.$inferSelect;
export type Device = typeof devicesTable.$inferSelect;
export const insertLicenseSchema = createInsertSchema(licensesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertLicense = z.infer<typeof insertLicenseSchema>;
