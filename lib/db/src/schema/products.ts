import { pgTable, serial, text, boolean, timestamp, integer, real, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const localizedRequestTextSchema = z.object({
  en: z.string().min(1).max(120),
  fr: z.string().min(1).max(120),
  ar: z.string().min(1).max(120),
});
export type LocalizedRequestText = z.infer<typeof localizedRequestTextSchema>;

export const productRequestOptionSchema = z.object({
  value: z.string().min(1).max(80),
  label: localizedRequestTextSchema,
});

export const productRequestFieldSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]*$/).max(40),
  label: localizedRequestTextSchema,
  type: z.enum(["text", "number", "textarea", "select", "multiselect"]),
  required: z.boolean(),
  options: z.array(productRequestOptionSchema).max(30).optional(),
});
export type ProductRequestField = z.infer<typeof productRequestFieldSchema>;

export const defaultErpRequestFormFields: ProductRequestField[] = [
  {
    key: "store_count",
    label: {
      en: "How many stores do you have?",
      fr: "Combien de magasins avez-vous ?",
      ar: "كم عدد المتاجر لديكم؟",
    },
    type: "number",
    required: true,
  },
  {
    key: "erp_functions",
    label: {
      en: "Which functions do you need?",
      fr: "Quelles fonctionnalités vous intéressent ?",
      ar: "ما الوظائف التي تحتاجونها؟",
    },
    type: "multiselect",
    required: true,
    options: [
      { value: "sales", label: { en: "Sales", fr: "Ventes", ar: "المبيعات" } },
      { value: "inventory", label: { en: "Inventory", fr: "Stock", ar: "المخزون" } },
      { value: "purchases", label: { en: "Purchases", fr: "Achats", ar: "المشتريات" } },
      { value: "accounting", label: { en: "Accounting", fr: "Comptabilité", ar: "المحاسبة" } },
      { value: "hr", label: { en: "Human resources", fr: "Ressources humaines", ar: "الموارد البشرية" } },
      { value: "point_of_sale", label: { en: "Point of sale", fr: "Point de vente", ar: "نقطة البيع" } },
      { value: "reports", label: { en: "Reports", fr: "Rapports", ar: "التقارير" } },
      { value: "web_store", label: { en: "Online store", fr: "Boutique en ligne", ar: "المتجر الإلكتروني" } },
    ],
  },
];

export const productsTable = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description").notNull(),
  shortDescription: text("short_description"),
  category: text("category").notNull().default("software"),
  productType: text("product_type").$type<"desktop" | "erp">().notNull().default("desktop"),
  requestFormFields: jsonb("request_form_fields").$type<ProductRequestField[]>().notNull().default([]),
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
