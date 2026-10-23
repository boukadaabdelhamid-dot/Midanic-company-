const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const source = (file) => readFileSync(path.join(__dirname, "../src", file), "utf8");

test("navigation counts all company locations after factory provisioning, not employee memberships", () => {
  const hook = source("hooks/use-company-sites.ts");
  assert.match(hook, /\/api\/erp\/stores\/all/);
  assert.match(hook, /enabled: enabled && mine\.isSuccess/);
  assert.match(hook, /getCompanySiteCount\(all\.data\)/);
  assert.match(hook, /!mine\.isError && \(mine\.isPending \|\| all\.isPending\)/);
  assert.match(hook, /refetchInterval: 60_000/);
});

test("single-site companies lose both stores and transfers links and the switcher", () => {
  const sidebar = source("components/layout/Sidebar.tsx");
  assert.match(sidebar, /it\.href === "\/stores" \|\| it\.href === "\/transfers"/);
  assert.match(sidebar, /&& !hasMultipleSites\) return false/);
  assert.match(sidebar, /if \(!hasMultipleSites \|\| stores\.length === 1\)/);
  assert.match(sidebar, /current\?\.nameAr : current\?\.nameEn/);
});

test("direct store-management and transfer routes also require multiple sites", () => {
  const app = source("App.tsx");
  assert.match(app, /component=\{Stores\} adminOnly section="settings" multiSiteOnly/);
  assert.match(app, /component=\{Transfers\} section="transfers" multiSiteOnly/);
  const guard = source("components/layout/MultiSiteOnly.tsx");
  assert.ok(guard.indexOf("if (isError)") < guard.indexOf('return <Redirect to="/home"'));
  assert.match(guard, /if \(!hasMultipleSites\) return <Redirect to="\/home"/);
});

test("single-site owners retain a database-backed rename option in settings", () => {
  const settings = source("pages/Settings.tsx");
  assert.match(settings, /isAdmin && siteCount === 1 && currentStore/);
  assert.match(settings, /isAdmin && hasMultipleSites &&/);
  const rename = source("components/settings/SingleSiteNameSettings.tsx");
  assert.match(rename, /update\.mutate\(\{ id: store\.id, data: \{ nameAr: nameAr\.trim\(\), nameEn: nameEn\.trim\(\) \} \}/);
  assert.match(rename, /qc\.setQueryData<Store\[\]>\(getGetErpStoresMineQueryKey\(\)/);
  assert.match(rename, /getGetMeQueryKey\(\)/);
  assert.match(rename, /setNameAr\(store\.nameAr\)/);
  assert.match(rename, /setNameEn\(store\.nameEn\)/);
});
