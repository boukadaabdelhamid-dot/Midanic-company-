ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "product_type" text DEFAULT 'desktop' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "request_form_fields" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "demo_requests" ADD COLUMN IF NOT EXISTS "custom_answers" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "trial_requests" ADD COLUMN IF NOT EXISTS "custom_answers" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "erp_tenants" ADD COLUMN IF NOT EXISTS "contract_period" text;--> statement-breakpoint
ALTER TABLE "erp_tenants" ADD COLUMN IF NOT EXISTS "contract_starts_at" date;--> statement-breakpoint
ALTER TABLE "erp_tenants" ADD COLUMN IF NOT EXISTS "contract_ends_at" date;--> statement-breakpoint
ALTER TABLE "erp_tenants" ADD COLUMN IF NOT EXISTS "contract_reminder_sent_on" date;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "erp_tenants_contract_ends_at_idx" ON "erp_tenants" USING btree ("contract_ends_at");