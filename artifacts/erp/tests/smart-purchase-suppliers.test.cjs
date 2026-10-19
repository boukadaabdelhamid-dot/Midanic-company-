const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const erpPage = readFileSync(path.join(__dirname, "../src/pages/SmartPurchase.tsx"), "utf8");
const selectComponent = readFileSync(path.join(__dirname, "../src/components/ui/searchable-select.tsx"), "utf8");
const commandComponent = readFileSync(path.join(__dirname, "../src/components/ui/command.tsx"), "utf8");
const apiRoutes = readFileSync(path.join(__dirname, "../../erp-api-server/src/routes/erp.ts"), "utf8");
const routeStart = apiRoutes.indexOf('router.get("/erp/purchases/filter-options"');
const routeEnd = apiRoutes.indexOf("\n});", routeStart);
assert.ok(routeStart >= 0 && routeEnd > routeStart, "smart purchase filter-options endpoint must exist");
const filterOptionsRoute = apiRoutes.slice(routeStart, routeEnd);

test("smart purchase filter options include every supplier for the active store", () => {
  assert.match(filterOptionsRoute, /id: schema\.suppliersTable\.id,\s*name: schema\.suppliersTable\.name/);
  assert.match(filterOptionsRoute, /eq\(schema\.suppliersTable\.storeId, storeId\)/);
  assert.match(filterOptionsRoute, /orderBy\(schema\.suppliersTable\.name\)/);
  assert.match(filterOptionsRoute, /res\.json\(\{ families, brands, supplierCities, suppliers \}\)/);
});

test("supplier options are refreshed and scoped per selected store", () => {
  assert.match(erpPage, /queryKey: \["purchase-filter-options", store\?\.id\]/);
  assert.match(erpPage, /enabled: !!store\?\.id/);
  assert.match(erpPage, /filterOpts\?\.suppliers \?\? \[\]/);
  assert.doesNotMatch(erpPage, /useGetSuppliers/);
});

test("supplier filtering and quick ordering use searchable scrollable pickers", () => {
  assert.equal((erpPage.match(/<SearchableSelect/g) ?? []).length, 3);
  assert.match(erpPage, /searchPlaceholder=\{t\("Rechercher un fournisseur…", "ابحث عن مورد…"\)\}/);
  assert.match(selectComponent, /<CommandInput/);
  assert.match(selectComponent, /max-h-\[220px\]/);
  assert.match(commandComponent, /overflow-y-auto/);
});
