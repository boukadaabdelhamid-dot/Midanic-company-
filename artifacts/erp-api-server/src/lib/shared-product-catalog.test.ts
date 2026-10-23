import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { hasSharedCatalogProductChanges, isSafeLegacyCatalogMatchGroup } from "./shared-product-catalog";

describe("shared product catalog synchronization", () => {
  it("does not treat store-local fields as shared product edits", () => {
    assert.equal(hasSharedCatalogProductChanges(["stock", "isExposed", "minStock"]), false);
    assert.equal(hasSharedCatalogProductChanges(["price"]), true);
  });

  it("links only unique barcode matches across different stores", () => {
    assert.equal(isSafeLegacyCatalogMatchGroup([
      { storeId: 1, sharedCatalogId: null },
      { storeId: 2, sharedCatalogId: null },
    ]), true);
    assert.equal(isSafeLegacyCatalogMatchGroup([
      { storeId: 1, sharedCatalogId: null },
    ]), false);
    assert.equal(isSafeLegacyCatalogMatchGroup([
      { storeId: 1, sharedCatalogId: null },
      { storeId: 1, sharedCatalogId: null },
    ]), false);
    assert.equal(isSafeLegacyCatalogMatchGroup([
      { storeId: 1, sharedCatalogId: "catalog-a" },
      { storeId: 2, sharedCatalogId: "catalog-b" },
    ]), false);
  });
});
