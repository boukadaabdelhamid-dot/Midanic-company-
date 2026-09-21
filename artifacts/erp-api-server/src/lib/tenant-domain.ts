export type TenantDomainRequest = {
  headers: Record<string, string | string[] | undefined>;
  header?: (name: string) => string | undefined;
};

export type PlatformTenantDomain = {
  hostname: string;
  webStoreHostname?: string | null;
  tenantId: number;
  ownerUserId: number;
  status: string;
  domainStatus: string;
  databaseStatus: string;
  canAccess: boolean;
};

export type PlatformTenantDatabase = {
  tenantId: number;
  databaseName: string | null;
  databaseStatus: string;
};

const domainCache = new Map<string, { expiresAt: number; value: PlatformTenantDomain }>();

export function normalizeTenantHostname(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const first = value.split(",", 1)[0]?.trim().toLowerCase().replace(/\.$/, "") ?? "";
  const hostname = first.replace(/:\d+$/, "");
  if (!hostname || !/^[a-z0-9.-]+$/.test(hostname)) return null;
  return hostname;
}

function hostnameFromOrigin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const origin = new URL(value);
    if (origin.protocol !== "https:" && origin.protocol !== "http:") return null;
    return normalizeTenantHostname(origin.hostname);
  } catch {
    return null;
  }
}

function requestHeader(req: TenantDomainRequest, name: string): string | undefined {
  const fromExpress = req.header?.(name);
  if (fromExpress) return fromExpress;
  const raw = req.headers?.[name.toLowerCase()];
  return Array.isArray(raw) ? raw[0] : raw;
}

export function getRequestTenantHostname(req: TenantDomainRequest): string | null {
  if (process.env["NODE_ENV"] !== "production") {
    const developmentOverride = normalizeTenantHostname(requestHeader(req, "X-Tenant-Hostname"));
    if (developmentOverride) return developmentOverride;
    const originHostname = hostnameFromOrigin(requestHeader(req, "Origin"));
    if (originHostname) return originHostname;
  }

  if (process.env["TRUST_PROXY"] === "1") {
    const forwardedHostname = normalizeTenantHostname(requestHeader(req, "X-Forwarded-Host"));
    if (forwardedHostname) return forwardedHostname;
  }
  const hostHostname = normalizeTenantHostname(requestHeader(req, "Host"));
  const originHostname = hostnameFromOrigin(requestHeader(req, "Origin"));

  // The Web Store is often deployed on a separate public origin from the
  // ERP API. In that case Host is the shared API hostname while Origin is the
  // company's Web Store hostname. Prefer the origin only when the request
  // host is not already a trusted company hostname.
  if (
    originHostname &&
    isConfiguredTenantHostname(originHostname) &&
    !isConfiguredTenantHostname(hostHostname)
  ) {
    return originHostname;
  }
  return hostHostname ?? originHostname;
}

export function tenantStoreMatches(
  expectedTenantId: number | undefined,
  storeTenantId: number | null,
): boolean {
  return expectedTenantId === undefined || expectedTenantId === storeTenantId;
}

export function isConfiguredTenantHostname(hostname: string | null): boolean {
  if (!hostname) return false;
  const roots = [
    process.env["ERP_TENANT_ROOT_DOMAIN"] ?? "midanic.com",
    process.env["WEB_STORE_ROOT_DOMAIN"] ?? "store.midanic.com",
  ]
    .map(normalizeTenantHostname)
    .filter((root): root is string => Boolean(root));
  return roots.some((root) => hostname.endsWith(`.${root}`));
}

export async function resolvePlatformTenantDomain(
  hostname: string,
): Promise<PlatformTenantDomain | null> {
  const normalized = normalizeTenantHostname(hostname);
  if (!normalized) return null;
  const now = Date.now();
  const cached = domainCache.get(normalized);
  if (cached && cached.expiresAt > now) return cached.value;

  const baseUrl = process.env["PLATFORM_API_URL"]?.replace(/\/+$/, "");
  const secret = process.env["PLATFORM_SERVICE_SECRET"] ??
    process.env["PLATFORM_SSO_SECRET"] ??
    process.env["SESSION_SECRET"];
  if (!baseUrl || !secret) {
    if (process.env["NODE_ENV"] === "production") return null;
    return null;
  }

  try {
    const response = await fetch(
      `${baseUrl}/api/internal/erp/domain/${encodeURIComponent(normalized)}`,
      { headers: { "X-Platform-Service-Secret": secret } },
    );
    if (!response.ok) {
      console.warn("[tenant-domain] Platform domain lookup failed", {
        hostname: normalized,
        statusCode: response.status,
      });
      return null;
    }
    const value = await response.json() as PlatformTenantDomain;
    if (
      value.hostname !== normalized &&
      value.webStoreHostname !== normalized ||
      !Number.isInteger(value.tenantId) ||
      !Number.isInteger(value.ownerUserId)
    ) {
      return null;
    }
    if (value.canAccess !== true) {
      console.warn("[tenant-domain] Platform rejected tenant domain access", {
        hostname: normalized,
        tenantId: value.tenantId,
        status: value.status,
        domainStatus: value.domainStatus,
        databaseStatus: value.databaseStatus,
      });
    }
    domainCache.set(normalized, { expiresAt: now + 5_000, value });
    return value;
  } catch {
    return null;
  }
}

export async function resolvePlatformTenantDatabase(
  tenantId: number,
): Promise<PlatformTenantDatabase | null> {
  if (!Number.isInteger(tenantId) || tenantId <= 0) return null;
  const baseUrl = process.env["PLATFORM_API_URL"]?.replace(/\/+$/, "");
  const secret = process.env["PLATFORM_SERVICE_SECRET"] ??
    process.env["PLATFORM_SSO_SECRET"] ??
    process.env["SESSION_SECRET"];
  if (!baseUrl || !secret) {
    if (process.env["NODE_ENV"] !== "production") return null;
    throw new Error("Tenant database registry is not configured");
  }

  const response = await fetch(
    `${baseUrl}/api/internal/erp/database/${tenantId}`,
    { headers: { "X-Platform-Service-Secret": secret } },
  );
  if (!response.ok) {
    throw new Error(`Tenant database registry lookup failed (${response.status})`);
  }
  const value = await response.json() as PlatformTenantDatabase;
  if (value.tenantId !== tenantId || typeof value.databaseStatus !== "string") {
    throw new Error("Tenant database registry returned an invalid response");
  }
  if (value.databaseName !== null && !/^erp_tenant_[1-9][0-9]*$/.test(value.databaseName)) {
    throw new Error("Tenant database registry returned an invalid database name");
  }
  return value;
}

export async function verifyTenantDomainRequest(
  req: TenantDomainRequest,
  expected: { hostname: string; tenantId: number; ownerUserId: number },
): Promise<boolean> {
  const expectedHostname = normalizeTenantHostname(expected.hostname);
  if (!expectedHostname) return false;

  const actualHostname = getRequestTenantHostname(req);
  const platformConfigured =
    Boolean(process.env["PLATFORM_API_URL"]) &&
    Boolean(
      process.env["PLATFORM_SERVICE_SECRET"] ??
      process.env["PLATFORM_SSO_SECRET"] ??
      process.env["SESSION_SECRET"],
    );

  const isDevelopmentPreview =
    process.env["NODE_ENV"] !== "production" &&
    (actualHostname === "localhost" ||
      actualHostname === "127.0.0.1" ||
      actualHostname?.endsWith(".replit.dev") === true);
  if (isDevelopmentPreview && !platformConfigured) {
    return true;
  }
  if (isDevelopmentPreview && platformConfigured) {
    const domain = await resolvePlatformTenantDomain(expectedHostname);
    return domain?.canAccess === true &&
      domain.tenantId === expected.tenantId &&
      domain.ownerUserId === expected.ownerUserId &&
      domain.hostname === expectedHostname;
  }
  if (actualHostname !== expectedHostname) return false;

  const domain = await resolvePlatformTenantDomain(expectedHostname);
  return domain?.canAccess === true &&
    domain.tenantId === expected.tenantId &&
    domain.ownerUserId === expected.ownerUserId &&
    domain.hostname === expectedHostname;
}