import test from "node:test";
import assert from "node:assert/strict";
import {
  requireAdmin,
  requireStaff,
  requireTenantAdmin,
  type AuthRequest,
  type JwtPayload,
} from "./auth";
import type { Response } from "express";

function request(user: JwtPayload, isPlatformService = false): AuthRequest {
  return { user, isPlatformService } as AuthRequest;
}

function response() {
  let statusCode: number | undefined;
  let body: unknown;
  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(value: unknown) {
      body = value;
      return this;
    },
  } as unknown as Response;
  return {
    res,
    result: () => ({ statusCode, body }),
  };
}

const baseUser = {
  id: 1,
  email: "owner@example.test",
  currentStoreId: 10,
} as const;

test("tenant SSO admins cannot enter global-admin routes", () => {
  for (const role of ["tenant_admin", "admin"] as const) {
    const { res, result } = response();
    let nextCalled = false;
    requireAdmin(
      request({ ...baseUser, role, platformTenantId: 41 }),
      res,
      () => { nextCalled = true; },
    );
    assert.equal(nextCalled, false);
    assert.equal(result().statusCode, 403);
  }
});

test("tenant admins retain explicitly tenant-scoped admin and staff access", () => {
  const tenantUser = request({
    ...baseUser,
    role: "tenant_admin",
    platformTenantId: 41,
  });

  for (const middleware of [requireTenantAdmin, requireStaff]) {
    const { res } = response();
    let nextCalled = false;
    middleware(tenantUser, res, () => { nextCalled = true; });
    assert.equal(nextCalled, true);
  }
});

test("non-tenant admins and the Platform service retain global access", () => {
  const users: AuthRequest[] = [
    request({ ...baseUser, role: "admin" }),
    request({ ...baseUser, role: "admin", platformTenantId: 41 }, true),
  ];

  for (const req of users) {
    const { res } = response();
    let nextCalled = false;
    requireAdmin(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, true);
  }
});