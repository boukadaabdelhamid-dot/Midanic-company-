CREATE TABLE IF NOT EXISTS "erp_tenants" (
  "id" serial PRIMARY KEY NOT NULL,
  "owner_user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "company_name" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "trial_started_at" timestamp with time zone,
  "trial_ends_at" timestamp with time zone,
  "approved_at" timestamp with time zone,
  "suspended_at" timestamp with time zone,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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