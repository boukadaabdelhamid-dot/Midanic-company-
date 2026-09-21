/**
 * Headers shared by generated and manual Web Store API requests.
 *
 * The store slug keeps local development scoped, while the browser hostname
 * lets the ERP API resolve the company tenant when the Web Store and ERP API
 * use different public origins.
 */
export function getStoreRequestHeaders(): Record<string, string> {
  try {
    const url = new URL(window.location.href);
    const fromQuery = url.searchParams.get("store");
    if (fromQuery) {
      localStorage.setItem("midanic_store_slug", fromQuery);
    }
    const slug =
      fromQuery ||
      localStorage.getItem("midanic_store_slug") ||
      (import.meta.env.VITE_STORE_SLUG as string | undefined) ||
      "principal";
    return {
      "X-Store-Slug": slug,
      "X-Tenant-Hostname": window.location.hostname,
    };
  } catch {
    return {};
  }
}