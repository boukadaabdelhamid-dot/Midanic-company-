/**
 * Returns the API base URL for ERP fetch calls.
 *
 * In development Vite serves the app under BASE_URL (e.g. "/erp"), so
 * relative /api/* requests escape the Vite proxy and hit Replit's path
 * router → Platform API (8080) instead of ERP API (8082).
 *
 * Using BASE_URL as the prefix makes every request go to /erp/api/*,
 * which the Vite proxy rewrites to /api/* and forwards to 8082.
 *
 * In production VITE_API_URL is set explicitly to the ERP API origin.
 */
export function getApiBase(): string {
  const explicit = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
  if (explicit) return explicit.replace(/\/+$/, "");
  // Vite's BASE_URL is "/erp/" in dev — strip trailing slash.
  return ((import.meta.env.BASE_URL as string | undefined) ?? "").replace(/\/+$/, "");
}
