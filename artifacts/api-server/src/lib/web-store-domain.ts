const DEFAULT_ROOT_DOMAIN = "store.midanic.com";
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

export function getWebStoreRootDomain(): string {
  const configured = normalizeHostname(
    process.env["WEB_STORE_ROOT_DOMAIN"] ?? DEFAULT_ROOT_DOMAIN,
  );
  if (
    !configured ||
    configured.includes("://") ||
    configured.includes("/") ||
    !/^[a-z0-9.-]+$/.test(configured)
  ) {
    throw new Error("WEB_STORE_ROOT_DOMAIN must be a valid hostname");
  }
  return configured;
}

export function parseWebStoreSubdomain(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const subdomain = String(value).trim().toLowerCase();
  if (!subdomain) return null;
  if (
    subdomain.length > 63 ||
    !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(subdomain)
  ) {
    throw new Error(
      "Web Store subdomain must contain only lowercase letters, numbers, and internal hyphens",
    );
  }
  if (RESERVED_SUBDOMAINS.has(subdomain)) {
    throw new Error("This Web Store subdomain is reserved");
  }
  return subdomain;
}

export function buildWebStoreHostname(subdomain: string): string {
  return `${subdomain}.${getWebStoreRootDomain()}`;
}

export function normalizeWebStoreHostname(value: unknown): string | null {
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