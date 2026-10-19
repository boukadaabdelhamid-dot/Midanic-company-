import type { Request, Response, NextFunction } from "express";
import { runWithTenantDatabase } from "./db";
import { getRequestTenantHostname, isConfiguredTenantHostname, resolvePlatformTenantDatabase, resolvePlatformTenantDomain } from "./tenant-domain";

export interface PasswordResetRequest extends Request {
  passwordResetBaseUrl?: string;
}

/** Anonymous reset requests must resolve the company before looking up users
 * or tokens. A reset link must return to that same validated company domain. */
export async function passwordResetContext(req: PasswordResetRequest, res: Response, next: NextFunction) {
  try {
    const hostname = getRequestTenantHostname(req);
    if (!isConfiguredTenantHostname(hostname)) {
      if (process.env.NODE_ENV === "production") {
        res.status(403).json({ error: "Use your company domain", code: "TENANT_DOMAIN_REQUIRED" });
        return;
      }
      req.passwordResetBaseUrl = (process.env.WEB_STORE_URL || process.env.FRONTEND_URL || process.env.APP_URL || "").replace(/\/+$/, "");
      next();
      return;
    }
    const domain = await resolvePlatformTenantDomain(hostname!);
    if (domain?.canAccess !== true) {
      res.status(403).json({ error: "Company domain unavailable", code: "TENANT_DOMAIN_INACTIVE" });
      return;
    }
    const tenant = await resolvePlatformTenantDatabase(domain.tenantId);
    if (tenant?.databaseStatus !== "ready" || !tenant.databaseName) {
      res.status(503).json({ error: "Company database unavailable", code: "TENANT_DATABASE_UNAVAILABLE" });
      return;
    }
    req.passwordResetBaseUrl = `https://${domain.hostname}`;
    await runWithTenantDatabase(
      { tenantId: domain.tenantId, databaseName: tenant.databaseName }, () => next(),
    );
  } catch {
    res.status(503).json({ error: "Password reset service unavailable" });
  }
}
