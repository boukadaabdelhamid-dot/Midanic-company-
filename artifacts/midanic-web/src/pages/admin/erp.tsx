import { useCallback, useEffect, useMemo, useState } from "react";
import { adminApi, type AdminCustomer, type ErpTenant } from "@/lib/admin-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useAdminText } from "@/lib/admin-i18n";
import { BriefcaseBusiness, Copy, ExternalLink, Globe2, Plus, RefreshCw, Settings2, ShoppingBag, Trash2 } from "lucide-react";

const STATUS_OPTIONS = ["pending", "active", "suspended", "expired", "converted"];
const FEATURE_OPTIONS = [
  { key: "dashboard", label: "Dashboard", description: "Company overview and KPIs" },
  { key: "orders", label: "Sales and orders", description: "POS, sales orders, returns, and online orders" },
  { key: "products", label: "Products", description: "Product catalog and categories" },
  { key: "inventory", label: "Inventory", description: "Stock, expiry, and stock counts" },
  { key: "purchases", label: "Purchases", description: "Purchase orders and replenishment" },
  { key: "customers", label: "Customers", description: "Customer accounts, balances, and history" },
  { key: "suppliers", label: "Suppliers", description: "Supplier accounts and operations" },
  { key: "hr", label: "HR", description: "Employees, attendance, leave, and payroll" },
  { key: "accounting", label: "Accounting", description: "Cash, accounting summaries, and transactions" },
  { key: "reports", label: "Reports", description: "Management reports" },
  { key: "transfers", label: "Transfers", description: "Stock transfers between stores" },
  { key: "caisse", label: "Cash registers", description: "Cash sessions and cash transfers" },
  { key: "realtime", label: "Realtime", description: "Realtime updates and activity" },
  { key: "alerts", label: "Alerts", description: "Stock and business alerts" },
  { key: "settings", label: "Settings", description: "Company settings" },
  { key: "web_store", label: "Web Store", description: "Customer-facing online store" },
] as const;

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  suspended: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  expired: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  converted: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
}

function formatStoreUsage(
  tenant: Pick<ErpTenant, "currentStores" | "maxStores" | "storeCountStatus">,
  tAdmin: (key: string) => string,
) {
  if (tenant.currentStores == null) {
    return tAdmin(tenant.storeCountStatus === "not_ready" ? "ERP database not ready" : "Store count unavailable");
  }
  const limit = tenant.maxStores == null ? "∞" : String(tenant.maxStores);
  return `${tenant.currentStores} / ${limit} ${tAdmin("stores")}`;
}

export default function AdminErp() {
  const [tenants, setTenants] = useState<ErpTenant[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [companyName, setCompanyName] = useState("");
  const [ownerUserId, setOwnerUserId] = useState("");
  const [createSubdomain, setCreateSubdomain] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [domainTenant, setDomainTenant] = useState<ErpTenant | null>(null);
  const [domainSubdomain, setDomainSubdomain] = useState("");
  const [domainStatus, setDomainStatus] = useState<"inactive" | "active">("inactive");
  const [savingDomain, setSavingDomain] = useState(false);
  const [deletingDomain, setDeletingDomain] = useState(false);
  const [deleteDomainOpen, setDeleteDomainOpen] = useState(false);
  const [webStoreTenant, setWebStoreTenant] = useState<ErpTenant | null>(null);
  const [webStoreSubdomain, setWebStoreSubdomain] = useState("");
  const [webStoreStatus, setWebStoreStatus] = useState<"inactive" | "active">("inactive");
  const [webStoreDomainStatus, setWebStoreDomainStatus] = useState<"inactive" | "active">("inactive");
  const [savingWebStore, setSavingWebStore] = useState(false);
  const [deletingWebStoreDomain, setDeletingWebStoreDomain] = useState(false);
  const [deleteWebStoreDomainOpen, setDeleteWebStoreDomainOpen] = useState(false);
  const [featureTenant, setFeatureTenant] = useState<ErpTenant | null>(null);
  const [featureFlags, setFeatureFlags] = useState<Record<string, boolean>>({});
  const [maxStoresInput, setMaxStoresInput] = useState("");
  const [savingFeatures, setSavingFeatures] = useState(false);
  const [refreshingStoreCountId, setRefreshingStoreCountId] = useState<number | null>(null);
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const { toast } = useToast();
  const { tAdmin } = useAdminText();

  const loadTenants = useCallback(async () => {
    setLoading(true);
    try {
      const result = await adminApi.listErpTenants(statusFilter === "all" ? undefined : statusFilter);
      setTenants(result.tenants);
    } catch (error) {
      toast({ title: tAdmin("Unable to load ERP accounts"), description: (error as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [statusFilter, toast]);

  useEffect(() => {
    void loadTenants();
  }, [loadTenants]);

  useEffect(() => {
    let cancelled = false;
    setLoadingCustomers(true);
    adminApi.listCustomers({ limit: 100 })
      .then((result) => {
        if (!cancelled) setCustomers(result.customers);
      })
      .catch((error) => {
        if (!cancelled) {
          toast({ title: tAdmin("Unable to load customers"), description: (error as Error).message, variant: "destructive" });
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingCustomers(false);
      });
    return () => { cancelled = true; };
  }, [toast]);

  const counts = useMemo(
    () => STATUS_OPTIONS.reduce<Record<string, number>>((result, status) => {
      result[status] = tenants.filter((tenant) => tenant.status === status).length;
      return result;
    }, {}),
    [tenants],
  );

  async function updateStatus(tenant: ErpTenant, status: string) {
    try {
      const updated = await adminApi.updateErpTenant(tenant.id, { status });
      setTenants((current) => current.map((item) => item.id === updated.id ? { ...item, ...updated } : item));
      toast({ title: tAdmin("ERP account updated") });
    } catch (error) {
      toast({ title: tAdmin("Update failed"), description: (error as Error).message, variant: "destructive" });
    }
  }

  async function createTenant() {
    const parsedOwnerId = Number(ownerUserId);
    if (!companyName.trim() || !Number.isInteger(parsedOwnerId) || parsedOwnerId <= 0) {
      toast({ title: tAdmin("Enter a company name and a valid owner user ID"), variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      const tenant = await adminApi.createErpTenant({
        companyName: companyName.trim(),
        ownerUserId: parsedOwnerId,
        ...(createSubdomain.trim() ? { subdomain: createSubdomain.trim() } : {}),
      });
      setTenants((current) => [tenant, ...current]);
      setCompanyName("");
      setOwnerUserId("");
      setCreateSubdomain("");
      setCreateOpen(false);
      toast({ title: tAdmin("ERP account created") });
    } catch (error) {
      toast({ title: tAdmin("Creation failed"), description: (error as Error).message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  }

  function openDomainEditor(tenant: ErpTenant) {
    setDomainTenant(tenant);
    setDomainSubdomain(tenant.subdomain ?? "");
    setDomainStatus(tenant.domainStatus);
  }

  async function saveDomain() {
    if (!domainTenant) return;
    if (domainStatus === "active" && !domainSubdomain.trim()) {
      toast({ title: tAdmin("Assign a subdomain before activating it"), variant: "destructive" });
      return;
    }
    setSavingDomain(true);
    try {
      const subdomainChanged = (domainTenant.subdomain ?? "") !== domainSubdomain.trim();
      const updated = await adminApi.updateErpTenant(domainTenant.id, {
        subdomain: domainSubdomain.trim() || null,
        domainStatus: subdomainChanged ? "inactive" : domainStatus,
      });
      setTenants((current) =>
        current.map((item) => item.id === updated.id ? { ...item, ...updated } : item),
      );
      setDomainTenant(null);
      toast({
        title: subdomainChanged && domainStatus === "active"
          ? tAdmin("Domain saved inactive — activate it after DNS is ready")
          : tAdmin("ERP domain updated"),
      });
    } catch (error) {
      toast({ title: tAdmin("Domain update failed"), description: (error as Error).message, variant: "destructive" });
    } finally {
      setSavingDomain(false);
    }
  }

  async function deleteDomain() {
    if (!domainTenant) return;
    setDeletingDomain(true);
    try {
      const updated = await adminApi.deleteErpTenantDomain(domainTenant.id);
      setTenants((current) =>
        current.map((item) => item.id === updated.id ? { ...item, ...updated } : item),
      );
      setDeleteDomainOpen(false);
      setDomainTenant(null);
      toast({ title: tAdmin("ERP domain deleted") });
    } catch (error) {
      toast({ title: tAdmin("Domain deletion failed"), description: (error as Error).message, variant: "destructive" });
    } finally {
      setDeletingDomain(false);
    }
  }

  async function copyHostname(hostname: string) {
    await navigator.clipboard.writeText(`https://${hostname}`);
    toast({ title: tAdmin("ERP domain copied") });
  }

  function openWebStoreEditor(tenant: ErpTenant) {
    setWebStoreTenant(tenant);
    setWebStoreSubdomain(tenant.webStoreSubdomain ?? "");
    setWebStoreStatus(tenant.webStoreStatus);
    setWebStoreDomainStatus(tenant.webStoreDomainStatus);
  }

  async function saveWebStore() {
    if (!webStoreTenant) return;
    if (webStoreStatus === "active" && !["active", "converted"].includes(webStoreTenant.status)) {
      toast({ title: tAdmin("Activate the ERP account before launching Web Store"), variant: "destructive" });
      return;
    }
    if (webStoreDomainStatus === "active" && !webStoreSubdomain.trim()) {
      toast({ title: tAdmin("Assign a Web Store subdomain before activating it"), variant: "destructive" });
      return;
    }
    setSavingWebStore(true);
    try {
      const subdomainChanged = (webStoreTenant.webStoreSubdomain ?? "") !== webStoreSubdomain.trim();
      const updated = await adminApi.updateErpTenant(webStoreTenant.id, {
        webStoreStatus,
        webStoreSubdomain: webStoreSubdomain.trim() || null,
        webStoreDomainStatus: subdomainChanged ? "inactive" : webStoreDomainStatus,
      });
      setTenants((current) => current.map((item) => item.id === updated.id ? { ...item, ...updated } : item));
      setWebStoreTenant(null);
      toast({
        title: subdomainChanged && webStoreDomainStatus === "active"
          ? tAdmin("Web Store domain saved inactive — activate it after DNS is ready")
          : tAdmin("Web Store settings updated"),
      });
    } catch (error) {
      toast({ title: tAdmin("Web Store update failed"), description: (error as Error).message, variant: "destructive" });
    } finally {
      setSavingWebStore(false);
    }
  }

  async function deleteWebStoreDomain() {
    if (!webStoreTenant) return;
    setDeletingWebStoreDomain(true);
    try {
      const updated = await adminApi.deleteWebStoreDomain(webStoreTenant.id);
      setTenants((current) => current.map((item) => item.id === updated.id ? { ...item, ...updated } : item));
      setDeleteWebStoreDomainOpen(false);
      setWebStoreTenant(null);
      toast({ title: tAdmin("Web Store domain deleted") });
    } catch (error) {
      toast({ title: tAdmin("Web Store domain deletion failed"), description: (error as Error).message, variant: "destructive" });
    } finally {
      setDeletingWebStoreDomain(false);
    }
  }

  function openFeatureEditor(tenant: ErpTenant) {
    setFeatureTenant(tenant);
    setMaxStoresInput(tenant.maxStores == null ? "" : String(tenant.maxStores));
    setFeatureFlags(Object.fromEntries(
      FEATURE_OPTIONS.map(({ key }) => [key, tenant.featureFlags?.[key] !== false]),
    ));
  }

  async function saveFeatures() {
    if (!featureTenant) return;
    const maxStoresText = maxStoresInput.trim();
    const maxStores = maxStoresText === "" ? null : Number(maxStoresText);
    if (maxStores !== null && (!Number.isInteger(maxStores) || maxStores < 1)) {
      toast({ title: tAdmin("Invalid store limit"), variant: "destructive" });
      return;
    }
    setSavingFeatures(true);
    try {
      const updated = await adminApi.updateErpTenant(featureTenant.id, { featureFlags, maxStores });
      setTenants((current) => current.map((item) => item.id === updated.id ? { ...item, ...updated } : item));
      setFeatureTenant(null);
      toast({ title: tAdmin("Company features updated") });
    } catch (error) {
      toast({ title: tAdmin("Feature update failed"), description: (error as Error).message, variant: "destructive" });
    } finally {
      setSavingFeatures(false);
    }
  }

  async function refreshStoreCount(tenant: ErpTenant) {
    setRefreshingStoreCountId(tenant.id);
    try {
      const summary = await adminApi.getErpTenantStoreCount(tenant.id);
      setTenants((current) => current.map((item) => (
        item.id === tenant.id ? { ...item, ...summary } : item
      )));
      setFeatureTenant((current) => (
        current?.id === tenant.id ? { ...current, ...summary } : current
      ));
      toast({
        title: summary.storeCountStatus === "ready"
          ? tAdmin("Store count refreshed")
          : tAdmin("Store count still unavailable"),
      });
    } catch (error) {
      toast({
        title: tAdmin("Store count refresh failed"),
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setRefreshingStoreCountId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <BriefcaseBusiness className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">{tAdmin("ERP Control")}</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {tAdmin("Control companies, trials, access, and lifecycle from one place.")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => void loadTenants()} disabled={loading} aria-label="Refresh">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />{tAdmin("Create ERP account")}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{tAdmin("Create ERP account")}</DialogTitle></DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="erp-company-name">{tAdmin("Company name")}</label>
                  <Input id="erp-company-name" value={companyName} onChange={(event) => setCompanyName(event.target.value)} placeholder={tAdmin("Company name")} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="erp-owner-id">{tAdmin("Owner user ID")}</label>
                  <Select value={ownerUserId} onValueChange={setOwnerUserId} disabled={loadingCustomers}>
                    <SelectTrigger id="erp-owner-id">
                      <SelectValue placeholder={loadingCustomers ? tAdmin("Loading customers...") : tAdmin("Select a customer")} />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((customer) => (
                        <SelectItem key={customer.id} value={String(customer.id)}>
                          {customer.firstName} {customer.lastName} — {customer.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">{tAdmin("Choose the customer who will own this ERP account.")}</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="erp-subdomain">{tAdmin("Company subdomain")}</label>
                  <div className="flex items-center rounded-md border bg-background">
                    <Input
                      id="erp-subdomain"
                      value={createSubdomain}
                      onChange={(event) => setCreateSubdomain(event.target.value.toLowerCase())}
                      placeholder="plattin"
                      className="border-0 shadow-none focus-visible:ring-0"
                    />
                    <span className="pr-3 text-sm text-muted-foreground">.midanic.com</span>
                  </div>
                    <p className="text-xs text-muted-foreground">{tAdmin("The domain starts inactive. After creating the account, open its domain settings and activate it once wildcard DNS is ready.")}</p>
                </div>
              </div>
              <DialogFooter><Button onClick={() => void createTenant()} disabled={creating}>{creating ? tAdmin("Creating...") : tAdmin("Create account")}</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {STATUS_OPTIONS.map((status) => (
          <button key={status} className="rounded-xl border bg-card p-4 text-left transition hover:border-primary/50" onClick={() => setStatusFilter(status)}>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{tAdmin(status)}</p>
            <p className="mt-2 text-2xl font-semibold">{counts[status] ?? 0}</p>
          </button>
        ))}
      </div>

      <div className="flex justify-end">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tAdmin("All statuses")}</SelectItem>
            {STATUS_OPTIONS.map((status) => <SelectItem key={status} value={status}>{tAdmin(status)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tAdmin("Company")}</TableHead>
              <TableHead>{tAdmin("Owner")}</TableHead>
              <TableHead>{tAdmin("Status")}</TableHead>
              <TableHead>{tAdmin("Company domain")}</TableHead>
              <TableHead>{tAdmin("Web Store")}</TableHead>
              <TableHead>{tAdmin("Features")}</TableHead>
             <TableHead>{tAdmin("Trial ends")}</TableHead>
              <TableHead>{tAdmin("Created")}</TableHead>
              <TableHead className="text-right">{tAdmin("Access")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
             {loading ? (
               <TableRow><TableCell colSpan={9} className="py-10 text-center text-muted-foreground">{tAdmin("Loading ERP accounts...")}</TableCell></TableRow>
            ) : tenants.length === 0 ? (
               <TableRow><TableCell colSpan={9} className="py-10 text-center text-muted-foreground">{tAdmin("No ERP accounts found.")}</TableCell></TableRow>
            ) : tenants.map((tenant) => (
              <TableRow key={tenant.id}>
                <TableCell>
                  <div className="font-medium">{tenant.companyName}</div>
                   <div className="text-xs text-muted-foreground">{tAdmin("Tenant")} #{tenant.id}</div>
                </TableCell>
                <TableCell>
                   <div>{[tenant.ownerFirstName, tenant.ownerLastName].filter(Boolean).join(" ") || "—"}</div>
                   <div className="text-xs text-muted-foreground">{tenant.ownerEmail || `${tAdmin("User")} #${tenant.ownerUserId}`}</div>
                </TableCell>
                <TableCell><Badge className={STATUS_STYLES[tenant.status] ?? ""}>{tenant.status}</Badge></TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    className="h-auto justify-start px-2 py-1 text-left"
                    onClick={() => openDomainEditor(tenant)}
                  >
                    <Globe2 className="mr-2 h-4 w-4" />
                    <span>
                       <span className="block text-sm">{tenant.hostname ?? tAdmin("Assign domain")}</span>
                      <span className="block text-xs text-muted-foreground">
                         {tenant.hostname ? tAdmin(tenant.domainStatus) : tAdmin("unassigned")}
                      </span>
                    </span>
                  </Button>
                </TableCell>
                 <TableCell>
                   <Button
                     variant="ghost"
                     className="h-auto justify-start px-2 py-1 text-left"
                     onClick={() => openWebStoreEditor(tenant)}
                   >
                     <ShoppingBag className="mr-2 h-4 w-4" />
                     <span>
                       <span className="block text-sm">
                         {tenant.webStoreHostname ?? tAdmin("Configure Web Store")}
                       </span>
                       <span className="block text-xs text-muted-foreground">
                         {tAdmin(tenant.webStoreStatus === "active" ? "Published" : "Blocked")}
                         {tenant.webStoreHostname ? ` · ${tAdmin(tenant.webStoreDomainStatus)}` : ""}
                       </span>
                     </span>
                   </Button>
                 </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        className="h-auto justify-start px-2 py-1 text-left"
                        onClick={() => openFeatureEditor(tenant)}
                      >
                        <Settings2 className="mr-2 h-4 w-4" />
                        <span>
                          <span className="block text-sm">{tAdmin("Manage features")}</span>
                          <span className="block text-xs text-muted-foreground">
                            {FEATURE_OPTIONS.filter(({ key }) => tenant.featureFlags?.[key] !== false).length}/{FEATURE_OPTIONS.length} {tAdmin("enabled")} · {formatStoreUsage(tenant, tAdmin)}
                          </span>
                        </span>
                      </Button>
                      {tenant.currentStores == null && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => void refreshStoreCount(tenant)}
                          disabled={refreshingStoreCountId === tenant.id}
                          aria-label={tAdmin("Retry store count")}
                          title={tAdmin("Retry store count")}
                        >
                          <RefreshCw className={`h-4 w-4 ${refreshingStoreCountId === tenant.id ? "animate-spin" : ""}`} />
                        </Button>
                      )}
                    </div>
                 </TableCell>
                <TableCell>{formatDate(tenant.trialEndsAt)}</TableCell>
                <TableCell>{formatDate(tenant.createdAt)}</TableCell>
                <TableCell className="text-right">
                  <Select value={tenant.status} onValueChange={(value) => void updateStatus(tenant, value)}>
                    <SelectTrigger className="ml-auto w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUS_OPTIONS.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={Boolean(domainTenant)} onOpenChange={(open) => !open && setDomainTenant(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tAdmin("Manage ERP company domain")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <p className="text-sm font-medium">{domainTenant?.companyName}</p>
               <p className="text-xs text-muted-foreground">{tAdmin("All companies use the same shared ERP service; this hostname selects the tenant.")}</p>
            </div>
            <div className="space-y-2">
               <label className="text-sm font-medium" htmlFor="domain-subdomain">{tAdmin("Subdomain")}</label>
              <div className="flex items-center rounded-md border bg-background">
                <Input
                  id="domain-subdomain"
                  value={domainSubdomain}
                  onChange={(event) => setDomainSubdomain(event.target.value.toLowerCase())}
                  placeholder="plattin"
                  className="border-0 shadow-none focus-visible:ring-0"
                />
                <span className="pr-3 text-sm text-muted-foreground">.midanic.com</span>
              </div>
            </div>
            <div className="space-y-2">
               <label className="text-sm font-medium">{tAdmin("Domain access")}</label>
              <Select value={domainStatus} onValueChange={(value) => setDomainStatus(value as "inactive" | "active")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                   <SelectItem value="inactive">{tAdmin("Inactive — block ERP access")}</SelectItem>
                   <SelectItem value="active">{tAdmin("Active — allow ERP access")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {domainTenant?.hostname && (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => void copyHostname(domainTenant.hostname!)}>
                   <Copy className="mr-2 h-4 w-4" />{tAdmin("Copy URL")}
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a href={`https://${domainTenant.hostname}`} target="_blank" rel="noreferrer">
                     <ExternalLink className="mr-2 h-4 w-4" />{tAdmin("Open")}
                  </a>
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="destructive"
              className="mr-auto"
              onClick={() => setDeleteDomainOpen(true)}
              disabled={deletingDomain}
            >
              <Trash2 className="mr-2 h-4 w-4" />{tAdmin("Delete domain")}
            </Button>
            <Button variant="outline" onClick={() => setDomainTenant(null)}>{tAdmin("Cancel")}</Button>
            <Button onClick={() => void saveDomain()} disabled={savingDomain}>
              {savingDomain ? tAdmin("Saving...") : tAdmin("Save domain")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(webStoreTenant)} onOpenChange={(open) => !open && setWebStoreTenant(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tAdmin("Manage customer Web Store")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <p className="text-sm font-medium">{webStoreTenant?.companyName}</p>
              <p className="text-xs text-muted-foreground">
                {tAdmin("Platform controls whether the customer store is published. The customer database remains isolated.")}
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{tAdmin("Store access")}</label>
              <Select value={webStoreStatus} onValueChange={(value) => setWebStoreStatus(value as "inactive" | "active")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="inactive">{tAdmin("Blocked — prevent Web Store access")}</SelectItem>
                  <SelectItem value="active">{tAdmin("Published — allow Web Store access")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="web-store-subdomain">{tAdmin("Web Store subdomain")}</label>
              <div className="flex items-center rounded-md border bg-background">
                <Input
                  id="web-store-subdomain"
                  value={webStoreSubdomain}
                  onChange={(event) => setWebStoreSubdomain(event.target.value.toLowerCase())}
                  placeholder="client"
                  className="border-0 shadow-none focus-visible:ring-0"
                />
                <span className="pr-3 text-sm text-muted-foreground">.store.midanic.com</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {tAdmin("The hostname is generated under the Web Store root domain. Configure wildcard DNS before activating it.")}
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{tAdmin("Web Store domain access")}</label>
              <Select value={webStoreDomainStatus} onValueChange={(value) => setWebStoreDomainStatus(value as "inactive" | "active")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="inactive">{tAdmin("Inactive — block this hostname")}</SelectItem>
                  <SelectItem value="active">{tAdmin("Active — allow this hostname")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {webStoreTenant?.webStoreHostname && (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => void copyHostname(webStoreTenant.webStoreHostname!)}>
                  <Copy className="mr-2 h-4 w-4" />{tAdmin("Copy URL")}
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a href={`https://${webStoreTenant.webStoreHostname}`} target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" />{tAdmin("Open")}
                  </a>
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="destructive"
              className="mr-auto"
              onClick={() => setDeleteWebStoreDomainOpen(true)}
              disabled={deletingWebStoreDomain || !webStoreTenant?.webStoreHostname}
            >
              <Trash2 className="mr-2 h-4 w-4" />{tAdmin("Delete domain")}
            </Button>
            <Button variant="outline" onClick={() => setWebStoreTenant(null)}>{tAdmin("Cancel")}</Button>
            <Button onClick={() => void saveWebStore()} disabled={savingWebStore}>
              {savingWebStore ? tAdmin("Saving...") : tAdmin("Save Web Store")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(featureTenant)} onOpenChange={(open) => !open && setFeatureTenant(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{tAdmin("Manage company features")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 rounded-lg border p-3">
            <label className="text-sm font-medium" htmlFor="erp-max-stores">
              {tAdmin("Maximum number of stores")}
            </label>
            <Input
              id="erp-max-stores"
              type="number"
              min={1}
              step={1}
              value={maxStoresInput}
              onChange={(event) => setMaxStoresInput(event.target.value)}
              placeholder={tAdmin("Leave empty for unlimited")}
            />
            <p className="text-xs text-muted-foreground">
              {tAdmin("Current store usage")}: {formatStoreUsage(featureTenant ?? { currentStores: null, maxStores: null, storeCountStatus: "unavailable" }, tAdmin)}
            </p>
            {featureTenant?.currentStores == null && featureTenant && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void refreshStoreCount(featureTenant)}
                disabled={refreshingStoreCountId === featureTenant.id}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${refreshingStoreCountId === featureTenant.id ? "animate-spin" : ""}`} />
                {tAdmin("Retry store count")}
              </Button>
            )}
            <p className="text-xs text-muted-foreground">{tAdmin("The company cannot create more stores than this limit.")}</p>
          </div>
          <div className="grid gap-3 py-2 sm:grid-cols-2">
            {FEATURE_OPTIONS.map(({ key, label, description }) => (
              <div key={key} className="flex items-start justify-between gap-4 rounded-lg border p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{tAdmin(label)}</p>
                  <p className="text-xs text-muted-foreground">{tAdmin(description)}</p>
                </div>
                <Switch
                  checked={featureFlags[key] !== false}
                  onCheckedChange={(checked) => setFeatureFlags((current) => ({ ...current, [key]: checked }))}
                  aria-label={`${tAdmin(label)} ${tAdmin("feature")}`}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFeatureTenant(null)}>{tAdmin("Cancel")}</Button>
            <Button onClick={() => void saveFeatures()} disabled={savingFeatures}>
              {savingFeatures ? tAdmin("Saving...") : tAdmin("Save features")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteWebStoreDomainOpen} onOpenChange={setDeleteWebStoreDomainOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tAdmin("Delete this Web Store domain?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {tAdmin("This removes the Web Store hostname and blocks access through it. The customer and its data will not be deleted.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingWebStoreDomain}>{tAdmin("Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => { event.preventDefault(); void deleteWebStoreDomain(); }}
              disabled={deletingWebStoreDomain}
            >
              {deletingWebStoreDomain ? tAdmin("Deleting...") : tAdmin("Delete domain")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteDomainOpen} onOpenChange={setDeleteDomainOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
           <AlertDialogTitle>{tAdmin("Delete this ERP domain?")}</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the subdomain and blocks access through it. The company and its ERP data will not be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
             <AlertDialogCancel disabled={deletingDomain}>{tAdmin("Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                void deleteDomain();
              }}
              disabled={deletingDomain}
            >
               {deletingDomain ? tAdmin("Deleting...") : tAdmin("Delete domain")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}