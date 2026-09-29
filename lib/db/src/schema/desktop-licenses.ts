import { pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const desktopLicensesTable = pgTable("desktop_licenses", {
  id: serial("id").primaryKey(),
  customerName: text("customer_name"),
  hwid: text("hwid").notNull(),
  licenseKey: text("license_key").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("desktop_licenses_hwid_unique").on(table.hwid),
  uniqueIndex("desktop_licenses_key_unique").on(table.licenseKey),
]);

export type DesktopLicense = typeof desktopLicensesTable.$inferSelect;