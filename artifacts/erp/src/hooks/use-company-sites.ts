import { useQuery } from "@tanstack/react-query";
import { useGetErpStoresMine, getGetErpStoresMineQueryKey } from "@workspace/erp-api-client-react";
import { useAuth } from "./use-auth";
import { useMe } from "./use-me";
import { useStoreContext } from "./use-store";
import { getApiBase } from "@/lib/api-base";
import { getCompanySiteCount } from "@/lib/company-sites";

type CompanySite = { id: number; isActive: boolean };

export function useCompanySites() {
  const { token } = useAuth();
  const { user, isStaff, isLoading, features } = useMe();
  const { currentStoreId } = useStoreContext();
  const enabled = !!token && isStaff;
  // /mine can provision an enabled factory for its owner. Wait for that before
  // counting /all, but never use personal memberships as the company count.
  const mine = useGetErpStoresMine({ query: { enabled, queryKey: getGetErpStoresMineQueryKey() } });
  const all = useQuery({
    queryKey: ["company-sites", user?.id, currentStoreId, features.manufacturing === true],
    queryFn: async ({ signal }): Promise<CompanySite[]> => {
      const response = await fetch(`${getApiBase()}/api/erp/stores/all`, {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      });
      if (!response.ok) throw new Error("Could not load company sites");
      const data: unknown = await response.json();
      if (!Array.isArray(data) || data.some((site) =>
        !site || !Number.isInteger(site.id) || typeof site.isActive !== "boolean"
      )) throw new Error("Invalid company sites response");
      return data as CompanySite[];
    },
    enabled: enabled && mine.isSuccess,
    staleTime: 15_000,
    refetchInterval: 60_000,
  });
  const siteCount = getCompanySiteCount(all.data);
  return {
    siteCount,
    hasMultipleSites: siteCount !== null && siteCount > 1,
    isPending: isLoading || (enabled && !mine.isError && (mine.isPending || all.isPending)),
    isError: enabled && (mine.isError || all.isError),
    refetch: async () => { await mine.refetch(); await all.refetch(); },
  };
}
