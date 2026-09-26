import test from "node:test";
import assert from "node:assert/strict";
import {
  enforcePlatformAccess,
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

test("authenticated tenant context carries all Platform customer limits", async () => {
  const previous = {
    nodeEnv: process.env["NODE_ENV"],
    platformApiUrl: process.env["PLATFORM_API_URL"],
    platformSecret: process.env["PLATFORM_SERVICE_SECRET"],
  };
  const originalFetch = globalThis.fetch;
  const hostname = "limits-context-test.midanic.com";

  process.env["NODE_ENV"] = "test";
  process.env["PLATFORM_API_URL"] = "https://platform.example";
  process.env["PLATFORM_SERVICE_SECRET"] = "test-service-secret";
  globalThis.fetch = async () => new Response(JSON.stringify({
    hostname,
    tenantId: 41,
    ownerUserId: 7,
    status: "active",
    domainStatus: "active",
    databaseStatus: "ready",
    featureFlags: { products: true },
    maxStores: 3,
    maxUsers: 12,
    storageGb: 25,
    canAccess: true,
  }), { status: 200, headers: { "Content-Type": "application/json" } });

  try {
    const req = request({
      ...baseUser,
      role: "tenant_admin",
      platformUserId: 7,
      platformTenantId: 41,
      tenantHostname: hostname,
    });
    req.headers = { "x-tenant-hostname": hostname };
    req.header = ((name: string) =>
      req.headers[name.toLowerCase()] as string | undefined) as AuthRequest["header"];

    assert.equal(await enforcePlatformAccess(req, req.user!), true);
    assert.deepEqual(req.tenantFeatures, {
      products: true,
      maxStores: 3,
      maxUsers: 12,
      storageGb: 25,
    });
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries({
      NODE_ENV: previous.nodeEnv,
      PLATFORM_API_URL: previous.platformApiUrl,
      PLATFORM_SERVICE_SECRET: previous.platformSecret,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});