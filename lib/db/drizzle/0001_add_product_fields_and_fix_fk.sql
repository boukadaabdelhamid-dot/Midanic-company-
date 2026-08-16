-- ============================================================
-- Migration 0001: product_versions, download_files, and
--                 products.default_license_type
-- ============================================================
-- This migration is fully idempotent.  It runs correctly on:
--   a) a fresh database (all tables created by 0000)
--   b) a push-bootstrapped database with all tables already present
--   c) a legacy database that may be missing product_versions /
--      download_files (created before those tables were added)
-- ============================================================

-- Ensure product_versions exists (added in this task; old prod DBs may lack it)
CREATE TABLE IF NOT EXISTS "product_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"version" text NOT NULL,
	"release_notes" text,
	"is_latest" boolean DEFAULT false NOT NULL,
	"released_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

-- Ensure download_files exists (same rationale)
CREATE TABLE IF NOT EXISTS "download_files" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"version_id" integer,
	"file_name" text NOT NULL,
	"file_size" integer DEFAULT 0 NOT NULL,
	"platform" text DEFAULT 'windows' NOT NULL,
	"version" text,
	"download_url" text NOT NULL,
	"download_count" integer DEFAULT 0 NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

-- Ensure product_versions.product_id FK exists
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'product_versions_product_id_products_id_fk'
      AND table_name = 'product_versions'
  ) THEN
    ALTER TABLE "product_versions"
      ADD CONSTRAINT "product_versions_product_id_products_id_fk"
      FOREIGN KEY ("product_id") REFERENCES "public"."products"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint

-- Ensure download_files.product_id FK exists
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'download_files_product_id_products_id_fk'
      AND table_name = 'download_files'
  ) THEN
    ALTER TABLE "download_files"
      ADD CONSTRAINT "download_files_product_id_products_id_fk"
      FOREIGN KEY ("product_id") REFERENCES "public"."products"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint

-- Add default_license_type to products (the primary schema change for this task)
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "default_license_type" text;--> statement-breakpoint

-- Add image_url and video_url if missing from older schemas
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "image_url" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "video_url" text;--> statement-breakpoint

-- Fix download_files.version_id FK to ON DELETE SET NULL so deleting a
-- product version nullifies the reference instead of raising a constraint error.
DO $$ BEGIN
  -- Drop with old NO ACTION rule if it exists
  ALTER TABLE "download_files"
    DROP CONSTRAINT IF EXISTS "download_files_version_id_product_versions_id_fk";
  -- Re-add with SET NULL
  ALTER TABLE "download_files"
    ADD CONSTRAINT "download_files_version_id_product_versions_id_fk"
    FOREIGN KEY ("version_id") REFERENCES "public"."product_versions"("id")
    ON DELETE set null ON UPDATE no action;
END $$;
