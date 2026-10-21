import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import test from "node:test";
import { eq, inArray } from "drizzle-orm";

if (process.env["NODE_ENV"] === "production") {
  throw new Error("Transfer permission fixtures must not run in production");
}
const databaseUrl = process.env["ERP_TEST_DATABASE_URL"] ?? process.env["DATABASE_URL"];
if (databaseUrl) process.env["DATABASE_URL"] = databaseUrl;
process.env["NODE_ENV"] = "test";

test("transfer catalogues and actions respect employee grants and company-owner authority", {
  skip: !databaseUrl,
}, async () => {
  const [{ default: app }, { db, pool, schema }, { signToken }] = await Promise.all([
    import("../app"), import("./db"), import("./auth"),
  ]);
  const prefix = `transfer-fixture-${randomUUID()}`;
  const server = createServer(app);
  const storeIds: number[] = [];
  const userIds: number[] = [];
  try {
    for (const label of ["source", "destination", "inactive"]) {
      const [store] = await db.insert(schema.storesTable).values({
        nameEn: `${prefix}-${label}`, nameAr: "متجر اختبار",
        slug: `${prefix}-${label}`, isActive: label !== "inactive",
      }).returning();
      storeIds.push(store.id);
    }
    const [sourceId, destinationId, inactiveId] = storeIds as [number, number, number];
    for (const role of ["admin", "employee"] as const) {
      const [user] = await db.insert(schema.usersTable).values({
        name: prefix, email: `${role}-${prefix}@example.test`,
        passwordHash: "fixture-not-a-login", role,
      }).returning();
      userIds.push(user.id);
      await db.insert(schema.userStoresTable).values([
        { userId: user.id, storeId: sourceId },
        { userId: user.id, storeId: destinationId },
      ]);
    }
    const [ownerId, employeeId] = userIds as [number, number];
    await db.insert(schema.userPermissionsTable).values([
      { userId: employeeId, section: "transfers", action: "view", granted: true },
      { userId: employeeId, section: "transfers", action: "create", granted: false },
      { userId: employeeId, section: "transfers", action: "edit", granted: false },
    ]);
    const products = await db.insert(schema.productsTable).values([
      { storeId: sourceId, nameEn: prefix, nameAr: "منتج اختبار", reference: prefix, price: "10", stock: 20 },
      { storeId: destinationId, nameEn: prefix, nameAr: "منتج اختبار", reference: prefix, price: "10", stock: 0 },
    ]).returning();
    const sourceProductId = products.find((p) => p.storeId === sourceId)!.id;

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const base = `http://127.0.0.1:${address.port}/api`;
    const headers = (owner: boolean, currentStoreId: number | null = sourceId) => ({
      Authorization: `Bearer ${signToken({
        id: owner ? ownerId : employeeId,
        email: `${owner ? "admin" : "employee"}-${prefix}@example.test`,
        role: owner ? "tenant_admin" : "employee", currentStoreId,
      })}`,
      "Content-Type": "application/json",
    });
    const grant = async (action: "create" | "edit", granted: boolean) => {
      await db.insert(schema.userPermissionsTable).values({
        userId: employeeId, section: "transfers", action, granted,
      }).onConflictDoUpdate({
        target: [schema.userPermissionsTable.userId, schema.userPermissionsTable.section, schema.userPermissionsTable.action],
        set: { granted },
      });
    };
    const catalogue = (storeId: number, owner = false, currentStoreId: number | null = sourceId) =>
      fetch(`${base}/erp/stores/${storeId}/products?search=${prefix}`, { headers: headers(owner, currentStoreId) });
    assert.equal((await catalogue(destinationId)).status, 403, "view alone does not grant cross-store lookup");
    assert.equal((await catalogue(destinationId, true)).status, 200, "company owner can search");
    await grant("create", true);
    const lookup = await catalogue(destinationId);
    assert.equal(lookup.status, 200);
    const result = await lookup.json() as { products: { id: number; costPrice?: string }[] };
    assert.equal(result.products.length, 1);
    assert.equal(result.products[0]!.costPrice, undefined, "lookup returns only the transfer projection");
    assert.equal((await catalogue(sourceId)).status, 400, "counterparty must differ from active store");
    assert.equal((await catalogue(inactiveId)).status, 404, "inactive counterparty is excluded");
    assert.equal((await catalogue(destinationId, false, null)).status, 400, "active store is required");
    assert.equal((await catalogue(sourceId, false, inactiveId)).status, 403, "membership is required");
    assert.equal((await catalogue(sourceId, false, destinationId)).status, 200, "destination employee can find source products");

    const create = (owner: boolean, mode: "request" | "send", inbound = false) =>
      fetch(`${base}/erp/transfers`, {
        method: "POST", headers: headers(owner, inbound ? destinationId : sourceId),
        body: JSON.stringify({
          ...(inbound ? { sourceStoreId: sourceId } : { destinationStoreId: destinationId }),
          mode, items: [{ sourceProductId, quantity: 2 }],
        }),
      });
    const act = (id: number, action: string, owner: boolean, currentStoreId = sourceId) =>
      fetch(`${base}/erp/transfers/${id}/${action}`, { method: "POST", headers: headers(owner, currentStoreId), body: "{}" });
    const regular = await create(false, "request");
    assert.equal(regular.status, 201);
    const regularTransfer = await regular.json() as { id: number };
    await grant("edit", true);
    assert.equal((await act(regularTransfer.id, "dispatch", false)).status, 409, "dispatch cannot skip destination approval");
    assert.equal((await act(regularTransfer.id, "dispatch", true)).status, 409, "combined dispatch preserves approval even for an admin request");
    assert.equal((await act(regularTransfer.id, "prepare", true)).status, 409, "legacy prepare endpoint cannot skip destination approval");
    assert.equal((await act(regularTransfer.id, "receive", false, destinationId)).status, 409, "receipt still requires dispatch");
    assert.equal((await act(regularTransfer.id, "approve", false, destinationId)).status, 200);
    assert.equal((await act(regularTransfer.id, "dispatch", false, destinationId)).status, 403, "only the source may dispatch");
    const dispatched = await act(regularTransfer.id, "dispatch", false);
    assert.equal(dispatched.status, 200);
    const dispatchedTransfer = await dispatched.json() as { status: string; preparedAt: string; shippedAt: string };
    assert.equal(dispatchedTransfer.status, "in_transit", "one action both prepares and ships");
    assert.ok(dispatchedTransfer.preparedAt && dispatchedTransfer.shippedAt);
    assert.equal((await act(regularTransfer.id, "dispatch", false)).status, 409, "dispatch cannot be repeated");
    const events = await db.select({ status: schema.stockTransferEventsTable.status })
      .from(schema.stockTransferEventsTable)
      .where(eq(schema.stockTransferEventsTable.transferId, regularTransfer.id))
      .orderBy(schema.stockTransferEventsTable.createdAt, schema.stockTransferEventsTable.id);
    assert.deepEqual(events.map((event) => event.status), ["requested", "approved", "prepared", "in_transit"]);
    const beforeReceipt = await db.select({ storeId: schema.productsTable.storeId, stock: schema.productsTable.stock })
      .from(schema.productsTable).where(inArray(schema.productsTable.storeId, [sourceId, destinationId]));
    assert.equal(beforeReceipt.find((product) => product.storeId === sourceId)!.stock, 20);
    assert.equal(beforeReceipt.find((product) => product.storeId === destinationId)!.stock, 0);
    assert.equal((await act(regularTransfer.id, "receive", false)).status, 403, "the source cannot confirm receipt");
    assert.equal((await act(regularTransfer.id, "receive", false, destinationId)).status, 200);
    assert.equal((await act(regularTransfer.id, "receive", false, destinationId)).status, 409, "receipt cannot move stock twice");
    const afterReceipt = await db.select({ storeId: schema.productsTable.storeId, stock: schema.productsTable.stock })
      .from(schema.productsTable).where(inArray(schema.productsTable.storeId, [sourceId, destinationId]));
    assert.equal(afterReceipt.find((product) => product.storeId === sourceId)!.stock, 18);
    assert.equal(afterReceipt.find((product) => product.storeId === destinationId)!.stock, 2);

    const directResponse = await create(false, "send");
    assert.equal(directResponse.status, 201, "employee with create permission can register a direct send");
    const direct = await directResponse.json() as { id: number; status: string; directSend: boolean };
    assert.equal(direct.status, "requested", "direct send is recorded before preparation");
    assert.equal(direct.directSend, true);
    assert.equal((await act(direct.id, "approve", false, destinationId)).status, 409, "direct send skips destination pre-approval");
    assert.equal((await act(direct.id, "reject", false, destinationId)).status, 409, "direct send cannot be rejected as an approval request");
    assert.equal((await act(direct.id, "dispatch", false)).status, 409, "direct send cannot skip preparation");
    assert.equal((await act(direct.id, "prepare", false, destinationId)).status, 403, "only the source can prepare");
    assert.equal((await act(direct.id, "prepare", false)).status, 200);
    assert.equal((await act(direct.id, "receive", false, destinationId)).status, 409, "destination cannot receive before shipment");
    const directShip = await act(direct.id, "ship", false);
    assert.equal(directShip.status, 200, "source ships after preparation");
    assert.equal((await act(direct.id, "ship", false)).status, 409, "shipment cannot be repeated");
    const directEvents = await db.select({ status: schema.stockTransferEventsTable.status })
      .from(schema.stockTransferEventsTable)
      .where(eq(schema.stockTransferEventsTable.transferId, direct.id))
      .orderBy(schema.stockTransferEventsTable.createdAt, schema.stockTransferEventsTable.id);
    assert.deepEqual(directEvents.map((event) => event.status), ["requested", "prepared", "in_transit"]);
    const beforeDirectReceipt = await db.select({ storeId: schema.productsTable.storeId, stock: schema.productsTable.stock })
      .from(schema.productsTable).where(inArray(schema.productsTable.storeId, [sourceId, destinationId]));
    assert.equal(beforeDirectReceipt.find((product) => product.storeId === sourceId)!.stock, 18);
    assert.equal(beforeDirectReceipt.find((product) => product.storeId === destinationId)!.stock, 2);
    assert.equal((await act(direct.id, "receive", false)).status, 403, "source cannot confirm destination receipt");
    assert.equal((await act(direct.id, "receive", false, destinationId)).status, 200);
    const afterDirectReceipt = await db.select({ storeId: schema.productsTable.storeId, stock: schema.productsTable.stock })
      .from(schema.productsTable).where(inArray(schema.productsTable.storeId, [sourceId, destinationId]));
    assert.equal(afterDirectReceipt.find((product) => product.storeId === sourceId)!.stock, 16);
    assert.equal(afterDirectReceipt.find((product) => product.storeId === destinationId)!.stock, 4);

    // Legacy prepared rows remain actionable so deployments do not strand existing transfers.
    const [legacyPrepared] = await db.insert(schema.stockTransfersTable).values({
      sourceStoreId: sourceId,
      destinationStoreId: destinationId,
      initiatorUserId: ownerId,
      initiatorSide: "source",
      status: "prepared",
      preparedAt: new Date(),
      notes: "legacy fixture",
    }).returning();
    assert.equal((await act(legacyPrepared.id, "dispatch", false)).status, 200, "legacy prepared transfers can still ship");
    assert.equal((await act(legacyPrepared.id, "cancel", false)).status, 403, "employee cannot cancel after shipping");
    assert.equal((await act(legacyPrepared.id, "cancel", true)).status, 200, "company owner can cancel after shipping");

    const inbound = await create(false, "request", true);
    assert.equal(inbound.status, 201, "employee can initiate a pull request");
    const request = await inbound.json() as { id: number };
    assert.equal((await act(request.id, "prepare", true)).status, 409, "company owner cannot prepare a pending request before destination approval");
    assert.equal((await act(request.id, "cancel", true)).status, 200);
    await grant("create", false);
    assert.equal((await catalogue(destinationId)).status, 403, "revocation takes effect immediately");
    assert.equal((await create(false, "request")).status, 403);
    const unchanged = await db.select({ stock: schema.productsTable.stock })
      .from(schema.productsTable).where(eq(schema.productsTable.id, sourceProductId));
    assert.equal(unchanged[0]!.stock, 16, "only the received transfers change stock");
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    try {
      if (storeIds.length) {
        await db.delete(schema.stockTransfersTable).where(inArray(schema.stockTransfersTable.sourceStoreId, storeIds));
        await db.delete(schema.inventoryMovementsTable).where(inArray(schema.inventoryMovementsTable.storeId, storeIds));
        await db.delete(schema.productsTable).where(inArray(schema.productsTable.storeId, storeIds));
        await db.delete(schema.userStoresTable).where(inArray(schema.userStoresTable.storeId, storeIds));
      }
      if (userIds.length) {
        await db.delete(schema.userPermissionsTable).where(inArray(schema.userPermissionsTable.userId, userIds));
        await db.delete(schema.usersTable).where(inArray(schema.usersTable.id, userIds));
      }
      if (storeIds.length) await db.delete(schema.storesTable).where(inArray(schema.storesTable.id, storeIds));
    } finally {
      await pool.end();
    }
  }
});
