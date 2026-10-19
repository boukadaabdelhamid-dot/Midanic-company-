const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

const posPage = readFileSync(path.join(__dirname, "../src/pages/Pos.tsx"), "utf8");
const saleOrdersPage = readFileSync(path.join(__dirname, "../src/pages/SaleOrders.tsx"), "utf8");
const onlineOrdersPage = readFileSync(path.join(__dirname, "../src/pages/OnlineOrders.tsx"), "utf8");
const erpRoutes = readFileSync(path.join(__dirname, "../../erp-api-server/src/routes/erp.ts"), "utf8");
const webOrderRoutes = readFileSync(path.join(__dirname, "../../erp-api-server/src/routes/web-orders.ts"), "utf8");
const createRouteStart = erpRoutes.indexOf('router.post("/erp/sale-orders"');
const createRouteEnd = erpRoutes.indexOf('router.put("/erp/sale-orders/:id"', createRouteStart);
assert.ok(createRouteStart >= 0 && createRouteEnd > createRouteStart, "sale-order creation route must exist");
const createRoute = erpRoutes.slice(createRouteStart, createRouteEnd);

test("quick sales explicitly request the POS source", () => {
  assert.match(posPage, /orderSource:\s*"pos"/);
  assert.match(posPage, /fetch\(`\$\{apiBase\}\/api\/erp\/sale-orders`/);
});

test("sale-order creation defaults to formal bons and rejects online as a staff source", () => {
  assert.match(createRoute, /requestedOrderSource !== "bon"[\s\S]*requestedOrderSource !== "pos"/);
  assert.match(createRoute, /requestedOrderSource === "pos" \? "pos" : "bon"/);
  assert.match(createRoute, /'0',\s*\$\{orderSource\},\s*\$\{pm\}/);
});

test("the actual source guard accepts only bon/pos without touching stored orders", () => {
  const block = createRoute.slice(
    createRoute.indexOf("const requestedOrderSource"),
    createRoute.indexOf("const validErr"),
  ).replace(/\(req\.body as \{ orderSource\?: unknown \}\)/, "req.body");
  for (const [body, expected] of [
    [{}, "bon"],
    [{ orderSource: "bon" }, "bon"],
    [{ orderSource: "pos" }, "pos"],
    [{ orderSource: "online" }, undefined],
    [{ orderSource: "invalid" }, undefined],
  ]) {
    let status;
    const actual = vm.runInNewContext(`(function () { ${block}; return orderSource; })()`, {
      req: { body },
      res: { status(code) { status = code; return this; }, json() {} },
    });
    assert.equal(actual, expected);
    assert.equal(status, expected === undefined ? 400 : undefined);
  }
});

test("the Bons de Vente list opens on formal bons and reset returns to that default", () => {
  assert.match(saleOrdersPage, /const \[orderSource, setOrderSource\] = useState\("bon"\)/);
  assert.match(saleOrdersPage, /setOrderSource\("bon"\)/);
  assert.match(saleOrdersPage, /<option value="pos">/);
  assert.match(saleOrdersPage, /<option value="online">/);
});

test("online orders remain on the online-only query", () => {
  assert.match(onlineOrdersPage, /channel:\s*GetAdminOrdersChannel\.online/);
  assert.match(webOrderRoutes, /orderSource:\s*"online"/);
});
