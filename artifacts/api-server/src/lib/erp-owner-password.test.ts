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
import { generateAccessToken, hashPassword, comparePassword } from "./auth";

test("only a super admin can replace an ERP owner's Platform password", async () => {
  if (process.env.NODE_ENV === "production") throw new Error("Never run fixture tests in production");
  if (!process.env.DATABASE_URL) throw new Error("A development DATABASE_URL is required");

  const suffix = randomUUID();
  const oldPassword = `Old-${suffix}`;
  const newPassword = `New-${suffix}`;
  const [admin] = await db.insert(usersTable).values({
    email: `admin-${suffix}@example.test`, passwordHash: await hashPassword(oldPassword),
    firstName: "Fixture", lastName: "Admin", role: "super_admin",
  }).returning();
  const [owner] = await db.insert(usersTable).values({
    email: `owner-${suffix}@example.test`, passwordHash: await hashPassword(oldPassword),
    firstName: "Fixture", lastName: "Owner", role: "customer",
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
    let [record] = await db.select({ passwordHash: usersTable.passwordHash }).from(usersTable).where(eq(usersTable.id, owner.id));
    assert.ok(await comparePassword(oldPassword, record.passwordHash));

    assert.equal((await update(endpoint, superToken, newPassword)).status, 200);
    [record] = await db.select({ passwordHash: usersTable.passwordHash }).from(usersTable).where(eq(usersTable.id, owner.id));
    assert.ok(await comparePassword(newPassword, record.passwordHash));
    assert.equal(await comparePassword(oldPassword, record.passwordHash), false);
    assert.equal((await db.select().from(refreshTokensTable).where(eq(refreshTokensTable.userId, owner.id))).length, 0);
    assert.equal((await db.select().from(passwordResetTokensTable).where(eq(passwordResetTokensTable.userId, owner.id))).length, 0);

    const login = (password: string) => fetch(`${url}/api/auth/login`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: owner.email, password }),
    });
    assert.equal((await login(oldPassword)).status, 401);
    assert.equal((await login(newPassword)).status, 200);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await db.delete(erpTenantsTable).where(eq(erpTenantsTable.id, tenant.id));
    await db.delete(usersTable).where(eq(usersTable.id, owner.id));
    await db.delete(usersTable).where(eq(usersTable.id, admin.id));
    await pool.end();
  }
});
