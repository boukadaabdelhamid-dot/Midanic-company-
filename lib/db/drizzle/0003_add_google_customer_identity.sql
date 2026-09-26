ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "google_sub" text;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_google_sub_uq"
  ON "users" USING btree ("google_sub");