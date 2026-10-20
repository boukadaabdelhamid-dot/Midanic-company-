import assert from "node:assert/strict";
import test from "node:test";
import type { Product } from "@workspace/erp-api-client-react";
import { findReturnProductByCode } from "./return-product-lookup";

const product = (id: number, barcode: string, reference = "") =>
  ({ id, barcode, reference, stock: 0 } as Product);

test("looks up products outside the dialog's first 500, including zero-stock products", async () => {
  const target = product(800, "001234567890");
  let aliasesRequested = false;
  const found = await findReturnProductByCode(" 001234567890 ", async (params) => {
    assert.equal(params.filterCode, "001234567890");
    return { products: [target], total: 1 };
  }, async () => { aliasesRequested = true; return []; });
  assert.equal(found, target);
  assert.equal(aliasesRequested, false);
});

test("paginates partial matches and accepts only an exact barcode or reference", async () => {
  const target = product(999, "unused", "REF");
  const pages: number[] = [];
  const found = await findReturnProductByCode("ref", async ({ page }) => {
    pages.push(page);
    return { products: page === 1 ? [product(1, "REF-more")] : [target], total: 101 };
  }, async () => []);
  assert.equal(found, target);
  assert.deepEqual(pages, [1, 2]);
});

test("resolves an additional barcode even when the product was not preloaded", async () => {
  const target = product(701, "primary");
  const found = await findReturnProductByCode("ALIAS", async (params) => {
    if (params.filterCode) return { products: [], total: 0 };
    assert.equal(params.filterId, "701");
    return { products: [target], total: 1 };
  }, async () => [{ barcode: " alias ", productId: target.id }]);
  assert.equal(found, target);
});

test("does not return a product outside the current store results, or a partial match", async () => {
  assert.equal(await findReturnProductByCode("123", async () => ({
    products: [product(2, "1234")], total: 1,
  }), async () => []), null);
  assert.equal(await findReturnProductByCode("alias", async () => ({
    products: [], total: 0,
  }), async () => [{ barcode: "alias", productId: 50 }]), null);
});

test("propagates lookup and alias service errors rather than reporting not found", async () => {
  await assert.rejects(() => findReturnProductByCode("x", async () => {
    throw new Error("HTTP 401");
  }, async () => []), /HTTP 401/);
  await assert.rejects(() => findReturnProductByCode("x", async () => ({
    products: [], total: 0,
  }), async () => { throw new Error("HTTP 403"); }), /HTTP 403/);
});
