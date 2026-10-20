import assert from "node:assert/strict";
import test from "node:test";
import { getLinkedPurchaseOrderId } from "./supplier-operation-order";

test("uses an explicit purchase-order ID or PO reference", () => {
  assert.equal(getLinkedPurchaseOrderId({ type: "purchase", poId: 13 }), 13);
  assert.equal(getLinkedPurchaseOrderId({ type: "purchase", reference: "PO-13" }), 13);
  assert.equal(getLinkedPurchaseOrderId({ type: "purchase_comptant", reference: "PO #42" }), 42);
});

test("does not infer purchase orders from unrelated operations or references", () => {
  assert.equal(getLinkedPurchaseOrderId({ type: "payment", reference: "PO-13" }), null);
  assert.equal(getLinkedPurchaseOrderId({ type: "purchase", source: "customer", reference: "PO-13" }), null);
  assert.equal(getLinkedPurchaseOrderId({ type: "purchase", reference: "invoice 13" }), null);
  assert.equal(getLinkedPurchaseOrderId({ type: "purchase", reference: "PO-0" }), null);
  assert.equal(getLinkedPurchaseOrderId({ type: "purchase", poId: Number.MAX_SAFE_INTEGER + 1 }), null);
});

test("does not let a stale reference override the explicit linked order ID", () => {
  assert.equal(getLinkedPurchaseOrderId({ type: "purchase", poId: 7, reference: "PO-13" }), 7);
});
