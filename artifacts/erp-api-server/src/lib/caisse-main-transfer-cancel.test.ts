import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { eq, inArray } from "drizzle-orm";

if (process.env["NODE_ENV"] === "production") {
  throw new Error("Caisse-transfer fixtures must not run in production");
}
const databaseUrl = process.env["ERP_TEST_DATABASE_URL"] ?? process.env["DATABASE_URL"];
if (databaseUrl) process.env["DATABASE_URL"] = databaseUrl;
process.env["NODE_ENV"] = "test";

test("a main-caisse transfer is visible while pending and its sender can cancel it", {
  skip: !databaseUrl,
}, async () => {
  const [{ default: app }, { db, pool, schema }, { signToken }, { ensureCaisse }] = await Promise.all([
    import("../app"), import("./db"), import("./auth"), import("../routes/caisses"),
  ]);
  const suffix = randomUUID().replaceAll("-", "");
  const slug = `main-transfer-${suffix}`;
  const server = createServer(app);
  let storeId: number | undefined;
  const userIds: number[] = [];
  let transferId: number | undefined;
  try {
    const [store] = await db.insert(schema.storesTable).values({
      nameAr: "اختبار التحويل", nameEn: slug, slug, isActive: true,
    }).returning();
    storeId = store.id;
    for (const role of ["admin", "admin", "employee"] as const) {
      const [user] = await db.insert(schema.usersTable).values({
        name: `Main transfer ${role}`,
        email: `${role}-${userIds.length}-${suffix}@example.test`,
        passwordHash: "fixture-not-a-login",
        role,
      }).returning();
      userIds.push(user.id);
      await db.insert(schema.userStoresTable).values({ userId: user.id, storeId });
    }
    const main = await ensureCaisse(store.id, null);
    const recipient = userIds[2];
    assert.ok(recipient);

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const base = `http://127.0.0.1:${address.port}/api`;
    const headers = (index: number) => ({
      Authorization: `Bearer ${signToken({
        id: userIds[index], email: `user-${index}-${suffix}@example.test`,
        role: index < 2 ? "tenant_admin" : "employee", currentStoreId: store.id,
      })}`,
      "Content-Type": "application/json",
    });
    const createdResponse = await fetch(`${base}/erp/caisse-transfers`, {
      method: "POST",
      headers: headers(0),
      body: JSON.stringify({
        senderCaisseId: main.id, recipientUserId: recipient,
        amount: "7.25", notes: "awaiting recipient",
      }),
    });
    assert.equal(createdResponse.status, 201);
    const created = await createdResponse.json() as { id: number; status: string };
    transferId = created.id;
    assert.equal(created.status, "pending");

    const outboxResponse = await fetch(`${base}/erp/caisse-transfers?box=outbox`, { headers: headers(0) });
    assert.equal(outboxResponse.status, 200);
    const outbox = await outboxResponse.json() as Array<{
      id: number; status: string; senderCaisse: { kind: string }; requestedByUserId: number;
    }>;
    assert.ok(outbox.some((item) =>
      item.id === transferId && item.status === "pending" &&
      item.senderCaisse.kind === "main" && item.requestedByUserId === userIds[0],
    ));

    const inboxResponse = await fetch(`${base}/erp/caisse-transfers?box=inbox`, { headers: headers(2) });
    assert.equal(inboxResponse.status, 200);
    const inbox = await inboxResponse.json() as Array<{ id: number; status: string }>;
    assert.ok(inbox.some((item) => item.id === transferId && item.status === "pending"));

    const wrongSenderCancel = await fetch(`${base}/erp/caisse-transfers/${transferId}/cancel`, {
      method: "POST", headers: headers(1),
    });
    assert.equal(wrongSenderCancel.status, 403);

    const cancelResponse = await fetch(`${base}/erp/caisse-transfers/${transferId}/cancel`, {
      method: "POST", headers: headers(0),
    });
    assert.equal(cancelResponse.status, 200);
    const [cancelled] = await db.select().from(schema.caisseTransfersTable)
      .where(eq(schema.caisseTransfersTable.id, transferId));
    assert.equal(cancelled.status, "cancelled");
    assert.equal((await db.select().from(schema.caisseMovementsTable)
      .where(eq(schema.caisseMovementsTable.caisseTransferId, transferId))).length, 0);

    const secondCancel = await fetch(`${base}/erp/caisse-transfers/${transferId}/cancel`, {
      method: "POST", headers: headers(0),
    });
    assert.equal(secondCancel.status, 409);
  } finally {
    if (server.listening) await new Promise<void>((resolve) => server.close(() => resolve()));
    if (transferId) await db.delete(schema.caisseTransfersTable)
      .where(eq(schema.caisseTransfersTable.id, transferId));
    if (userIds.length) {
      await db.delete(schema.userStoresTable).where(inArray(schema.userStoresTable.userId, userIds));
      await db.delete(schema.caissesTable).where(inArray(schema.caissesTable.ownerUserId, userIds));
      await db.delete(schema.usersTable).where(inArray(schema.usersTable.id, userIds));
    }
    if (storeId) await db.delete(schema.storesTable)
      .where(eq(schema.storesTable.id, storeId));
    await pool.end();
  }
});
