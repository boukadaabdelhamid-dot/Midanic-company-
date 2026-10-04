ALTER TABLE "erp_tenants" ADD COLUMN IF NOT EXISTS "data_import_status" text DEFAULT 'not_requested' NOT NULL;--> statement-breakpoint
ALTER TABLE "erp_tenants" ADD COLUMN IF NOT EXISTS "data_import_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "erp_tenants" ADD COLUMN IF NOT EXISTS "data_imported_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "erp_tenants" ADD COLUMN IF NOT EXISTS "data_import_error" text;--> statement-breakpoint
ALTER TABLE "erp_tenants" ADD COLUMN IF NOT EXISTS "data_import_summary" jsonb;