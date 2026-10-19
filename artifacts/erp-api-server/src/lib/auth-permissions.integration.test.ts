import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { createServer } from "node:http";
import express from "express";
import bcrypt from "bcryptjs";
import { eq, inArray } from "drizzle-orm";
import { db, schema, pool } from "./db";
import { verifyToken } from "./auth";
import { ensureOwnerStores } from "./owner-stores";
import authRouter from "../routes/auth";
import erpRouter from "../routes/erp";

test("login, two-store access, password authority, reset and current permissions", async () => {
  const suffix = randomUUID();
  const password = "Fixture-Local-Password-2026!";
  const platformPassword = "Fixture-Platform-Password-2026!";
  const nextPassword = "Fixture-Next-Password-2026!";
  const userIds: number[] = [];
  const storeIds: number[] = [];
  const previousUrl = process.env.PLATFORM_API_URL;
  const previousSecret = process.env.PLATFORM_SERVICE_SECRET;
  const originalFetch = globalThis.fetch;
  const platformId = 987654321;
  let platformHash = await bcrypt.hash(platformPassword, 4);
  let platformVersion = 3;
  let platformWrites = 0;
  let ownerEmail = "";
  process.env.PLATFORM_API_URL = "https://platform-auth-fixture.example";
  process.env.PLATFORM_SERVICE_SECRET = "synthetic-auth-fixture";
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.startsWith("https://platform-auth-fixture.example/")) {
      if (url.endsWith(`/credentials/${platformId}/password`)) {
        platformHash = await bcrypt.hash(JSON.parse(String(init?.body)).newPassword, 4);
        platformVersion++;
        platformWrites++;
        return Response.json({ success: true });
      }
      if (url.endsWith(`/credentials/${platformId}`)) {
        return Response.json({
          id: platformId, email: ownerEmail, passwordHash: platformHash, erpSessionVersion: platformVersion,
          firstName: "Fixture", lastName: "Owner", isActive: true, role: "customer",
        });
      }
      return Response.json({ error: "Unknown fixture company" }, { status: 404 });
    }
    return originalFetch(input, init);
  };
  const app = express();
  let lastError = "";
  app.use(express.json());
  app.use((req, _res, next) => {
    req.log = {
      error(error: { cause?: { message?: string }; message?: string }) {
        lastError = error?.cause?.message ?? error?.message ?? "Request failed";
      },
      warn() {}, info() {},
    } as unknown as typeof req.log;
    next();
  });
  app.use(authRouter);
  app.use(erpRouter);
  const server = createServer(app);
  try {
    const hash = await bcrypt.hash(password, 4);
    async function makeUser(kind: string, role: "admin" | "employee", linked = false) {
      const [user] = await db.insert(schema.usersTable).values({
        name: `Auth Fixture ${kind}`, email: `auth-${kind}-${suffix}@example.test`,
        passwordHash: hash, role, ...(linked ? { platformUserId: platformId } : {}),
      }).returning();
      userIds.push(user.id);
      return user;
    }
    const admin = await makeUser("admin", "admin");
    const employee = await makeUser("employee", "employee");
    const owner = await makeUser("owner", "admin", true);
    ownerEmail = owner.email;
    // A unique logical tenant in the shared test DB cannot modify any real
    // company store or trigger the dedicated-DB legacy reconciliation.
    const tenantId = owner.id + 100000000;
    for (let i = 0; i < 3; i++) {
      const [store] = await db.insert(schema.storesTable).values({
        platformTenantId: tenantId, slug: `auth-fixture-${i}-${suffix}`,
        nameAr: `متجر اختبار ${i}`, nameEn: `Auth Fixture ${i}`, isActive: i < 2,
      }).returning();
      storeIds.push(store.id);
    }
    await db.insert(schema.userStoresTable).values(
      [admin.id, employee.id].flatMap(userId => storeIds.slice(0, 2).map(storeId => ({ userId, storeId }))),
    );
    const ownerStores = await ensureOwnerStores(owner.id, tenantId);
    assert.deepEqual(ownerStores.map(store => store.id), storeIds.slice(0, 2));
    assert.deepEqual((await ensureOwnerStores(owner.id, tenantId)).map(store => store.id), storeIds.slice(0, 2));

    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const origin = `http://127.0.0.1:${address.port}`;
    const request = (path: string, method = "GET", body?: unknown, token?: string) =>
      originalFetch(`${origin}${path}`, {
        method,
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    async function login(email: string, pwd: string) {
      const response = await request("/auth/login", "POST", { email, password: pwd });
      assert.equal(response.status, 200);
      return await response.json() as { token: string; stores: Array<{ id: number }>; currentStoreId: number | null };
    }
    const adminLogin = await login(admin.email, password);
    assert.equal(adminLogin.currentStoreId, null);
    assert.deepEqual(adminLogin.stores.map(store => store.id), storeIds.slice(0, 2));
    const select = await request("/auth/select-store", "POST", { storeId: storeIds[1] }, adminLogin.token);
    assert.equal(select.status, 200);
    const selected = await select.json() as { token: string };
    assert.equal(verifyToken(selected.token).credentialSource, "local");
    assert.equal(verifyToken(selected.token).userSessionVersion, 0);
    assert.equal((await request("/auth/me", "GET", undefined, selected.token)).status, 200);

    const employeeLogin = await login(employee.email, password);
    assert.equal((await request("/erp/staff", "GET", undefined, employeeLogin.token)).status, 403);
    assert.equal((await request(`/erp/staff/${employee.id}/role`, "PUT", { role: "admin" }, selected.token)).status, 200);
    assert.equal((await request("/auth/me", "GET", undefined, employeeLogin.token)).status, 401);
    const promoted = await login(employee.email, password);
    assert.equal((await request("/erp/staff", "GET", undefined, promoted.token)).status, 200, lastError);
    assert.equal((await request(`/erp/staff/${employee.id}/role`, "PUT", { role: "employee" }, selected.token)).status, 200);
    assert.equal((await request("/erp/staff", "GET", undefined, promoted.token)).status, 401);

    const permissions = [{ section: "reports", action: "view", granted: true }];
    assert.equal((await request(`/erp/permissions/${employee.id}`, "PUT", permissions, selected.token)).status, 200);
    const activeEmployee = await login(employee.email, password);
    const employeeSelect = await request("/auth/select-store", "POST", { storeId: storeIds[0] }, activeEmployee.token);
    let employeeToken = ((await employeeSelect.json()) as { token: string }).token;
    const granted = await request("/erp/permissions/me", "GET", undefined, employeeToken);
    assert.equal(granted.status, 200);
    assert.ok(((await granted.json()) as Array<{ section: string; granted: boolean }>).some(row => row.section === "reports" && row.granted));
    assert.equal((await request(`/erp/staff/${employee.id}/stores`, "PUT", { storeIds: [storeIds[1]] }, selected.token)).status, 200);
    assert.equal((await request("/auth/me", "GET", undefined, employeeToken)).status, 401);
    const reassignedEmployee = await login(employee.email, password);
    assert.deepEqual(reassignedEmployee.stores.map(store => store.id), [storeIds[1]]);
    employeeToken = reassignedEmployee.token;
    assert.equal((await request("/auth/me", "GET", undefined, employeeToken)).status, 200);
    assert.equal((await request(`/erp/permissions/${employee.id}`, "PUT", [{ ...permissions[0], granted: "false" }], selected.token)).status, 400);
    assert.equal((await request(`/erp/staff/${employee.id}/password`, "PUT", { password: nextPassword }, selected.token)).status, 200);
    assert.equal((await request("/auth/me", "GET", undefined, employeeToken)).status, 401);
    assert.equal((await request("/auth/login", "POST", { email: employee.email, password })).status, 401);
    const newEmployee = await login(employee.email, nextPassword);
    await db.update(schema.usersTable).set({ isActive: false }).where(eq(schema.usersTable.id, employee.id));
    assert.equal((await request("/auth/me", "GET", undefined, newEmployee.token)).status, 401);

    // The deliberately stale local owner hash must never authorize a password
    // change or a login when Platform owns the credentials.
    assert.equal((await request("/auth/login", "POST", { email: owner.email, password })).status, 401);
    const ownerLogin = await login(owner.email, platformPassword);
    // Reintroduce a stale mirror to test password-change authority independently.
    await db.update(schema.usersTable).set({ passwordHash: hash }).where(eq(schema.usersTable.id, owner.id));
    assert.equal((await request("/auth/me/password", "PUT", { currentPassword: password, newPassword: nextPassword }, ownerLogin.token)).status, 400);
    assert.equal(platformWrites, 0);
    assert.equal((await request("/auth/me/password", "PUT", { currentPassword: platformPassword, newPassword: nextPassword }, ownerLogin.token)).status, 200);
    assert.equal(platformWrites, 1);
    assert.equal((await request("/auth/me", "GET", undefined, ownerLogin.token)).status, 401);
    await login(owner.email, nextPassword);

    for (const account of [admin, owner]) {
      const rawToken = randomBytes(32).toString("hex");
      await db.insert(schema.passwordResetTokensTable).values({
        userId: account.id, token: createHash("sha256").update(rawToken).digest("hex"),
        expiresAt: new Date(Date.now() + 60_000),
      });
      assert.equal((await request(`/auth/reset-password/${rawToken}`)).status, 200);
      assert.equal((await request(`/auth/reset-password/${rawToken}`, "POST", { password: platformPassword })).status, 200);
      assert.equal((await request(`/auth/reset-password/${rawToken}`, "POST", { password: nextPassword })).status, 400);
      await login(account.email, platformPassword);
    }
    assert.equal(platformWrites, 2, "a linked owner's reset must change the Platform password");
    assert.equal((await request("/auth/me", "GET", undefined, selected.token)).status, 401);
    assert.equal((await request("/auth/login", "POST", { email: admin.email, password })).status, 401);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousUrl === undefined) delete process.env.PLATFORM_API_URL; else process.env.PLATFORM_API_URL = previousUrl;
    if (previousSecret === undefined) delete process.env.PLATFORM_SERVICE_SECRET; else process.env.PLATFORM_SERVICE_SECRET = previousSecret;
    await new Promise<void>(resolve => server.close(() => resolve()));
    if (userIds.length) {
      await db.delete(schema.passwordResetTokensTable).where(inArray(schema.passwordResetTokensTable.userId, userIds));
      await db.delete(schema.userPermissionsTable).where(inArray(schema.userPermissionsTable.userId, userIds));
      await db.delete(schema.userStoresTable).where(inArray(schema.userStoresTable.userId, userIds));
      await db.delete(schema.usersTable).where(inArray(schema.usersTable.id, userIds));
    }
    if (storeIds.length) await db.delete(schema.storesTable).where(inArray(schema.storesTable.id, storeIds));
    await pool.end();
  }
});
