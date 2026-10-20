import assert from "node:assert/strict";
import test from "node:test";
import { getLinkedSaleOrderId } from "./customer-operation-order";

test("opens explicit order references and legacy order notes", () => {
  assert.equal(getLinkedSaleOrderId({ type: "vente_a_terme", reference: "ORDER-764" }), 764);
  assert.equal(getLinkedSaleOrderId({ type: "vente_a_terme", reference: " order-27 " }), 27);
  assert.equal(getLinkedSaleOrderId({ type: "vente_a_terme", note: "Vente à terme POS — commande #764 (versement 700.00 DA)" }), 764);
});

test("does not guess an order from arbitrary numbers or unrelated operations", () => {
  assert.equal(getLinkedSaleOrderId({ type: "versement", reference: "ORDER-27" }), null);
  assert.equal(getLinkedSaleOrderId({ type: "vente_a_terme", reference: "27" }), null);
  assert.equal(getLinkedSaleOrderId({ type: "vente_a_terme", note: "Montant 700.00 DA" }), null);
  assert.equal(getLinkedSaleOrderId({ type: "vente_a_terme", reference: "ORDER-0" }), null);
  assert.equal(getLinkedSaleOrderId({ type: "vente_a_terme", reference: "ORDER-999999999999999999999" }), null);
});

test("the explicit reference takes precedence over the note", () => {
  assert.equal(getLinkedSaleOrderId({ type: "vente_a_terme", reference: "ORDER-27", note: "commande #28" }), 27);
});
