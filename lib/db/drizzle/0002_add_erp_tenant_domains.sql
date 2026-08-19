ALTER TABLE "erp_tenants"
  ADD COLUMN IF NOT EXISTS "subdomain" text,
  ADD COLUMN IF NOT EXISTS "hostname" text,
  ADD COLUMN IF NOT EXISTS "domain_status" text DEFAULT 'inactive' NOT NULL,
  ADD COLUMN IF NOT EXISTS "domain_activated_at" timestamp with time zone;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "erp_tenants_subdomain_uq"
  ON "erp_tenants" ("subdomain") WHERE "subdomain" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "erp_tenants_hostname_uq"
  ON "erp_tenants" ("hostname") WHERE "hostname" IS NOT NULL;