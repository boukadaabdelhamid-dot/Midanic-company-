import assert from "node:assert/strict";
import test from "node:test";

// Read-only integration checks against a running Platform API.
const baseUrl = process.env.PUBLIC_CATALOG_TEST_BASE_URL || "http://localhost:8080";
const invalidAuth = { Authorization: "Bearer public-catalog-regression-invalid" };

async function get(path, headers) {
  const response = await fetch(new URL(path, baseUrl), {
    headers,
    signal: AbortSignal.timeout(10000),
  });
  return { status: response.status, body: await response.json() };
}

test("public software catalog is identical with and without a bearer token", async () => {
  const anonymous = await get("/api/catalog/products");
  const authenticated = await get("/api/catalog/products", invalidAuth);
  assert.equal(anonymous.status, 200);
  assert.ok(Array.isArray(anonymous.body), "Catalog must return a software array");
  assert.equal(authenticated.status, 200, "Public catalog must ignore login state");
  assert.deepEqual(authenticated.body, anonymous.body);
  assert.ok(anonymous.body.every((product) => product.published === true));
});

test("catalog filters stay public with a bearer token", async () => {
  const featured = await get("/api/catalog/products?featured=true", invalidAuth);
  assert.equal(featured.status, 200);
  assert.ok(Array.isArray(featured.body));
  assert.ok(featured.body.every((product) => product.featured === true));

  const all = await get("/api/catalog/products");
  if (all.body.length) {
    const category = all.body[0].category;
    const filtered = await get(
      `/api/catalog/products?category=${encodeURIComponent(category)}`,
      invalidAuth,
    );
    assert.equal(filtered.status, 200);
    assert.deepEqual(filtered.body, all.body.filter((p) => p.category === category));
  }
});

test("legacy anonymous catalog and ERP authentication remain unchanged", async () => {
  const catalog = await get("/api/catalog/products");
  const legacy = await get("/api/products");
  assert.equal(legacy.status, 200);
  assert.deepEqual(legacy.body, catalog.body);
  const legacyErp = await get("/api/products", invalidAuth);
  assert.equal(legacyErp.status, 401, "Legacy ERP path must retain authentication");
});
