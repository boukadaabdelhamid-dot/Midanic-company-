CREATE TABLE "desktop_licenses" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_name" text,
	"hwid" text NOT NULL,
	"license_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "desktop_licenses_hwid_unique" ON "desktop_licenses" USING btree ("hwid");--> statement-breakpoint
CREATE UNIQUE INDEX "desktop_licenses_key_unique" ON "desktop_licenses" USING btree ("license_key");