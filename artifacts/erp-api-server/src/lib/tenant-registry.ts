import { isTenantDatabaseName } from "./db";

export type RegisteredTenantDatabase = {
  tenantId: number;
  databaseName: string;
};

function platformApiUrl(): string | null {
  const configured = process.env["PLATFORM_API_URL"];
  return configured ? configured.replace(/\/+$/, "") : null;
}

function serviceSecret(): string | null {
  return process.env["PLATFORM_SERVICE_SECRET"] ??
    process.env["PLATFORM_SSO_SECRET"] ??
    process.env["SESSION_SECRET"] ??
    null;
}

export async function listReadyTenantDatabases(): Promise<RegisteredTenantDatabase[]> {
  const baseUrl = platformApiUrl();
  const secret = serviceSecret();
  if (!baseUrl || !secret) {
    if (process.env["NODE_ENV"] === "production") {
      throw new Error("Platform tenant database registry is not configured");
    }
    return [];
  }

  const response = await fetch(`${baseUrl}/api/internal/erp/databases`, {
    headers: { "X-Platform-Service-Secret": secret },
  });
  if (!response.ok) {
    throw new Error(`Platform tenant database registry failed (${response.status})`);
  }

  const body = await response.json() as { tenants?: unknown };
  if (!Array.isArray(body.tenants)) {
    throw new Error("Platform tenant database registry returned an invalid response");
  }

  return body.tenants.map((value) => {
    const tenant = value as Partial<RegisteredTenantDatabase>;
    if (!Number.isInteger(tenant.tenantId) || Number(tenant.tenantId) <= 0 ||
        !isTenantDatabaseName(tenant.databaseName) ||
        tenant.databaseName !== `erp_tenant_${tenant.tenantId}`) {
      throw new Error("Platform tenant database registry returned an invalid tenant");
    }
    return {
      tenantId: Number(tenant.tenantId),
      databaseName: tenant.databaseName,
    };
  });
}