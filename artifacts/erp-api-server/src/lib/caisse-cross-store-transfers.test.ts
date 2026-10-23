import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { and, eq, inArray } from "drizzle-orm";

if (process.env["NODE_ENV"] === "production") {
  throw new Error("Caisse-transfer fixtures must not run in production");
}
const databaseUrl = process.env["ERP_TEST_DATABASE_URL"] ?? process.env["DATABASE_URL"];
if (databaseUrl) process.env["DATABASE_URL"] = databaseUrl;
process.env["NODE_ENV"] = "test";

test("global caisse transfers follow their participants across stores without exposing colleagues' transfers", {
  skip: !databaseUrl,
}, async () => {
  const [{ default: app }, { db, pool, schema }, { signToken }, { ensureCaisse }] = await Promise.all([
    import("../app"), import("./db"), import("./auth"), import("../routes/caisses"),
  ]);
  const suffix = randomUUID().replaceAll("-", "");
  const server = createServer(app);
  const storeIds: number[] = [];
  const userIds: number[] = [];
  const caisseIds: number[] = [];
  const transferIds: number[] = [];
  try {
    for (let i = 0; i < 2; i++) {
      const [store] = await db.insert(schema.storesTable).values({
        nameAr: "اختبار تحويل الصناديق", nameEn: `Cross-store ${i}`,
        slug: `caisse-cross-${i}-${suffix}`, isActive: true,
      }).returning();
      storeIds.push(store.id);
    }
    for (let i = 0; i < 3; i++) {
      const [user] = await db.insert(schema.usersTable).values({
        name: `Cross-store employee ${i}`, email: `caisse-${i}-${suffix}@example.test`,
        passwordHash: "fixture-not-a-login", role: "employee",
      }).returning();
      userIds.push(user.id);
      for (const storeId of storeIds) {
        await db.insert(schema.userStoresTable).values({ userId: user.id, storeId });
      }
      const caisse = await ensureCaisse(storeIds[0], user.id);
      caisseIds.push(caisse.id);
    }
    await db.update(schema.caissesTable).set({ balance: "100.00" })
      .where(eq(schema.caissesTable.id, caisseIds[0]));
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const base = `http://127.0.0.1:${address.port}/api/erp/caisse-transfers`;
    const headers = (userIndex: number, storeIndex = 1) => ({
      Authorization: `Bearer ${signToken({
        id: userIds[userIndex], email: `caisse-${userIndex}-${suffix}@example.test`,
        role: "employee", currentStoreId: storeIds[storeIndex],
      })}`,
      "Content-Type": "application/json",
    });
    const list = async (userIndex: number, box: string, storeIndex = 1) => {
      const response = await fetch(`${base}?box=${box}`, { headers: headers(userIndex, storeIndex) });
      assert.equal(response.status, 200);
      return await response.json() as Array<{ id: number; status: string }>;
    };
    for (let i = 0; i < 3; i++) {
      const response = await fetch(base, {
        method: "POST", headers: headers(0, 0),
        body: JSON.stringify({ recipientUserId: userIds[1], amount: "7.25" }),
      });
      assert.equal(response.status, 201);
      const created = await response.json() as { id: number };
      transferIds.push(created.id);
    }
    // The recipient no longer needs access to the originating store.
    await db.delete(schema.userStoresTable).where(and(
      eq(schema.userStoresTable.userId, userIds[1]),
      eq(schema.userStoresTable.storeId, storeIds[0]),
    ));
    for (const id of transferIds) {
      assert.ok((await list(1, "inbox")).some(row => row.id === id));
      assert.ok((await list(0, "outbox")).some(row => row.id === id));
      assert.ok(!(await list(2, "all")).some(row => row.id === id));
    }
    const action = (id: number, verb: string, userIndex: number) => fetch(`${base}/${id}/${verb}`, {
      method: "POST", headers: headers(userIndex),
    });
    assert.equal((await action(transferIds[0], "accept", 2)).status, 403);
    assert.equal((await action(transferIds[1], "reject", 2)).status, 403);
    assert.equal((await action(transferIds[2], "cancel", 2)).status, 403);
    assert.equal((await action(transferIds[0], "accept", 0)).status, 403);
    assert.equal((await action(transferIds[2], "cancel", 1)).status, 403);
    assert.equal((await action(transferIds[0], "accept", 1)).status, 200);
    assert.equal((await action(transferIds[0], "accept", 1)).status, 409);
    assert.equal((await action(transferIds[1], "reject", 1)).status, 200);
    assert.equal((await action(transferIds[2], "cancel", 0)).status, 200);
    const caisses = await db.select().from(schema.caissesTable)
      .where(inArray(schema.caissesTable.id, caisseIds));
    assert.equal(Number(caisses.find(row => row.id === caisseIds[0])!.balance), 92.75);
    assert.equal(Number(caisses.find(row => row.id === caisseIds[1])!.balance), 7.25);
    assert.equal(Number(caisses.find(row => row.id === caisseIds[2])!.balance), 0);
    const movements = await db.select().from(schema.caisseMovementsTable)
      .where(inArray(schema.caisseMovementsTable.caisseTransferId, transferIds));
    assert.equal(movements.length, 2);
    assert.ok(movements.every(row => row.caisseTransferId === transferIds[0]));
    assert.equal((await list(1, "inbox")).find(row => row.id === transferIds[0])?.status, "accepted");
    assert.equal((await list(0, "outbox", 0)).find(row => row.id === transferIds[2])?.status, "cancelled");
  } finally {
    if (server.listening) await new Promise<void>((resolve) => server.close(() => resolve()));
    if (transferIds.length) {
      await db.delete(schema.caisseMovementsTable)
        .where(inArray(schema.caisseMovementsTable.caisseTransferId, transferIds));
      await db.delete(schema.caisseTransfersTable).where(inArray(schema.caisseTransfersTable.id, transferIds));
    }
    if (userIds.length) {
      await db.delete(schema.userStoresTable).where(inArray(schema.userStoresTable.userId, userIds));
      await db.delete(schema.caissesTable).where(inArray(schema.caissesTable.ownerUserId, userIds));
      await db.delete(schema.usersTable).where(inArray(schema.usersTable.id, userIds));
    }
    if (storeIds.length) await db.delete(schema.storesTable).where(inArray(schema.storesTable.id, storeIds));
    await pool.end();
  }
});
