export function getCompanySiteCount(
  sites: readonly { id: number; isActive: boolean }[] | undefined,
): number | null {
  if (!sites) return null;
  return new Set(sites.filter((site) => site.isActive).map((site) => site.id)).size;
}
