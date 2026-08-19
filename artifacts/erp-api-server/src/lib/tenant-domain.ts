export type TenantDomainRequest = {
  headers: Record<string, string | string[] | undefined>;
  header?: (name: string) => string | undefined;
};

export type PlatformTenantDomain = {
  hostname: string;
  tenantId: number;
  ownerUserId: number;
  status: string;
  domainStatus: string;
  canAccess: boolean;
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
  const raw = req.headers[name.toLowerCase()];
  return Array.isArray(raw) ? raw[0] : raw;
}

export function getRequestTenantHostname(req: TenantDomainRequest): string | null {
  if (process.env["NODE_ENV"] !== "production") {
    const developmentOverride = normalizeTenantHostname(requestHeader(req, "X-Tenant-Hostname"));
    if (developmentOverride) return developmentOverride;
    const originHostname = hostnameFromOrigin(requestHeader(req, "Origin"));
    if (originHostname) return originHostname;
  }

  const hostHostname = normalizeTenantHostname(requestHeader(req, "Host"));
  if (hostHostname) return hostHostname;
  if (process.env["TRUST_PROXY"] === "1") {
    const forwardedHostname = normalizeTenantHostname(requestHeader(req, "X-Forwarded-Host"));
    if (forwardedHostname) return forwardedHostname;
  }
  return null;
}

export function tenantStoreMatches(
  expectedTenantId: number | undefined,
  storeTenantId: number | null,
): boolean {
  return expectedTenantId === undefined || expectedTenantId === storeTenantId;
}

export function isConfiguredTenantHostname(hostname: string | null): boolean {
  if (!hostname) return false;
  const rootDomain = normalizeTenantHostname(
    process.env["ERP_TENANT_ROOT_DOMAIN"] ?? "midanic.com",
  );
  return Boolean(rootDomain) && hostname.endsWith(`.${rootDomain}`);
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
  const secret = process.env["PLATFORM_SERVICE_SECRET"] ?? process.env["PLATFORM_SSO_SECRET"];
  if (!baseUrl || !secret) {
    if (process.env["NODE_ENV"] === "production") return null;
    return null;
  }

  try {
    const response = await fetch(
      `${baseUrl}/api/internal/erp/domain/${encodeURIComponent(normalized)}`,
      { headers: { "X-Platform-Service-Secret": secret } },
    );
    if (!response.ok) return null;
    const value = await response.json() as PlatformTenantDomain;
    if (
      value.hostname !== normalized ||
      !Number.isInteger(value.tenantId) ||
      !Number.isInteger(value.ownerUserId)
    ) {
      return null;
    }
    domainCache.set(normalized, { expiresAt: now + 5_000, value });
    return value;
  } catch {
    return null;
  }
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
    Boolean(process.env["PLATFORM_SERVICE_SECRET"] ?? process.env["PLATFORM_SSO_SECRET"]);

  if (process.env["NODE_ENV"] !== "production" && !platformConfigured) {
    return actualHostname === expectedHostname ||
      actualHostname === "localhost" ||
      actualHostname?.endsWith(".replit.dev") === true;
  }
  if (actualHostname !== expectedHostname) return false;

  const domain = await resolvePlatformTenantDomain(expectedHostname);
  return domain?.canAccess === true &&
    domain.tenantId === expected.tenantId &&
    domain.ownerUserId === expected.ownerUserId &&
    domain.hostname === expectedHostname;
}