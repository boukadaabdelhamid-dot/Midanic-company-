import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { eq, inArray, like } from "drizzle-orm";

if (process.env["NODE_ENV"] === "production") {
  throw new Error("Permission fixtures must not run in production");
}
const databaseUrl = process.env["ERP_TEST_DATABASE_URL"] ?? process.env["DATABASE_URL"];
if (databaseUrl) process.env["DATABASE_URL"] = databaseUrl;
process.env["NODE_ENV"] = "test";

test("employee attribute creation requires its specific grant and supports revocation", {
  skip: !databaseUrl,
}, async () => {
  const [{ default: app }, { db, pool, schema }, { signToken }] = await Promise.all([
    import("../app"), import("./db"), import("./auth"),
  ]);
  const suffix = randomUUID();
  const prefix = `permission-fixture-${suffix}`;
  const server = createServer(app);
  let storeId: number | undefined;
  const userIds: number[] = [];
  try {
    const [store] = await db.insert(schema.storesTable).values({
      nameAr: "اختبار الصلاحيات", nameEn: prefix, slug: prefix, isActive: true,
    }).returning();
    storeId = store.id;
    for (const role of ["admin", "employee"] as const) {
      const [user] = await db.insert(schema.usersTable).values({
        name: prefix, email: `${role}-${suffix}@example.test`,
        passwordHash: "fixture-not-a-login", role,
      }).returning();
      userIds.push(user.id);
      await db.insert(schema.userStoresTable).values({ userId: user.id, storeId });
    }
    await db.insert(schema.userPermissionsTable).values([
      { userId: userIds[1], section: "settings", action: "view", granted: true },
      { userId: userIds[1], section: "settings", action: "create", granted: true },
    ]);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const base = `http://127.0.0.1:${address.port}/api`;
    const headers = (employee: boolean) => ({
      Authorization: `Bearer ${signToken({
        id: userIds[employee ? 1 : 0],
        email: `${employee ? "employee" : "admin"}-${suffix}@example.test`,
        role: employee ? "employee" : "tenant_admin",
        currentStoreId: store.id,
      })}`,
      "Content-Type": "application/json",
    });
    const setPermission = (action: string, granted: boolean) =>
      fetch(`${base}/erp/permissions/${userIds[1]}`, {
        method: "PUT", headers: headers(false),
        body: JSON.stringify([{ section: "settings", action, granted }]),
      });
    const cases = [
      { resource: "families", action: "create_family" },
      { resource: "brands", action: "create_brand" },
      { resource: "colors", action: "create_color" },
      { resource: "types", action: "create_type" },
    ];
    for (const { resource, action } of cases) {
      const url = `${base}/erp/settings/products/${resource}`;
      const body = JSON.stringify({ nameFr: `${prefix}-${resource}`, nameAr: "اختبار" });
      const create = (employee = true) => fetch(url, {
        method: "POST", headers: headers(employee),
        body: employee ? body : JSON.stringify({
          nameFr: `${prefix}-${resource}-owner`, nameAr: "اختبار مدير",
        }),
      });
      assert.equal((await create()).status, 403, `${action}: generic create must not suffice`);
      assert.equal((await setPermission(action, true)).status, 200);
      const saved = await fetch(`${base}/erp/permissions/${userIds[1]}`, { headers: headers(false) });
      const grants = await saved.json() as { action: string; granted: boolean }[];
      assert.ok(grants.some((p) => p.action === action && p.granted));
      const created = await create();
      assert.equal(created.status, 201, `${action}: granted employee can create`);
      const item = await created.json() as { id: number };
      const listed = await fetch(url, { headers: headers(true) });
      assert.equal(listed.status, 200);
      const data = await listed.json() as { items: { id: number }[] };
      assert.ok(data.items.some((row) => row.id === item.id));
      for (const method of ["PUT", "DELETE"]) {
        const response = await fetch(`${url}/${item.id}`, {
          method, headers: headers(true), ...(method === "PUT" ? { body } : {}),
        });
        assert.equal(response.status, 403, `${action}: creation grants no editing/deletion`);
      }
      assert.equal((await setPermission(action, false)).status, 200);
      assert.equal((await create()).status, 403, `${action}: revocation is immediate`);
      assert.equal((await create(false)).status, 201, `${action}: company owner retains access`);
    }
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    try {
      if (storeId) {
        for (const table of [schema.productFamiliesTable, schema.productBrandsTable, schema.productColorsTable]) {
          await db.delete(table).where(eq(table.storeId, storeId));
        }
        await db.delete(schema.userStoresTable).where(eq(schema.userStoresTable.storeId, storeId));
        await db.delete(schema.storesTable).where(eq(schema.storesTable.id, storeId));
      }
      await db.delete(schema.productTypesTable).where(like(schema.productTypesTable.nameFr, `${prefix}%`));
      if (userIds.length) {
        await db.delete(schema.userPermissionsTable).where(inArray(schema.userPermissionsTable.userId, userIds));
        await db.delete(schema.usersTable).where(inArray(schema.usersTable.id, userIds));
      }
    } finally {
      await pool.end();
    }
  }
});
