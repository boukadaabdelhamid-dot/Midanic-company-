/**
 * Returns the API base URL for Web Store fetch calls.
 *
 * In dev Vite serves the store under BASE_PATH (e.g. "/store"), so a bare
 * /api/* request escapes the Vite proxy and hits Replit's path router →
 * Platform API (8080) instead of ERP API (8082).
 *
 * Using BASE_PATH as prefix makes every request go to /store/api/*,
 * which the Vite proxy rewrites to /api/* and forwards to 8082.
 *
 * Company storefronts use the matching company ERP origin directly:
 *   acme.store.midanic.com -> acme.midanic.com
 * This guarantees the Web Store reads the same API and database as ERP.
 */
export function getCompanyErpOrigin(): string | null {
  if (typeof window === "undefined") return null;
  const hostname = window.location.hostname.toLowerCase();
  const suffix = ".store.midanic.com";
  if (!hostname.endsWith(suffix)) return null;

  const companyLabel = hostname.slice(0, -suffix.length);
  if (!companyLabel || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(companyLabel)) {
    return null;
  }
  return `https://${companyLabel}.midanic.com`;
}

export function getApiBase(): string {
  const companyErpOrigin = getCompanyErpOrigin();
  if (companyErpOrigin) return companyErpOrigin;

  const explicit = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
  if (explicit) return explicit.replace(/\/+$/, "");
  return ((import.meta.env.BASE_URL as string | undefined) ?? "").replace(/\/+$/, "");
}
