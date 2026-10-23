import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { adminApi, type ErpTenant } from "@/lib/admin-api";
import { useAdminText } from "@/lib/admin-i18n";
import { Button } from "@/components/ui/button";
import { CompanyMetrics, CompanyRegister } from "./company-register";

export function CompanyOverview() {
  const { tAdmin } = useAdminText();
  const [, navigate] = useLocation();
  const [tenants, setTenants] = useState<ErpTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const result = await adminApi.listErpTenants();
      setTenants(result.tenants);
      setError("");
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 60000);
    return () => window.clearInterval(timer);
  }, [load]);
  return <section className="console-overview-companies">
    <header><div><h2>{tAdmin("ERP Companies")}</h2><p className="mt-1 text-xs text-muted-foreground">{tAdmin("Control companies, trials, access, and lifecycle from one place.")}</p></div><Link href="/admin/erp">{tAdmin("Open company register")}</Link></header>
    {error ? <div role="alert" className="console-empty"><p>{tAdmin("Unable to load ERP accounts")}</p><p className="text-sm">{error}</p><Button variant="outline" className="mt-3" onClick={() => void load()}>{tAdmin("Refresh")}</Button></div>
      : loading ? <div className="console-empty" role="status">{tAdmin("Loading ERP accounts...")}</div>
      : <><CompanyMetrics tenants={tenants} selected="" onSelect={filter => navigate(`/admin/erp?focus=${filter}`)} />
        <h3 className="my-5 text-sm font-semibold">{tAdmin("Recent companies")}</h3>
        <CompanyRegister tenants={[...tenants].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5)} allTenants={tenants} onOpen={tenant => navigate(`/admin/erp?company=${tenant.id}`)} />
      </>}
  </section>;
}
