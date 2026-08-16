import { pgTable, serial, text, boolean, timestamp, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const productsTable = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description").notNull(),
  shortDescription: text("short_description"),
  category: text("category").notNull().default("software"),
  imageUrl: text("image_url"),
  videoUrl: text("video_url"),
  defaultLicenseType: text("default_license_type"),
  featured: boolean("featured").notNull().default(false),
  published: boolean("published").notNull().default(true),
  trialDays: integer("trial_days"),
  basePrice: real("base_price"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const productVersionsTable = pgTable("product_versions", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => productsTable.id, { onDelete: "cascade" }),
  version: text("version").notNull(),
  releaseNotes: text("release_notes"),
  isLatest: boolean("is_latest").notNull().default(false),
  releasedAt: timestamp("released_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const downloadFilesTable = pgTable("download_files", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => productsTable.id, { onDelete: "cascade" }),
  versionId: integer("version_id").references(() => productVersionsTable.id, { onDelete: "set null" }),
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size").notNull().default(0),
  platform: text("platform").notNull().default("windows"),
  version: text("version"),
  downloadUrl: text("download_url").notNull(),
  downloadCount: integer("download_count").notNull().default(0),
  isPublic: boolean("is_public").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertProductSchema = createInsertSchema(productsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof productsTable.$inferSelect;
export type ProductVersion = typeof productVersionsTable.$inferSelect;
export type DownloadFile = typeof downloadFilesTable.$inferSelect;
