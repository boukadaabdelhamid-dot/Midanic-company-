import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { once } from "node:events";
import { WebSocket } from "ws";
import { randomUUID } from "node:crypto";
import { authenticate, optionalAuth, optionalTenantAuth, optionalAuthStrict, isOwnerSessionCurrent, signToken, type JwtPayload } from "./auth";
import productsRouter from "../routes/products";
import { setupWebSocket, broadcastToUsers } from "./ws";
import { pool } from "./db";

test("password rotation revokes only the owner's HTTP and open WebSocket sessions", async () => {
  const previousUrl = process.env.PLATFORM_API_URL;
  const previousSecret = process.env.PLATFORM_SERVICE_SECRET;
  const fixtureSecret = "owner-session-revocation-fixture";
  const versions = new Map([[701, 0], [702, 0]]);
  const suffix = randomUUID().replaceAll("-", "");
  const hostname = `session-${suffix}.midanic.com`;
  const platform = express();
  platform.use((req, res, next) => {
    if (req.header("X-Platform-Service-Secret") !== fixtureSecret) {
      res.sendStatus(401);
      return;
    }
    next();
  });
  platform.get("/api/internal/erp/domain/:hostname", (req, res) => {
    const second = String(req.params.hostname).startsWith("other-");
    const sameOwnerCompany = String(req.params.hostname).startsWith("second-");
    res.json({
      hostname: req.params.hostname, tenantId: second ? 702 : sameOwnerCompany ? 703 : 701, ownerUserId: second ? 702 : 701,
      status: "active", domainStatus: "active", databaseStatus: "ready", canAccess: true,
    });
  });
  platform.get("/api/internal/erp/database/:id", (req, res) => {
    const id = Number(req.params.id);
    // A second company belonging to owner 701 shares their session generation.
    const owner = id === 703 ? 701 : id;
    res.json({
      tenantId: id, databaseName: `erp_tenant_${id}`, databaseStatus: "ready",
      dataImportStatus: "not_requested", ownerUserId: owner, ownerSessionVersion: versions.get(owner),
    });
  });
  const platformServer = createServer(platform);
  const app = express();
  app.get("/session", authenticate, (_req, res) => { res.json({ ok: true }); });
  app.get("/optional", optionalAuth, (_req, res) => { res.json({ ok: true }); });
  app.get("/optional-tenant", optionalTenantAuth, (_req, res) => { res.json({ ok: true }); });
  app.get("/optional-strict", optionalAuthStrict, (_req, res) => { res.json({ ok: true }); });
  app.use(productsRouter);
  const erpServer = createServer(app);
  const wss = setupWebSocket(erpServer);
  const sockets: WebSocket[] = [];
  try {
    await new Promise<void>((resolve) => platformServer.listen(0, "127.0.0.1", resolve));
    const platformAddress = platformServer.address();
    assert.ok(platformAddress && typeof platformAddress !== "string");
    process.env.PLATFORM_API_URL = `http://127.0.0.1:${platformAddress.port}`;
    process.env.PLATFORM_SERVICE_SECRET = fixtureSecret;
    await new Promise<void>((resolve) => erpServer.listen(0, "127.0.0.1", resolve));
    const erpAddress = erpServer.address();
    assert.ok(erpAddress && typeof erpAddress !== "string");
    const origin = `http://127.0.0.1:${erpAddress.port}`;
    const owner: JwtPayload = {
      id: 91001, email: "owner@example.test", role: "tenant_admin",
      platformUserId: 701, platformTenantId: 701, tenantHostname: hostname,
    };
    const employee = { ...owner, id: 91002, role: "employee" as const };
    const otherOwner = {
      ...owner, id: 91003, platformUserId: 702, platformTenantId: 702, tenantHostname: `other-${hostname}`,
    };
    const oldOwnerToken = signToken(owner); // Legacy sessions have no version claim.
    const secondCompanyToken = signToken({ ...owner, platformTenantId: 703, tenantHostname: `second-${hostname}` });
    const employeeToken = signToken(employee);
    const otherToken = signToken(otherOwner);
    const request = (token: string, host = hostname) => fetch(`${origin}/session`, {
      headers: { Authorization: `Bearer ${token}`, "X-Tenant-Hostname": host },
    });
    assert.equal((await request(oldOwnerToken)).status, 200);
    assert.equal((await request(secondCompanyToken, `second-${hostname}`)).status, 200);
    assert.equal((await request(employeeToken)).status, 200);
    assert.equal((await request(otherToken, otherOwner.tenantHostname)).status, 200);
    const optionalRequest = (path: string, token?: string) => fetch(`${origin}${path}`, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), "X-Tenant-Hostname": hostname },
    });
    for (const path of ["/optional", "/optional-tenant", "/optional-strict"]) {
      assert.equal((await optionalRequest(path)).status, 200);
      assert.equal((await optionalRequest(path, oldOwnerToken)).status, 200);
      assert.equal((await optionalRequest(path, "invalid-token")).status, 401);
    }

    const connect = async (token: string, host: string) => {
      const ws = new WebSocket(`${origin.replace("http:", "ws:")}/ws?token=${token}`, {
        headers: { "X-Tenant-Hostname": host },
      });
      sockets.push(ws);
      await once(ws, "open");
      await once(ws, "message");
      return ws;
    };
    const ownerSocket = await connect(oldOwnerToken, hostname);
    const employeeSocket = await connect(employeeToken, hostname);
    const otherSocket = await connect(otherToken, otherOwner.tenantHostname);
    versions.set(701, 1);

    const revoked = await request(oldOwnerToken);
    assert.equal(revoked.status, 401);
    assert.equal(((await revoked.json()) as { code: string }).code, "SESSION_REVOKED");
    assert.equal((await request(secondCompanyToken, `second-${hostname}`)).status, 401);
    assert.equal((await request(employeeToken)).status, 200);
    assert.equal((await request(otherToken, otherOwner.tenantHostname)).status, 200);
    assert.equal((await request(signToken({ ...owner, platformSessionVersion: 1 }))).status, 200);
    for (const path of ["/optional", "/optional-tenant", "/optional-strict", "/products?filterExposed=false", "/products/999999999", "/categories"]) {
      const response = await optionalRequest(path, oldOwnerToken);
      assert.equal(response.status, 401, `revoked owner must be denied on ${path}`);
      assert.equal(((await response.json()) as { code: string }).code, "SESSION_REVOKED");
    }
    assert.equal(isOwnerSessionCurrent({ ...owner, platformTenantId: 703 }, {
      ownerUserId: 701, ownerSessionVersion: 1,
    }), false);
    assert.equal(isOwnerSessionCurrent({ ...owner, platformSessionVersion: 1 }, {
      ownerUserId: 999, ownerSessionVersion: 1,
    }), false);
    assert.equal(isOwnerSessionCurrent(owner, { ownerUserId: 701 }), false);

    const close = once(ownerSocket, "close");
    const employeeMessage = once(employeeSocket, "message");
    const otherMessage = once(otherSocket, "message");
    broadcastToUsers([owner.id, employee.id, otherOwner.id], { type: "fixture-after-reset" });
    assert.equal((await close)[0], 4001);
    assert.equal(JSON.parse(String((await employeeMessage)[0])).type, "fixture-after-reset");
    assert.equal(JSON.parse(String((await otherMessage)[0])).type, "fixture-after-reset");
    assert.equal(employeeSocket.readyState, WebSocket.OPEN);
    assert.equal(otherSocket.readyState, WebSocket.OPEN);

    versions.set(701, 2);
    assert.equal((await request(signToken({ ...owner, platformSessionVersion: 1 }))).status, 401);
    assert.equal((await request(signToken({ ...owner, platformSessionVersion: 2 }))).status, 200);
  } finally {
    for (const ws of sockets) ws.terminate();
    wss.close();
    await new Promise<void>((resolve) => erpServer.close(() => resolve()));
    await new Promise<void>((resolve) => platformServer.close(() => resolve()));
    if (previousUrl === undefined) delete process.env.PLATFORM_API_URL;
    else process.env.PLATFORM_API_URL = previousUrl;
    if (previousSecret === undefined) delete process.env.PLATFORM_SERVICE_SECRET;
    else process.env.PLATFORM_SERVICE_SECRET = previousSecret;
    await pool.end();
  }
});
