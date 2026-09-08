import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { and, eq, inArray } from "drizzle-orm";

const databaseUrl = process.env["ERP_TEST_DATABASE_URL"] ?? process.env["DATABASE_URL"];
const integrationTest = databaseUrl ? test : test.skip;

if (databaseUrl && !process.env["DATABASE_URL"]) {
  process.env["DATABASE_URL"] = databaseUrl;
}
process.env["NODE_ENV"] = "test";

const [{ default: app }, { db, pool, schema }, { signToken }] = await Promise.all([
  import("../app"),
  import("./db"),
  import("./auth"),
]);

type Fixture = {
  staffId: number;
  customerAId: number;
  customerBId: number;
  storeAId: number;
  storeBId: number;
  classificationAId: number;
  classificationBId: number;
  priceTierAId: number;
  priceTierBId: number;
};

function startServer(): Promise<{ server: Server; baseUrl: string }> {
  return new Promise((resolve, reject) => {
    const server = createServer(app);
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Test server did not expose a TCP address"));
        return;
      }
      resolve({ server, baseUrl: `http://127.0.0.1:${address.port}` });
    });
  });
}

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

async function jsonResponse(response: Response): Promise<Record<string, any>> {
  const contentType = response.headers.get("content-type") ?? "";
  assert.match(contentType, /^application\/json\b/, `expected JSON response, got ${contentType}`);
  return await response.json() as Record<string, any>;
}

function serviceHeaders(staffId: number, storeId: number): Record<string, string> {
  return {
    "X-Platform-Service-Secret": "erp-customer-isolation-test-secret",
    "X-Platform-User-Id": String(staffId),
    "X-Store-Id": String(storeId),
  };
}

async function seedFixture(): Promise<Fixture> {
  const suffix = randomUUID();
  const passwordHash = "fixture-password-hash";

  const [storeA] = await db.insert(schema.storesTable).values({
    nameAr: `اختبار أ ${suffix}`,
    nameEn: `Isolation Store A ${suffix}`,
    slug: `isolation-a-${suffix}`,
    isActive: true,
  }).returning({ id: schema.storesTable.id });
  const [storeB] = await db.insert(schema.storesTable).values({
    nameAr: `اختبار ب ${suffix}`,
    nameEn: `Isolation Store B ${suffix}`,
    slug: `isolation-b-${suffix}`,
    isActive: true,
  }).returning({ id: schema.storesTable.id });

  const [staff] = await db.insert(schema.usersTable).values({
    name: `Isolation Staff ${suffix}`,
    email: `isolation-staff-${suffix}@example.test`,
    passwordHash,
    role: "admin",
    preferredLang: "ar",
  }).returning({ id: schema.usersTable.id });
  await db.insert(schema.userStoresTable).values([
    { userId: staff.id, storeId: storeA.id },
    { userId: staff.id, storeId: storeB.id },
  ]);

  const [customerA] = await db.insert(schema.usersTable).values({
    name: `Customer A ${suffix}`,
    email: `isolation-customer-a-${suffix}@example.test`,
    passwordHash,
    role: "customer",
    preferredLang: "ar",
    phone: "0600000001",
    address: "Address A",
    city: "Store A City",
    notes: "User-level note A",
  }).returning({ id: schema.usersTable.id });
  const [customerB] = await db.insert(schema.usersTable).values({
    name: `Customer B ${suffix}`,
    email: `isolation-customer-b-${suffix}@example.test`,
    passwordHash,
    role: "customer",
    preferredLang: "ar",
    phone: "0600000002",
    address: "Address B",
    city: "Store B City",
    notes: "User-level note B",
  }).returning({ id: schema.usersTable.id });

  const [classificationA] = await db.insert(schema.customerClassificationsTable).values({
    labelFr: `Classe A ${suffix}`,
    labelAr: `تصنيف أ ${suffix}`,
    color: "#AA0001",
    sortOrder: 1,
  }).returning({ id: schema.customerClassificationsTable.id });
  const [classificationB] = await db.insert(schema.customerClassificationsTable).values({
    labelFr: `Classe B ${suffix}`,
    labelAr: `تصنيف ب ${suffix}`,
    color: "#BB0002",
    sortOrder: 2,
  }).returning({ id: schema.customerClassificationsTable.id });
  const [priceTierA] = await db.insert(schema.priceTiersTable).values({
    labelFr: `Tarif A ${suffix}`,
    labelAr: `تعرفة أ ${suffix}`,
    code: `ISOLATION_A_${suffix.replaceAll("-", "").slice(0, 18)}`,
    sortOrder: 1,
  }).returning({ id: schema.priceTiersTable.id });
  const [priceTierB] = await db.insert(schema.priceTiersTable).values({
    labelFr: `Tarif B ${suffix}`,
    labelAr: `تعرفة ب ${suffix}`,
    code: `ISOLATION_B_${suffix.replaceAll("-", "").slice(0, 18)}`,
    sortOrder: 2,
  }).returning({ id: schema.priceTiersTable.id });

  const [contactA] = await db.insert(schema.contactsTable).values({
    storeId: storeA.id,
    name: `Customer A ${suffix}`,
    email: `isolation-customer-a-${suffix}@example.test`,
    phone: "0600000001",
    address: "Address A",
    notes: "Contact note A",
    contactType: "customer",
    currentBalance: "111.11",
  }).returning({ id: schema.contactsTable.id });
  const [contactB] = await db.insert(schema.contactsTable).values({
    storeId: storeB.id,
    name: `Customer B ${suffix}`,
    email: `isolation-customer-b-${suffix}@example.test`,
    phone: "0600000002",
    address: "Address B",
    notes: "Contact note B",
    contactType: "customer",
    currentBalance: "222.22",
  }).returning({ id: schema.contactsTable.id });

  await db.insert(schema.customerProfilesTable).values([
    {
      userId: customerA.id,
      storeId: storeA.id,
      contactType: "customer",
      wilaya: "Adrar A",
      commune: "Commune A",
      gps: "27.87,-0.28",
      classificationId: classificationA.id,
      priceTierId: priceTierA.id,
      accountNumber: `ACC-A-${suffix}`,
      creditLimit: "1000.00",
      minBalanceAlert: "50.00",
      currentBalance: "111.11",
      foreignCurrency: false,
      rc: "RC-A",
      nif: "NIF-A",
      ai: "AI-A",
      nis: "NIS-A",
      contactId: contactA.id,
    },
    {
      userId: customerB.id,
      storeId: storeB.id,
      contactType: "customer",
      wilaya: "Blida B",
      commune: "Commune B",
      gps: "36.47,2.83",
      classificationId: classificationB.id,
      priceTierId: priceTierB.id,
      accountNumber: `ACC-B-${suffix}`,
      creditLimit: "2000.00",
      minBalanceAlert: "75.00",
      currentBalance: "222.22",
      foreignCurrency: true,
      rc: "RC-B",
      nif: "NIF-B",
      ai: "AI-B",
      nis: "NIS-B",
      contactId: contactB.id,
    },
  ]);

  await db.insert(schema.ordersTable).values([
    {
      storeId: storeA.id,
      userId: customerA.id,
      customerName: `Customer A ${suffix}`,
      customerPhone: "0600000001",
      customerAddress: "Address A",
      status: "delivered",
      totalAmount: "101.01",
      discountAmount: "1.01",
      orderSource: "pos",
      paymentMethod: "comptant",
    },
    {
      storeId: storeB.id,
      userId: customerB.id,
      customerName: `Customer B ${suffix}`,
      customerPhone: "0600000002",
      customerAddress: "Address B",
      status: "delivered",
      totalAmount: "202.02",
      discountAmount: "2.02",
      orderSource: "pos",
      paymentMethod: "a_terme",
    },
  ]);
  await db.insert(schema.customerNotesTable).values([
    { storeId: storeA.id, userId: customerA.id, note: "Store A private note" },
    { storeId: storeB.id, userId: customerB.id, note: "Store B private note" },
  ]);

  return {
    staffId: staff.id,
    customerAId: customerA.id,
    customerBId: customerB.id,
    storeAId: storeA.id,
    storeBId: storeB.id,
    classificationAId: classificationA.id,
    classificationBId: classificationB.id,
    priceTierAId: priceTierA.id,
    priceTierBId: priceTierB.id,
  };
}

async function cleanupFixture(fixture: Fixture): Promise<void> {
  await db.delete(schema.customerNotesTable).where(inArray(schema.customerNotesTable.userId, [
    fixture.customerAId,
    fixture.customerBId,
  ]));
  await db.delete(schema.ordersTable).where(inArray(schema.ordersTable.userId, [
    fixture.customerAId,
    fixture.customerBId,
  ]));
  await db.delete(schema.customerProfilesTable).where(inArray(schema.customerProfilesTable.userId, [
    fixture.customerAId,
    fixture.customerBId,
  ]));
  await db.delete(schema.contactsTable).where(inArray(schema.contactsTable.storeId, [
    fixture.storeAId,
    fixture.storeBId,
  ]));
  await db.delete(schema.userStoresTable).where(eq(schema.userStoresTable.userId, fixture.staffId));
  await db.delete(schema.usersTable).where(inArray(schema.usersTable.id, [
    fixture.staffId,
    fixture.customerAId,
    fixture.customerBId,
  ]));
  await db.delete(schema.customerClassificationsTable).where(inArray(schema.customerClassificationsTable.id, [
    fixture.classificationAId,
    fixture.classificationBId,
  ]));
  await db.delete(schema.priceTiersTable).where(inArray(schema.priceTiersTable.id, [
    fixture.priceTierAId,
    fixture.priceTierBId,
  ]));
  await db.delete(schema.storesTable).where(inArray(schema.storesTable.id, [
    fixture.storeAId,
    fixture.storeBId,
  ]));
}

integrationTest("ERP customer details stay isolated across stores", async () => {
  const previousServiceSecret = process.env["PLATFORM_SERVICE_SECRET"];
  process.env["PLATFORM_SERVICE_SECRET"] = "erp-customer-isolation-test-secret";
  const fixture = await seedFixture();
  const { server, baseUrl } = await startServer();

  try {
    const noAuth = await fetch(`${baseUrl}/api/erp/customers/${fixture.customerAId}`);
    const noAuthBody = await jsonResponse(noAuth);
    assert.equal(noAuth.status, 401);
    assert.equal(noAuthBody.error, "Unauthorized");

    const customerToken = signToken({
      id: fixture.customerAId,
      email: `isolation-customer-a-${fixture.customerAId}@example.test`,
      role: "customer",
      currentStoreId: fixture.storeAId,
    });
    const forbidden = await fetch(`${baseUrl}/api/erp/customers/${fixture.customerAId}`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    const forbiddenBody = await jsonResponse(forbidden);
    assert.equal(forbidden.status, 403);
    assert.equal(forbiddenBody.error, "Forbidden");

    const storeAHeaders = serviceHeaders(fixture.staffId, fixture.storeAId);
    const storeBHeaders = serviceHeaders(fixture.staffId, fixture.storeBId);
    const [storeAListResponse, storeBListResponse] = await Promise.all([
      fetch(`${baseUrl}/api/erp/customers`, { headers: storeAHeaders }),
      fetch(`${baseUrl}/api/erp/customers`, { headers: storeBHeaders }),
    ]);
    const storeAList = await jsonResponse(storeAListResponse);
    const storeBList = await jsonResponse(storeBListResponse);
    assert.equal(storeAListResponse.status, 200);
    assert.equal(storeBListResponse.status, 200);
    assert.deepEqual(storeAList.data.map((customer: { id: number }) => customer.id), [fixture.customerAId]);
    assert.deepEqual(storeBList.data.map((customer: { id: number }) => customer.id), [fixture.customerBId]);

    const storeAResponse = await fetch(`${baseUrl}/api/erp/customers/${fixture.customerAId}`, {
      headers: storeAHeaders,
    });
    const storeA = await jsonResponse(storeAResponse);
    assert.equal(storeAResponse.status, 200);
    assert.equal(storeA.profile.currentBalance, 111.11);
    assert.equal(storeA.profile.classification.id, fixture.classificationAId);
    assert.equal(storeA.profile.priceTier.id, fixture.priceTierAId);
    assert.equal(storeA.profile.accountNumber.startsWith("ACC-A-"), true);
    assert.deepEqual(storeA.orders.map((order: { totalAmount: string }) => order.totalAmount), ["101.01"]);
    assert.deepEqual(storeA.notes.map((note: { note: string }) => note.note), ["Store A private note"]);
    assert.equal(storeA.orders.some((order: { totalAmount: string }) => order.totalAmount === "202.02"), false);
    assert.equal(storeA.notes.some((note: { note: string }) => note.note === "Store B private note"), false);

    const storeBResponse = await fetch(`${baseUrl}/api/erp/customers/${fixture.customerBId}`, {
      headers: storeBHeaders,
    });
    const storeB = await jsonResponse(storeBResponse);
    assert.equal(storeBResponse.status, 200);
    assert.equal(storeB.profile.currentBalance, 222.22);
    assert.equal(storeB.profile.classification.id, fixture.classificationBId);
    assert.equal(storeB.profile.priceTier.id, fixture.priceTierBId);
    assert.equal(storeB.profile.accountNumber.startsWith("ACC-B-"), true);
    assert.deepEqual(storeB.orders.map((order: { totalAmount: string }) => order.totalAmount), ["202.02"]);
    assert.deepEqual(storeB.notes.map((note: { note: string }) => note.note), ["Store B private note"]);
    assert.equal(storeB.orders.some((order: { totalAmount: string }) => order.totalAmount === "101.01"), false);
    assert.equal(storeB.notes.some((note: { note: string }) => note.note === "Store A private note"), false);

    const crossStoreResponse = await fetch(`${baseUrl}/api/erp/customers/${fixture.customerAId}`, {
      headers: storeBHeaders,
    });
    const crossStoreBody = await jsonResponse(crossStoreResponse);
    assert.equal(crossStoreResponse.status, 404);
    assert.equal(crossStoreBody.error, "Customer not found");
  } finally {
    await closeServer(server);
    await cleanupFixture(fixture);
    if (previousServiceSecret === undefined) delete process.env["PLATFORM_SERVICE_SECRET"];
    else process.env["PLATFORM_SERVICE_SECRET"] = previousServiceSecret;
  }
});

test.after(async () => {
  await pool.end();
});