import React from "react";
import { useProtectedRoute } from "@/hooks/use-protected-route";
import ProfitabilityReports from "@/components/ProfitabilityReports";

export default function Reports() {
  const { ready } = useProtectedRoute({ adminOnly: true });
  if (!ready) return null;
  return <ProfitabilityReports ready={ready} />;
}