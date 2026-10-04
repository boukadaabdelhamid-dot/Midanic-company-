import assert from "node:assert/strict";
import test from "node:test";
import {
  selectTenantArchiveEntries,
  TenantBackupImportError,
} from "./database-backup-import";

const validTenantArchive = [
  "; Dumped from database version: 16.2",
  "1; 2615 2200 SCHEMA - erp owner",
  "2; 1247 16384 TYPE public user_role owner",
  "3; 1259 16400 TABLE erp users owner",
  "4; 1259 16420 TABLE erp stores owner",
  "5; 1259 16440 TABLE erp products owner",
  "6; 1259 16460 TABLE erp orders owner",
  "7; 0 16400 TABLE DATA erp users owner",
  "8; 0 16420 TABLE DATA erp stores owner",
  "9; 0 16440 TABLE DATA erp products owner",
  "10; 0 16460 TABLE DATA erp orders owner",
  "11; 1259 25010 MATERIALIZED VIEW erp daily_order_totals owner",
  "12; 1259 25000 TABLE public platform_users owner",
  "13; 0 25000 TABLE DATA public platform_users owner",
].join("\n");

test("selects only tenant ERP objects and explicitly required shared enum types", () => {
  const result = selectTenantArchiveEntries(validTenantArchive);

  assert.equal(result.sourceDatabaseVersion, "16.2");
  assert.deepEqual(result.tableNames, ["orders", "products", "stores", "users"]);
  assert.match(result.list, /SCHEMA - erp/);
  assert.match(result.list, /TYPE public user_role/);
  assert.match(result.list, /TABLE DATA erp users/);
  assert.match(result.list, /MATERIALIZED VIEW erp daily_order_totals/);
  assert.doesNotMatch(result.list, /platform_users/);
});

test("rejects archives that do not contain the ERP schema", () => {
  assert.throws(
    () => selectTenantArchiveEntries("1; 2615 2200 SCHEMA - public owner"),
    TenantBackupImportError,
  );
});

test("rejects archives with global large objects before restore", () => {
  const archiveWithLargeObjects = [
    validTenantArchive,
    "13; 2613 0 BLOB 12345 owner",
  ].join("\n");
  assert.throws(
    () => selectTenantArchiveEntries(archiveWithLargeObjects),
    /large objects/,
  );
});