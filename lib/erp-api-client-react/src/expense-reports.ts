import { useQuery } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";

export type ExpenseReportParams = {
  from: string;
  to: string;
};

export type ExpenseReportItem = {
  id: number;
  amount: number;
  category: string;
  description: string;
  reference: string | null;
  createdAt: string;
};

export function useGetExpenseReportDetails(
  params: ExpenseReportParams | null,
  enabled = true,
) {
  return useQuery({
    queryKey: ["/api/admin/reports/expenses", params?.from ?? null, params?.to ?? null],
    queryFn: async () => {
      if (!params) return [];
      const search = new URLSearchParams({ from: params.from, to: params.to });
      return customFetch<ExpenseReportItem[]>(`/api/admin/reports/expenses?${search}`);
    },
    enabled: enabled && params !== null,
  });
}
