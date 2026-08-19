import { pgTable, serial, integer, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const erpTenantStatusValues = [
  "pending",
  "active",
  "suspended",
  "expired",
  "converted",
] as const;

export type ErpTenantStatus = (typeof erpTenantStatusValues)[number];

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
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex("erp_tenants_subdomain_uq").on(table.subdomain),
  uniqueIndex("erp_tenants_hostname_uq").on(table.hostname),
]);

export type ErpTenant = typeof erpTenantsTable.$inferSelect;
export type InsertErpTenant = typeof erpTenantsTable.$inferInsert;