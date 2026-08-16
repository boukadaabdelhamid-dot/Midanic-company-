import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const adminSettingsTable = pgTable("admin_settings", {
  id: serial("id").primaryKey(),
  // Legacy single-language values are kept for backwards-compatible data
  // reconciliation. The application reads the localized columns below.
  adminName: text("admin_name").notNull().default("Midanic Admin"),
  pageTitle: text("page_title").notNull().default("Administration"),
  pageSubtitle: text("page_subtitle")
    .notNull()
    .default("Manage your platform from one place"),
  adminNameEn: text("admin_name_en").notNull().default("Midanic Admin"),
  adminNameFr: text("admin_name_fr").notNull().default("Midanic Admin"),
  adminNameAr: text("admin_name_ar").notNull().default("ميدانيك"),
  pageTitleEn: text("page_title_en").notNull().default("Administration"),
  pageTitleFr: text("page_title_fr").notNull().default("Administration"),
  pageTitleAr: text("page_title_ar").notNull().default("الإدارة"),
  pageSubtitleEn: text("page_subtitle_en")
    .notNull()
    .default("Manage your platform from one place"),
  pageSubtitleFr: text("page_subtitle_fr")
    .notNull()
    .default("Gérez votre plateforme depuis un seul endroit"),
  pageSubtitleAr: text("page_subtitle_ar")
    .notNull()
    .default("أدر منصتك من مكان واحد"),
  accentColor: text("accent_color").notNull().default("#3b82f6"),
  theme: text("theme").notNull().default("dark"),
  sidebarStyle: text("sidebar_style").notNull().default("default"),
  backgroundImageUrl: text("background_image_url"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type AdminSettings = typeof adminSettingsTable.$inferSelect;