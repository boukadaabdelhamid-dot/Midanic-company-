import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  db,
  pool,
  usersTable,
  erpTenantsTable,
  refreshTokensTable,
  passwordResetTokensTable,
} from "@workspace/db";
import app from "../app";
import { generateAccessToken, generateErpSsoToken, hashPassword, comparePassword } from "./auth";
import jwt from "jsonwebtoken";

test("only a super admin can replace an ERP owner's Platform password", async () => {
  if (process.env.NODE_ENV === "production") throw new Error("Never run fixture tests in production");
  if (!process.env.DATABASE_URL) throw new Error("A development DATABASE_URL is required");

  const suffix = randomUUID();
  const oldPassword = `Old-${suffix}`;
  const newPassword = `New-${suffix}`;
  const failedDeliveryPassword = `FailedDelivery-${suffix}`;
  const [admin] = await db.insert(usersTable).values({
    email: `admin-${suffix}@example.test`, passwordHash: await hashPassword(oldPassword),
    firstName: "Fixture", lastName: "Admin", role: "super_admin",
  }).returning();
  const [owner] = await db.insert(usersTable).values({
    email: `owner-${suffix}@example.test`, passwordHash: await hashPassword(oldPassword),
    firstName: "Fixture", lastName: "Owner", role: "customer",
  }).returning();
  const [otherCustomer] = await db.insert(usersTable).values({
    email: `other-${suffix}@example.test`, passwordHash: await hashPassword(oldPassword),
    firstName: "Fixture", lastName: "Other", role: "customer",
  }).returning();
  const [tenant] = await db.insert(erpTenantsTable).values({
    ownerUserId: owner.id, companyName: `fixture-${suffix}`,
  }).returning();
  const resetToken = randomUUID();
  const refreshToken = randomUUID();
  await db.insert(passwordResetTokensTable).values({
    userId: owner.id, token: resetToken, expiresAt: new Date(Date.now() + 3600_000),
  });
  await db.insert(refreshTokensTable).values({
    userId: owner.id, token: refreshToken, expiresAt: new Date(Date.now() + 3600_000),
  });

  const originalFetch = globalThis.fetch;
  const originalResendApiKey = process.env.RESEND_API_KEY;
  const sentEmails: Array<{ url: string; payload: Record<string, unknown> }> = [];
  let failNextDelivery = false;
  process.env.RESEND_API_KEY = "test-resend-api-key";
  globalThis.fetch = async (input, init) => {
    if (String(input) !== "https://api.resend.com/emails") {
      return originalFetch(input, init);
    }
    sentEmails.push({
      url: String(input),
      payload: JSON.parse(String(init?.body)) as Record<string, unknown>,
    });
    if (failNextDelivery) {
      failNextDelivery = false;
      return new Response(JSON.stringify({ message: "simulated provider failure" }), { status: 503 });
    }
    return new Response(null, { status: 202 });
  };

  const server = app.listen(0);
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const url = `http://localhost:${address.port}`;
    const endpoint = `/api/admin/erp/tenants/${tenant.id}/owner-password`;
    const superToken = generateAccessToken({ userId: admin.id, email: admin.email, role: admin.role });
    const customerToken = generateAccessToken({ userId: owner.id, email: owner.email, role: owner.role });
    const update = (path: string, token: string | null, password: string) =>
      fetch(`${url}${path}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ newPassword: password }),
      });

    assert.equal((await update(endpoint, null, newPassword)).status, 401);
    assert.equal((await update(endpoint, customerToken, newPassword)).status, 403);
    assert.equal((await update(endpoint, superToken, "short")).status, 400);
    assert.equal((await update(endpoint, superToken, "x".repeat(129))).status, 400);
    assert.equal((await update("/api/admin/erp/tenants/0/owner-password", superToken, newPassword)).status, 400);
    assert.equal((await update("/api/admin/erp/tenants/999999999/owner-password", superToken, newPassword)).status, 404);
    const oldSso = jwt.decode(await generateErpSsoToken({
      userId: owner.id, email: owner.email, role: owner.role, tenantId: tenant.id, hostname: "fixture.midanic.com",
    })) as { platformSessionVersion: number };
    let [record] = await db.select({
      passwordHash: usersTable.passwordHash, version: usersTable.erpSessionVersion,
    }).from(usersTable).where(eq(usersTable.id, owner.id));
    const versionBefore = record.version;
    assert.ok(await comparePassword(oldPassword, record.passwordHash));

    assert.equal((await update(endpoint, superToken, newPassword)).status, 200);
    [record] = await db.select({
      passwordHash: usersTable.passwordHash, version: usersTable.erpSessionVersion,
    }).from(usersTable).where(eq(usersTable.id, owner.id));
    assert.equal(record.version, versionBefore + 1);
    const newSso = jwt.decode(await generateErpSsoToken({
      userId: owner.id, email: owner.email, role: owner.role, tenantId: tenant.id, hostname: "fixture.midanic.com",
    })) as { platformSessionVersion: number };
    assert.equal(oldSso.platformSessionVersion, versionBefore);
    assert.equal(newSso.platformSessionVersion, record.version);
    const [unchangedAdmin] = await db.select({ version: usersTable.erpSessionVersion })
      .from(usersTable).where(eq(usersTable.id, admin.id));
    assert.equal(unchangedAdmin.version, 0);
    assert.ok(await comparePassword(newPassword, record.passwordHash));
    assert.equal(await comparePassword(oldPassword, record.passwordHash), false);
    assert.equal((await db.select().from(refreshTokensTable).where(eq(refreshTokensTable.userId, owner.id))).length, 0);
    assert.equal((await db.select().from(passwordResetTokensTable).where(eq(passwordResetTokensTable.userId, owner.id))).length, 0);
    assert.equal(sentEmails.length, 1);
    assert.equal(sentEmails[0].url, "https://api.resend.com/emails");
    assert.deepEqual(sentEmails[0].payload.to, [owner.email]);
    assert.equal(JSON.stringify(sentEmails[0].payload).includes(newPassword), false);

    failNextDelivery = true;
    assert.equal((await update(endpoint, superToken, failedDeliveryPassword)).status, 200);
    [record] = await db.select({ passwordHash: usersTable.passwordHash, version: usersTable.erpSessionVersion }).from(usersTable).where(eq(usersTable.id, owner.id));
    assert.ok(await comparePassword(failedDeliveryPassword, record.passwordHash));
    assert.equal(sentEmails.length, 2);
    assert.deepEqual(sentEmails[1].payload.to, [owner.email]);
    assert.equal(JSON.stringify(sentEmails[1].payload).includes(failedDeliveryPassword), false);

    const login = (password: string) => originalFetch(`${url}/api/auth/login`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: owner.email, password }),
    });
    assert.equal((await login(oldPassword)).status, 401);
    assert.equal((await login(newPassword)).status, 401);
    assert.equal((await login(failedDeliveryPassword)).status, 200);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalResendApiKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = originalResendApiKey;
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await db.delete(erpTenantsTable).where(eq(erpTenantsTable.id, tenant.id));
    await db.delete(usersTable).where(eq(usersTable.id, owner.id));
    await db.delete(usersTable).where(eq(usersTable.id, otherCustomer.id));
    await db.delete(usersTable).where(eq(usersTable.id, admin.id));
    await pool.end();
  }
});
