/**
 * Headers shared by generated and manual Web Store API requests.
 *
 * An explicit store slug keeps a storefront scoped. When it is absent, the
 * browser hostname lets the ERP API choose the tenant's populated public
 * store when the Web Store and ERP API use different public origins.
 */
export function getExplicitStoreSlug(): string | null {
  try {
    const url = new URL(window.location.href);
    const fromQuery = url.searchParams.get("store");
    if (fromQuery) {
      localStorage.setItem("midanic_store_slug", fromQuery);
      return fromQuery;
    }

    const stored = localStorage.getItem("midanic_store_slug");
    if (stored && stored !== "principal") return stored;

    const configured = (import.meta.env.VITE_STORE_SLUG as string | undefined)?.trim();
    return configured || null;
  } catch {
    const configured = (import.meta.env.VITE_STORE_SLUG as string | undefined)?.trim();
    return configured || null;
  }
}

export function getStoreRequestHeaders(): Record<string, string> {
  try {
    const slug = getExplicitStoreSlug();
    return {
      ...(slug ? { "X-Store-Slug": slug } : {}),
      "X-Tenant-Hostname": window.location.hostname,
    };
  } catch {
    return {};
  }
}