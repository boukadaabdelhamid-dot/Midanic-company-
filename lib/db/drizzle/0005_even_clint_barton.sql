ALTER TABLE "licenses" ADD COLUMN IF NOT EXISTS "erp_tenant_id" integer;--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'licenses_erp_tenant_id_erp_tenants_id_fk'
      AND conrelid = 'public.licenses'::regclass
  ) THEN
    ALTER TABLE "licenses"
      ADD CONSTRAINT "licenses_erp_tenant_id_erp_tenants_id_fk"
      FOREIGN KEY ("erp_tenant_id")
      REFERENCES "public"."erp_tenants"("id")
      ON DELETE set null
      ON UPDATE no action
      NOT VALID;
  END IF;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "licenses_erp_tenant_id_idx"
  ON "licenses" USING btree ("erp_tenant_id");