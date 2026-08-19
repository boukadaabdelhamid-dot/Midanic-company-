const DEFAULT_ROOT_DOMAIN = "midanic.com";
const RESERVED_SUBDOMAINS = new Set([
  "admin",
  "api",
  "app",
  "erp",
  "ftp",
  "mail",
  "platform",
  "smtp",
  "store",
  "www",
]);

function normalizeHostname(value: string): string {
  return value.trim().toLowerCase().replace(/\.$/, "");
}

export function getErpTenantRootDomain(): string {
  const configured = normalizeHostname(
    process.env["ERP_TENANT_ROOT_DOMAIN"] ?? DEFAULT_ROOT_DOMAIN,
  );
  if (
    !configured ||
    configured.includes("://") ||
    configured.includes("/") ||
    !/^[a-z0-9.-]+$/.test(configured)
  ) {
    throw new Error("ERP_TENANT_ROOT_DOMAIN must be a valid hostname");
  }
  return configured;
}

export function parseErpSubdomain(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const subdomain = String(value).trim().toLowerCase();
  if (!subdomain) return null;
  if (
    subdomain.length > 63 ||
    !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(subdomain)
  ) {
    throw new Error(
      "Subdomain must contain only lowercase letters, numbers, and internal hyphens",
    );
  }
  if (RESERVED_SUBDOMAINS.has(subdomain)) {
    throw new Error("This subdomain is reserved");
  }
  return subdomain;
}

export function buildErpTenantHostname(subdomain: string): string {
  return `${subdomain}.${getErpTenantRootDomain()}`;
}

export function buildErpTenantLaunchUrl(hostname: string, token?: string): string {
  const baseUrl = `https://${normalizeHostname(hostname)}`;
  return token
    ? `${baseUrl}/sso?token=${encodeURIComponent(token)}`
    : `${baseUrl}/`;
}

export function normalizeErpHostname(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = normalizeHostname(value);
  if (
    !normalized ||
    normalized.includes("://") ||
    normalized.includes("/") ||
    normalized.includes(":") ||
    !/^[a-z0-9.-]+$/.test(normalized)
  ) {
    return null;
  }
  return normalized;
}