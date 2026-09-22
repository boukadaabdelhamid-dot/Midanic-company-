import { getGetMeQueryKey, useGetMe } from "@workspace/erp-api-client-react";
import { useAuth } from "@/hooks/use-auth";

export type Role = "admin" | "tenant_admin" | "employee" | "customer";

export function useMe() {
  const { token } = useAuth();
  const { data, isLoading } = useGetMe({
    query: { queryKey: getGetMeQueryKey(), enabled: !!token, staleTime: 60_000, retry: false },
  });
  const role = (data?.role ?? null) as Role | null;
  const features = (data as (typeof data & {
    features?: Record<string, boolean | number | null>;
  }) | undefined)?.features ?? {};
  return {
    user: data ?? null,
    role,
    features,
    // In the ERP UI, a tenant owner is an administrator of their company.
    // The API still distinguishes this from the global platform admin.
    isAdmin: role === "admin" || role === "tenant_admin",
    isEmployee: role === "employee",
    isStaff: role === "admin" || role === "tenant_admin" || role === "employee",
    isLoading: !!token && isLoading,
  };
}
