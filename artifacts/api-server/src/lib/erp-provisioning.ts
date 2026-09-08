import { getTenantDatabaseName } from "./erp-tenant-database";

type ProvisionResponse = {
  tenantId: number;
  databaseName: string;
  databaseStatus: "ready";
};

export type TenantDatabaseHealth = {
  tenantId: number;
  databaseName: string;
  healthy: boolean;
  schemaReady: boolean;
};

function getServiceSecret(): string {
  const secret = process.env["PLATFORM_SERVICE_SECRET"] ??
    process.env["PLATFORM_SSO_SECRET"] ??
    process.env["SESSION_SECRET"];
  if (!secret) throw new Error("Platform service secret is not configured");
  return secret;
}

function getErpApiUrl(): string {
  const configuredUrl = process.env["ERP_API_URL"];
  const baseUrl = (configuredUrl ??
    (process.env["NODE_ENV"] === "production" ? "" : "http://127.0.0.1:8082"))
    .replace(/\/+$/, "");
  if (!baseUrl) throw new Error("ERP_API_URL is required for tenant provisioning");
  return baseUrl;
}

export async function provisionErpTenantDatabase(tenantId: number): Promise<ProvisionResponse> {
  const databaseName = getTenantDatabaseName(tenantId);
  const response = await fetch(`${getErpApiUrl()}/api/internal/erp/provision`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Platform-Service-Secret": getServiceSecret(),
    },
    body: JSON.stringify({ tenantId, databaseName }),
  });

  const body = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok || body.databaseStatus !== "ready") {
    const message = typeof body.error === "string"
      ? body.error
      : `ERP provisioning failed with status ${response.status}`;
    throw new Error(message);
  }

  return {
    tenantId,
    databaseName,
    databaseStatus: "ready",
  };
}

export async function checkErpTenantDatabaseHealth(
  tenantId: number,
): Promise<TenantDatabaseHealth> {
  const response = await fetch(`${getErpApiUrl()}/api/internal/erp/health/${tenantId}`, {
    headers: { "X-Platform-Service-Secret": getServiceSecret() },
  });
  const body = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(
      typeof body.error === "string"
        ? body.error
        : `ERP database health check failed with status ${response.status}`,
    );
  }
  return {
    tenantId,
    databaseName: String(body.databaseName ?? ""),
    healthy: body.healthy === true,
    schemaReady: body.schemaReady === true,
  };
}