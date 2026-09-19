import { pgTable, serial, integer, text, timestamp, uniqueIndex, jsonb } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const erpTenantStatusValues = [
  "pending",
  "active",
  "suspended",
  "expired",
  "converted",
] as const;

export type ErpTenantStatus = (typeof erpTenantStatusValues)[number];

export const erpTenantDatabaseStatusValues = [
  "unprovisioned",
  "provisioning",
  "ready",
  "failed",
] as const;

export type ErpTenantDatabaseStatus = (typeof erpTenantDatabaseStatusValues)[number];

export const webStoreStatusValues = ["inactive", "active"] as const;
export type WebStoreStatus = (typeof webStoreStatusValues)[number];

export const erpFeatureKeys = [
  "dashboard",
  "orders",
  "products",
  "inventory",
  "purchases",
  "customers",
  "suppliers",
  "hr",
  "accounting",
  "reports",
  "transfers",
  "caisse",
  "realtime",
  "alerts",
  "settings",
  "web_store",
] as const;

export type ErpFeatureKey = (typeof erpFeatureKeys)[number];
export type ErpFeatureFlags = Record<ErpFeatureKey, boolean>;

export const defaultErpFeatureFlags: ErpFeatureFlags = {
  dashboard: true,
  orders: true,
  products: true,
  inventory: true,
  purchases: true,
  customers: true,
  suppliers: true,
  hr: true,
  accounting: true,
  reports: true,
  transfers: true,
  caisse: true,
  realtime: true,
  alerts: true,
  settings: true,
  web_store: true,
};

export const erpTenantsTable = pgTable("erp_tenants", {
  id: serial("id").primaryKey(),
  ownerUserId: integer("owner_user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  companyName: text("company_name").notNull(),
  status: text("status").notNull().default("pending"),
  subdomain: text("subdomain"),
  hostname: text("hostname"),
  domainStatus: text("domain_status").notNull().default("inactive"),
  domainActivatedAt: timestamp("domain_activated_at", { withTimezone: true }),
  trialStartedAt: timestamp("trial_started_at", { withTimezone: true }),
  trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  suspendedAt: timestamp("suspended_at", { withTimezone: true }),
  notes: text("notes"),
  databaseName: text("database_name"),
  databaseStatus: text("database_status").notNull().default("unprovisioned"),
  databaseProvisionedAt: timestamp("database_provisioned_at", { withTimezone: true }),
  databaseLastError: text("database_last_error"),
  webStoreStatus: text("web_store_status").notNull().default("inactive"),
  webStoreSubdomain: text("web_store_subdomain"),
  webStoreHostname: text("web_store_hostname"),
  webStoreDomainStatus: text("web_store_domain_status").notNull().default("inactive"),
  webStoreDomainActivatedAt: timestamp("web_store_domain_activated_at", { withTimezone: true }),
  featureFlags: jsonb("feature_flags").$type<ErpFeatureFlags>().notNull().default(defaultErpFeatureFlags),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex("erp_tenants_subdomain_uq").on(table.subdomain),
  uniqueIndex("erp_tenants_hostname_uq").on(table.hostname),
  uniqueIndex("erp_tenants_web_store_subdomain_uq").on(table.webStoreSubdomain),
  uniqueIndex("erp_tenants_web_store_hostname_uq").on(table.webStoreHostname),
]);

export type ErpTenant = typeof erpTenantsTable.$inferSelect;
export type InsertErpTenant = typeof erpTenantsTable.$inferInsert;

export const erpCustomerLinksTable = pgTable("erp_customer_links", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("erp_customer_links_user_uq").on(table.userId),
]);

export type ErpCustomerLink = typeof erpCustomerLinksTable.$inferSelect;