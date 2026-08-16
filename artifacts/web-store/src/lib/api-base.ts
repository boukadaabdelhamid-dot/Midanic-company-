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
 * In production VITE_API_URL is set explicitly.
 */
export function getApiBase(): string {
  const explicit = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
  if (explicit) return explicit.replace(/\/+$/, "");
  return ((import.meta.env.BASE_URL as string | undefined) ?? "").replace(/\/+$/, "");
}
