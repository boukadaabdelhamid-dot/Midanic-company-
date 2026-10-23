const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const source = (file) => readFileSync(path.join(__dirname, "../src", file), "utf8");
const purchase = source("pages/SmartPurchase.tsx");
const panel = source("components/manufacturing/FactoryProductionNeeds.tsx");
const production = source("pages/Manufacturing.tsx");

test("only factory smart purchase shows finished-goods production needs", () => {
  assert.match(purchase, /const isFactory = .*kind === "factory"/);
  assert.match(purchase, /isFactory && store && stockFilter !== "suggestions"/);
  assert.match(panel, /needs\.data\?\.finishedGoods/);
  assert.match(panel, /manufacturingQueryKeys\.replenishment, storeId/);
  assert.match(panel, /can\("manufacturing", "view"\)/);
  assert.doesNotMatch(panel, /setQuickOrderProduct|purchase-orders|rawMaterials/);
});

test("manufacturing needs navigate to production with the product and factory IDs", () => {
  assert.match(panel, /navigate\(`\/manufacturing\?tab=replenishment&productId=\$\{item\.productId\}&storeId=\$\{storeId\}`\)/);
  assert.doesNotMatch(panel, /useMutation|mutationFn|method:\s*["']POST/);
});

test("production prefills a fresh scoped recommendation without creating an order", () => {
  const start = production.indexOf("if (handledProductionLink.current");
  const end = production.indexOf("const loading =", start);
  assert.ok(start > 0 && end > start);
  const routing = production.slice(start, end);
  assert.match(routing, /recipesQuery\.isFetching \|\| replenishmentQuery\.isFetching/);
  assert.match(routing, /Number\(params\.get\("storeId"\)\) !== store\.id/);
  assert.match(routing, /!can\("manufacturing", "create"\)/);
  assert.match(routing, /item\.recipeId && item\.recipeIsActive/);
  assert.match(routing, /setOrderQuantity\(String\(item\.suggestedQuantity\)\)/);
  assert.match(routing, /outputProductId: String\(item\.productId\)/);
  assert.match(routing, /setRecipeOpen\(true\)/);
  assert.doesNotMatch(routing, /\.mutate\(/);
});

test("raw-material purchase actions remain available separately", () => {
  assert.match(purchase, /Raw materials to purchase/);
  assert.match(purchase, /onClick=\{\(\) => setQuickOrderProduct\(row\)\}/);
});
