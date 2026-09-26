import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { eq, inArray, sql } from "drizzle-orm";

const databaseUrl = process.env["ERP_TEST_DATABASE_URL"] ?? process.env["DATABASE_URL"];
const integrationTest = databaseUrl ? test : test.skip;

if (databaseUrl && !process.env["DATABASE_URL"]) {
  process.env["DATABASE_URL"] = databaseUrl;
}
process.env["NODE_ENV"] = "test";

const [{ default: app }, { db, pool, schema, runWithTenantDatabase }, { signToken }] = await Promise.all([
  import("../app"),
  import("./db"),
  import("./auth"),
]);

type Fixture = {
  ownerId: number;
  customerId: number;
  storeId: number;
  tenantId: number;
  hostname: string;
  activeStoreCount: number;
  staffCount: number;
  customerEmail: string;
  uploadedImageIds: number[];
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

function platformLookup(
  hostname: string,
  tenantId: number,
  limits: { maxStores: number | null; maxUsers: number | null; storageGb: number | null },
): () => void {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.includes("/api/internal/erp/domain/")) {
      return new Response(JSON.stringify({
        hostname,
        tenantId,
        ownerUserId: 7,
        status: "active",
        domainStatus: "active",
        databaseStatus: "ready",
        featureFlags: {},
        ...limits,
        canAccess: true,
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (url.includes("/api/internal/erp/database/")) {
      return new Response(JSON.stringify({
        tenantId,
        databaseName: `erp_tenant_${tenantId}`,
        databaseStatus: "ready",
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return originalFetch(input, init);
  };
  return () => { globalThis.fetch = originalFetch; };
}

function tenantHeaders(fixture: Fixture): Record<string, string> {
  const token = signToken({
    id: fixture.ownerId,
    email: `limits-owner-${fixture.tenantId}@example.test`,
    role: "tenant_admin",
    currentStoreId: fixture.storeId,
    platformUserId: 7,
    platformTenantId: fixture.tenantId,
    tenantHostname: fixture.hostname,
  });
  return {
    Authorization: `Bearer ${token}`,
    "X-Tenant-Hostname": fixture.hostname,
  };
}

async function seedFixture(): Promise<Fixture> {
  const suffix = randomUUID();
  const tenantId = 1;
  const hostname = `limits-${suffix}.midanic.com`;
  return await runWithTenantDatabase(
    { tenantId, databaseName: `erp_tenant_${tenantId}` },
    async () => {
      const customerEmail = `limits-customer-${suffix}@example.test`;
      const [owner] = await db.insert(schema.usersTable).values({
        name: `Limits Owner ${suffix}`,
        email: `limits-owner-${tenantId}-${suffix}@example.test`,
        passwordHash: "fixture-password-hash",
        role: "admin",
      }).returning({ id: schema.usersTable.id });
      const [store] = await db.insert(schema.storesTable).values({
        platformTenantId: tenantId,
        nameAr: `متجر حدود ${suffix}`,
        nameEn: `Limits Store ${suffix}`,
        slug: `limits-${suffix}`,
        isActive: true,
      }).returning({ id: schema.storesTable.id });
      await db.insert(schema.userStoresTable).values({ userId: owner.id, storeId: store.id });
      const [customer] = await db.insert(schema.usersTable).values({
        name: `Limits Customer ${suffix}`,
        email: customerEmail,
        passwordHash: "fixture-password-hash",
        role: "customer",
      }).returning({ id: schema.usersTable.id });
      const storeCount = await db.execute<{ count: string | number }>(
        sql`SELECT COUNT(*)::int AS count FROM stores WHERE is_active = TRUE`,
      );
      const staffCount = await db.execute<{ count: string | number }>(
        sql`SELECT COUNT(*)::int AS count
            FROM users
            WHERE role IN ('admin', 'employee')
              AND lower(trim(email)) <> 'admin@midanic.com'`,
      );
      return {
        ownerId: owner.id,
        customerId: customer.id,
        storeId: store.id,
        tenantId,
        hostname,
        activeStoreCount: Number(storeCount.rows[0]?.count ?? 0),
        staffCount: Number(staffCount.rows[0]?.count ?? 0),
        customerEmail,
        uploadedImageIds: [],
      };
    },
  );
}

async function cleanupFixture(fixture: Fixture): Promise<void> {
  await runWithTenantDatabase(
    { tenantId: fixture.tenantId, databaseName: `erp_tenant_${fixture.tenantId}` },
    async () => {
      await db.delete(schema.uploadedImagesTable).where(eq(schema.uploadedImagesTable.uploadedBy, fixture.ownerId));
      await db.delete(schema.employeesTable).where(eq(schema.employeesTable.userId, fixture.customerId));
      await db.delete(schema.employeesTable).where(eq(schema.employeesTable.userId, fixture.ownerId));
      await db.delete(schema.userStoresTable).where(eq(schema.userStoresTable.userId, fixture.ownerId));
      await db.delete(schema.userStoresTable).where(eq(schema.userStoresTable.storeId, fixture.storeId));
      await db.delete(schema.usersTable).where(inArray(schema.usersTable.id, [
        fixture.ownerId,
        fixture.customerId,
      ]));
      await db.delete(schema.storesTable).where(eq(schema.storesTable.id, fixture.storeId));
    },
  );
}

async function insertUploadedImage(fixture: Fixture, size: number): Promise<void> {
  await runWithTenantDatabase(
    { tenantId: fixture.tenantId, databaseName: `erp_tenant_${fixture.tenantId}` },
    async () => {
      const [image] = await db.insert(schema.uploadedImagesTable).values({
        objectPath: `/objects/uploads/fixture-${randomUUID()}`,
        publicUrl: "/api/uploads/fixture",
        contentType: "image/png",
        size,
        uploadedBy: fixture.ownerId,
      }).returning({ id: schema.uploadedImagesTable.id });
      fixture.uploadedImageIds.push(image.id);
    },
  );
}

function jsonHeaders(fixture: Fixture): Record<string, string> {
  return { ...tenantHeaders(fixture), "Content-Type": "application/json" };
}

integrationTest("maxStores blocks a new active store at the Platform limit", async () => {
  const previousSecret = process.env["PLATFORM_SERVICE_SECRET"];
  process.env["PLATFORM_SERVICE_SECRET"] = "customer-limits-test-secret";
  const fixture = await seedFixture();
  const restoreFetch = platformLookup(fixture.hostname, fixture.tenantId, {
    maxStores: fixture.activeStoreCount,
    maxUsers: null,
    storageGb: null,
  });
  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(`${baseUrl}/api/erp/stores`, {
      method: "POST",
      headers: jsonHeaders(fixture),
      body: JSON.stringify({
        nameAr: "متجر جديد",
        nameEn: "New Store",
        slug: `second-${randomUUID()}`,
      }),
    });
    const body = await jsonResponse(response);
    assert.equal(response.status, 409);
    assert.equal(body.code, "STORE_LIMIT_REACHED");
    assert.equal(body.maxStores, fixture.activeStoreCount);
    assert.equal(body.currentStores, fixture.activeStoreCount);
  } finally {
    await closeServer(server);
    restoreFetch();
    await cleanupFixture(fixture);
    if (previousSecret === undefined) delete process.env["PLATFORM_SERVICE_SECRET"];
    else process.env["PLATFORM_SERVICE_SECRET"] = previousSecret;
  }
});

integrationTest("maxUsers blocks staff and employee creation, including customer promotion", async () => {
  const previousSecret = process.env["PLATFORM_SERVICE_SECRET"];
  process.env["PLATFORM_SERVICE_SECRET"] = "customer-limits-test-secret";
  const fixture = await seedFixture();
  const restoreFetch = platformLookup(fixture.hostname, fixture.tenantId, {
    maxStores: null,
    maxUsers: fixture.staffCount,
    storageGb: null,
  });
  const { server, baseUrl } = await startServer();

  try {
    const staffResponse = await fetch(`${baseUrl}/api/erp/staff`, {
      method: "POST",
      headers: jsonHeaders(fixture),
      body: JSON.stringify({
        name: "Blocked Staff",
        email: `blocked-staff-${randomUUID()}@example.test`,
        password: "password123",
        role: "employee",
      }),
    });
    const staffBody = await jsonResponse(staffResponse);
    assert.equal(staffResponse.status, 409);
    assert.equal(staffBody.code, "USER_LIMIT_REACHED");
    assert.equal(staffBody.maxUsers, fixture.staffCount);
    assert.equal(staffBody.currentUsers, fixture.staffCount);

    const employeeResponse = await fetch(`${baseUrl}/api/erp/employees`, {
      method: "POST",
      headers: jsonHeaders(fixture),
      body: JSON.stringify({
        name: "Blocked Employee",
        email: `blocked-employee-${randomUUID()}@example.test`,
        position: "Sales",
        salary: 1000,
        hireDate: "2026-09-23",
      }),
    });
    const employeeBody = await jsonResponse(employeeResponse);
    assert.equal(employeeResponse.status, 409);
    assert.equal(employeeBody.code, "USER_LIMIT_REACHED");
    assert.equal(employeeBody.maxUsers, fixture.staffCount);
    assert.equal(employeeBody.currentUsers, fixture.staffCount);

    const promotionResponse = await fetch(`${baseUrl}/api/erp/employees`, {
      method: "POST",
      headers: jsonHeaders(fixture),
      body: JSON.stringify({
        name: "Promoted Customer",
        email: fixture.customerEmail,
        position: "Sales",
        salary: 1000,
        hireDate: "2026-09-23",
      }),
    });
    const promotionBody = await jsonResponse(promotionResponse);
    assert.equal(promotionResponse.status, 409);
    assert.equal(promotionBody.code, "USER_LIMIT_REACHED");
    assert.equal(promotionBody.maxUsers, fixture.staffCount);
    assert.equal(promotionBody.currentUsers, fixture.staffCount);

    const [customer] = await runWithTenantDatabase(
      { tenantId: fixture.tenantId, databaseName: `erp_tenant_${fixture.tenantId}` },
      () => db.select({ role: schema.usersTable.role })
        .from(schema.usersTable)
        .where(eq(schema.usersTable.id, fixture.customerId)),
    );
    assert.equal(customer?.role, "customer");
  } finally {
    await closeServer(server);
    restoreFetch();
    await cleanupFixture(fixture);
    if (previousSecret === undefined) delete process.env["PLATFORM_SERVICE_SECRET"];
    else process.env["PLATFORM_SERVICE_SECRET"] = previousSecret;
  }
});

integrationTest("storageGb blocks accumulated uploads and null leaves storage unlimited", async () => {
  const previousSecret = process.env["PLATFORM_SERVICE_SECRET"];
  const storagePath = await mkdtemp(path.join(os.tmpdir(), "erp-customer-limits-"));
  process.env["PLATFORM_SERVICE_SECRET"] = "customer-limits-test-secret";
  process.env["STORAGE_LOCAL_PATH"] = storagePath;
  const fixture = await seedFixture();
  const { server, baseUrl } = await startServer();
  let restoreFetch: (() => void) | undefined;

  try {
    const oneGb = 1024 ** 3;
    await insertUploadedImage(fixture, oneGb - 1);
    restoreFetch = platformLookup(fixture.hostname, fixture.tenantId, {
      maxStores: null,
      maxUsers: null,
      storageGb: 1,
    });
    const blockedForm = new FormData();
    blockedForm.append("file", new Blob([new Uint8Array([1, 2])], { type: "image/png" }), "blocked.png");
    const blockedResponse = await fetch(`${baseUrl}/api/uploads`, {
      method: "POST",
      headers: tenantHeaders(fixture),
      body: blockedForm,
    });
    const blockedBody = await jsonResponse(blockedResponse);
    assert.equal(blockedResponse.status, 409);
    assert.equal(blockedBody.code, "STORAGE_LIMIT_REACHED");
    assert.equal(blockedBody.storageGb, 1);
    assert.equal(blockedBody.usedBytes, String(oneGb - 1));
    assert.equal(blockedBody.requestedBytes, 2);
    restoreFetch();

    // Domain entitlements are cached briefly in production. Use a second
    // hostname so this request proves null is read as unlimited rather than
    // reusing the previous 1 GB entitlement.
    fixture.hostname = `${fixture.hostname}-unlimited`;
    restoreFetch = platformLookup(fixture.hostname, fixture.tenantId, {
      maxStores: null,
      maxUsers: null,
      storageGb: null,
    });
    const unlimitedForm = new FormData();
    unlimitedForm.append("file", new Blob([new Uint8Array([3, 4])], { type: "image/png" }), "unlimited.png");
    const unlimitedResponse = await fetch(`${baseUrl}/api/uploads`, {
      method: "POST",
      headers: tenantHeaders(fixture),
      body: unlimitedForm,
    });
    const unlimitedBody = await jsonResponse(unlimitedResponse);
    assert.equal(unlimitedResponse.status, 201);
    assert.equal(unlimitedBody.size, 2);
    assert.equal(typeof unlimitedBody.url, "string");
    restoreFetch();
  } finally {
    await closeServer(server);
    restoreFetch?.();
    await cleanupFixture(fixture);
    await rm(storagePath, { recursive: true, force: true });
    if (previousSecret === undefined) delete process.env["PLATFORM_SERVICE_SECRET"];
    else process.env["PLATFORM_SERVICE_SECRET"] = previousSecret;
    delete process.env["STORAGE_LOCAL_PATH"];
  }
});

test.after(async () => {
  await pool.end();
});