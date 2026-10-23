import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { adminApi, type AdminCustomer, type ErpTenant } from "@/lib/admin-api";
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
import { CompanyMetrics, CompanyRegister, needsCompanyAttention } from "./company-register";
import { CompanyDetail } from "./company-detail";
import { BriefcaseBusiness, Copy, ExternalLink, Globe2, Plus, RefreshCw, Trash2, Upload } from "lucide-react";

const STATUS_OPTIONS = ["pending", "active", "suspended", "expired", "converted"];
const ACCOUNT_GROUP_OPTIONS = [
  { value: "all", label: "All ERP accounts" },
  { value: "trial", label: "Trial accounts" },
  { value: "contracted", label: "Contracted accounts" },
  { value: "other", label: "Other accounts" },
] as const;
type AccountGroup = "trial" | "contracted" | "other";
type AccountGroupFilter = "all" | AccountGroup;
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
  { key: "manufacturing", label: "Manufacturing", description: "Factory recipes, production orders, and factory stock" },
  { key: "caisse", label: "Cash registers", description: "Cash sessions and cash transfers" },
  { key: "realtime", label: "Realtime", description: "Realtime updates and activity" },
  { key: "alerts", label: "Alerts", description: "Stock and business alerts" },
  { key: "settings", label: "Settings", description: "Company settings" },
  { key: "web_store", label: "Web Store", description: "Customer-facing online store" },
] as const;


function getAccountGroup(
  tenant: Pick<ErpTenant, "status" | "trialStartedAt" | "trialEndsAt" | "contractPeriod">,
): AccountGroup {
  if (tenant.status === "converted" || tenant.contractPeriod) return "contracted";
  if (tenant.trialStartedAt || tenant.trialEndsAt) return "trial";
  return "other";
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T12:00:00`)
    : new Date(value);
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

function localDateInputValue(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function previewContractEndDate(
  startsAt: string,
  period: "monthly" | "yearly",
): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(startsAt);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const monthIndex = year * 12 + month - 1 + (period === "monthly" ? 1 : 12);
  const targetYear = Math.floor(monthIndex / 12);
  const targetMonth = (monthIndex % 12) + 1;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
  return `${targetYear}-${String(targetMonth).padStart(2, "0")}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
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
  const searchParams = useSearch();
  const [, navigate] = useLocation();
  const [tenants, setTenants] = useState<ErpTenant[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [companySearch, setCompanySearch] = useState("");
  const [metricFilter, setMetricFilter] = useState("all");
  const [loadError, setLoadError] = useState("");
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    const company = Number(params.get("company"));
    setSelectedCompanyId(Number.isSafeInteger(company) && company > 0 ? company : null);
    const focus = params.get("focus");
    if (focus && ["all", "active", "trial", "attention"].includes(focus)) setMetricFilter(focus);
  }, [searchParams]);
  const [accountGroupFilter, setAccountGroupFilter] = useState<AccountGroupFilter>("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [companyName, setCompanyName] = useState("");
  const [ownerUserId, setOwnerUserId] = useState("");
  const [createSubdomain, setCreateSubdomain] = useState("");
  const [importExistingData, setImportExistingData] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [passwordTenant, setPasswordTenant] = useState<ErpTenant | null>(null);
  const [ownerPassword, setOwnerPassword] = useState("");
  const [confirmOwnerPassword, setConfirmOwnerPassword] = useState("");
  const [savingOwnerPassword, setSavingOwnerPassword] = useState(false);
  const [importTenant, setImportTenant] = useState<ErpTenant | null>(null);
  const [backupFile, setBackupFile] = useState<File | null>(null);
  const [confirmBackup, setConfirmBackup] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
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
  const [contractTenant, setContractTenant] = useState<ErpTenant | null>(null);
  const [contractPeriod, setContractPeriod] = useState<"monthly" | "yearly">("monthly");
  const [contractStartsAt, setContractStartsAt] = useState("");
  const [savingContract, setSavingContract] = useState(false);
  const [refreshingStoreCountId, setRefreshingStoreCountId] = useState<number | null>(null);
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const { toast } = useToast();
  const { tAdmin } = useAdminText();

  function closePasswordDialog() {
    setPasswordTenant(null);
    setOwnerPassword("");
    setConfirmOwnerPassword("");
  }

  async function changeOwnerPassword() {
    if (!passwordTenant || savingOwnerPassword) return;
    if (ownerPassword.length < 8 || ownerPassword.length > 128) {
      toast({ title: tAdmin("Password must be 8–128 characters"), variant: "destructive" });
      return;
    }
    if (ownerPassword !== confirmOwnerPassword) {
      toast({ title: tAdmin("Passwords do not match"), variant: "destructive" });
      return;
    }
    setSavingOwnerPassword(true);
    try {
      await adminApi.changeErpTenantOwnerPassword(passwordTenant.id, ownerPassword);
      closePasswordDialog();
      toast({ title: tAdmin("Owner password changed") });
    } catch (error) {
      toast({ title: tAdmin("Password change failed"), description: (error as Error).message, variant: "destructive" });
    } finally {
      setSavingOwnerPassword(false);
    }
  }

  const loadTenants = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const result = await adminApi.listErpTenants();
      setTenants(result.tenants);
    } catch (error) {
      setLoadError((error as Error).message);
      toast({ title: tAdmin("Unable to load ERP accounts"), description: (error as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

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

  const accountGroupCounts = useMemo(() => {
    const result: Record<AccountGroupFilter, number> = {
      all: tenants.length,
      trial: 0,
      contracted: 0,
      other: 0,
    };
    for (const tenant of tenants) result[getAccountGroup(tenant)] += 1;
    return result;
  }, [tenants]);

  const visibleTenants = useMemo(
    () => tenants.filter((tenant) =>
      (accountGroupFilter === "all" || getAccountGroup(tenant) === accountGroupFilter) &&
      (statusFilter === "all" || tenant.status === statusFilter) &&
      (metricFilter === "all" ||
        (metricFilter === "active" && ["active", "converted"].includes(tenant.status)) ||
        (metricFilter === "trial" && getAccountGroup(tenant) === "trial") ||
        (metricFilter === "attention" && needsCompanyAttention(tenant))) &&
      (!companySearch.trim() || `${tenant.companyName} ${tenant.ownerEmail ?? ""} ${tenant.ownerFirstName ?? ""} ${tenant.ownerLastName ?? ""} ${tenant.hostname ?? ""} ${tenant.id}`.toLocaleLowerCase().includes(companySearch.trim().toLocaleLowerCase()))
    ),
    [accountGroupFilter, statusFilter, metricFilter, companySearch, tenants],
  );
  const selectedCompany = tenants.find(tenant => tenant.id === selectedCompanyId);

  async function updateStatus(tenant: ErpTenant, status: string) {
    if (status === "converted") {
      openContractEditor(tenant);
      return;
    }
    try {
      const updated = await adminApi.updateErpTenant(tenant.id, { status });
      setTenants((current) => current.map((item) => item.id === updated.id ? { ...item, ...updated } : item));
      toast({ title: tAdmin("ERP account updated") });
    } catch (error) {
      toast({ title: tAdmin("Update failed"), description: (error as Error).message, variant: "destructive" });
    }
  }

  function openContractEditor(tenant: ErpTenant) {
    setContractTenant(tenant);
    setContractPeriod(tenant.contractPeriod ?? "monthly");
    setContractStartsAt(tenant.contractStartsAt ?? localDateInputValue());
  }

  function renewFromCurrentExpiry() {
    const today = localDateInputValue();
    const currentEnd = contractTenant?.contractEndsAt;
    setContractStartsAt(currentEnd && currentEnd > today ? currentEnd : today);
  }

  async function saveContract() {
    if (!contractTenant || !contractStartsAt) return;
    setSavingContract(true);
    try {
      const updated = await adminApi.updateErpTenant(contractTenant.id, {
        status: "converted",
        contractPeriod,
        contractStartsAt,
      });
      setTenants((current) =>
        current.map((item) => item.id === updated.id ? { ...item, ...updated } : item),
      );
      setContractTenant(null);
      toast({ title: tAdmin("Contract settings saved") });
    } catch (error) {
      toast({
        title: tAdmin("Update failed"),
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setSavingContract(false);
    }
  }

  async function updateProductCatalogMode(
    tenant: ErpTenant,
    productCatalogMode: "separate" | "shared",
  ) {
    if ((tenant.productCatalogMode ?? "separate") === productCatalogMode) return true;
    try {
      const updated = await adminApi.updateErpTenant(tenant.id, { productCatalogMode });
      setTenants((current) => current.map((item) => item.id === tenant.id ? updated : item));
      toast({
        title: tAdmin("Product catalog setting saved"),
        description: tAdmin("This applies to new products; existing products stay unchanged."),
      });
      return true;
    } catch (error) {
      toast({
        title: tAdmin("Could not save product catalog setting"),
        description: error instanceof Error ? error.message : tAdmin("Please try again."),
        variant: "destructive",
      });
      return false;
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
        importExistingData,
        ...(createSubdomain.trim() ? { subdomain: createSubdomain.trim() } : {}),
      });
      setTenants((current) => [tenant, ...current]);
      setCompanyName("");
      setOwnerUserId("");
      setCreateSubdomain("");
      setImportExistingData(false);
      setCreateOpen(false);
      if (importExistingData) {
        setImportTenant(tenant);
        setBackupFile(null);
        setConfirmBackup(false);
        setImportError("");
      } else {
        toast({ title: tAdmin("ERP account created") });
      }
    } catch (error) {
      toast({ title: tAdmin("Creation failed"), description: (error as Error).message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  }

  function openBackupImport(tenant: ErpTenant) {
    setImportTenant(tenant);
    setBackupFile(null);
    setConfirmBackup(false);
    setImportError("");
  }

  async function submitBackupImport() {
    if (!importTenant || !backupFile || !confirmBackup) return;
    setImporting(true);
    setImportError("");
    try {
      const result = await adminApi.importErpTenantBackup(importTenant.id, backupFile);
      setTenants((current) => current.map((tenant) =>
        tenant.id === importTenant.id
          ? {
              ...tenant,
              dataImportStatus: "completed",
              dataImportedAt: new Date().toISOString(),
              dataImportError: null,
              dataImportSummary: result.summary,
            }
          : tenant,
      ));
      setImportTenant(null);
      setBackupFile(null);
      setConfirmBackup(false);
      toast({ title: tAdmin("ERP and Web Store data imported") });
      void loadTenants();
    } catch (error) {
      const message = (error as Error).message;
      setImportError(message);
      toast({
        title: tAdmin("Backup import failed"),
        description: message,
        variant: "destructive",
      });
      void loadTenants();
    } finally {
      setImporting(false);
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
    <div className="space-y-6 console-erp">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <BriefcaseBusiness className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">{tAdmin("ERP Companies")}</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {tAdmin("Control companies, trials, access, and lifecycle from one place.")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => void loadTenants()} disabled={loading} aria-label={tAdmin("Refresh")}>
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
                <div className="flex items-start gap-3 rounded-lg border p-3">
                  <Switch
                    id="erp-import-existing-data"
                    checked={importExistingData}
                    onCheckedChange={setImportExistingData}
                    data-testid="switch-import-existing-data"
                  />
                  <div className="space-y-1">
                    <label className="text-sm font-medium" htmlFor="erp-import-existing-data">
                      {tAdmin("Import an existing ERP and Web Store backup")}
                    </label>
                    <p className="text-xs text-muted-foreground">
                      {tAdmin("Creates a separate, unpublished tenant. The old system remains unchanged.")}
                    </p>
                  </div>
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

      {!selectedCompany && <>
      <CompanyMetrics tenants={tenants} selected={metricFilter} onSelect={filter => { setMetricFilter(filter); setStatusFilter("all"); setAccountGroupFilter("all"); }} />
      <div className="console-toolbar">
        <Input value={companySearch} onChange={event => setCompanySearch(event.target.value)} placeholder={tAdmin("Search companies")} aria-label={tAdmin("Search companies")} data-testid="input-company-search" />
        <Select value={accountGroupFilter} onValueChange={value => setAccountGroupFilter(value as AccountGroupFilter)}>
          <SelectTrigger aria-label={tAdmin("All groups")} className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>{ACCOUNT_GROUP_OPTIONS.map(group => <SelectItem key={group.value} value={group.value}>{tAdmin(group.label)} ({accountGroupCounts[group.value]})</SelectItem>)}</SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44" aria-label={tAdmin("All statuses")}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tAdmin("All statuses")}</SelectItem>
            {STATUS_OPTIONS.map((status) => <SelectItem key={status} value={status}>{tAdmin(status)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {loadError ? <div role="alert" className="console-empty"><p>{tAdmin("Unable to load ERP accounts")}</p><p className="text-sm text-muted-foreground">{loadError}</p><Button variant="outline" onClick={() => void loadTenants()}>{tAdmin("Refresh")}</Button></div>
        : loading ? <div className="console-empty" role="status">{tAdmin("Loading ERP accounts...")}</div>
        : <CompanyRegister tenants={visibleTenants} allTenants={tenants} onOpen={tenant => navigate(`/admin/erp?company=${tenant.id}`)} />}
      {!loading && !loadError && !visibleTenants.length && <Button variant="outline" onClick={() => { setCompanySearch(""); setStatusFilter("all"); setAccountGroupFilter("all"); setMetricFilter("all"); }}>{tAdmin("Clear filters")}</Button>}
      </>}
      {selectedCompany && <CompanyDetail key={selectedCompany.id} tenant={selectedCompany} features={FEATURE_OPTIONS}
        ownerCount={tenants.filter(tenant => tenant.ownerUserId === selectedCompany.ownerUserId).length}
        refreshing={refreshingStoreCountId === selectedCompany.id}
        onBack={() => navigate("/admin/erp")}
        onContract={() => openContractEditor(selectedCompany)}
        onPassword={() => { setOwnerPassword(""); setConfirmOwnerPassword(""); setPasswordTenant(selectedCompany); }}
        onDomain={() => openDomainEditor(selectedCompany)}
        onWebStore={() => openWebStoreEditor(selectedCompany)}
        onFeatures={() => openFeatureEditor(selectedCompany)}
        onRefresh={() => void refreshStoreCount(selectedCompany)}
        onImport={() => openBackupImport(selectedCompany)}
        onStatus={status => updateStatus(selectedCompany, status)}
        onCatalog={mode => updateProductCatalogMode(selectedCompany, mode)}
      />}

      <Dialog
        open={Boolean(passwordTenant)}
        onOpenChange={(open) => { if (!open && !savingOwnerPassword) closePasswordDialog(); }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tAdmin("Change owner password")}</DialogTitle>
            <p className="text-sm text-muted-foreground">
              {passwordTenant?.companyName} · {passwordTenant?.ownerEmail}
            </p>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => { event.preventDefault(); void changeOwnerPassword(); }}
          >
            <p className="text-sm text-muted-foreground">
              {tAdmin("This changes the owner's Platform and ERP login password. Their Platform refresh sessions and old reset links will be invalidated.")}
              {" "}{tAdmin("Open ERP sessions will be signed out.")}
            </p>
            <div className="space-y-2">
              <label htmlFor="erp-owner-new-password" className="text-sm font-medium">{tAdmin("New password")}</label>
              <Input id="erp-owner-new-password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={ownerPassword} onChange={(event) => setOwnerPassword(event.target.value)} />
            </div>
            <div className="space-y-2">
              <label htmlFor="erp-owner-confirm-password" className="text-sm font-medium">{tAdmin("Confirm new password")}</label>
              <Input id="erp-owner-confirm-password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={confirmOwnerPassword} onChange={(event) => setConfirmOwnerPassword(event.target.value)} />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={savingOwnerPassword}>
                {savingOwnerPassword ? tAdmin("Saving...") : tAdmin("Change password")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(importTenant)}
        onOpenChange={(open) => {
          if (!open && !importing) {
            setImportTenant(null);
            setBackupFile(null);
            setConfirmBackup(false);
            setImportError("");
          }
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{tAdmin("Import ERP and Web Store backup")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
              <p className="font-medium">
                {importTenant?.companyName} · {tAdmin("Tenant")} #{importTenant?.id}
              </p>
              <p className="mt-1 text-muted-foreground">
                {tAdmin("ERP tables and their required types are copied. Unrelated schema data is excluded, and the old database is never changed.")}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {tAdmin("The archive is processed temporarily and removed afterward. Separately stored images and files are not inside a database backup.")}
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="erp-backup-file">
                {tAdmin("PostgreSQL custom archive")}
              </label>
              <Input
                id="erp-backup-file"
                type="file"
                accept=".dump,.backup,application/octet-stream"
                onChange={(event) => {
                  setBackupFile(event.target.files?.[0] ?? null);
                  setImportError("");
                }}
                disabled={importing}
                data-testid="input-erp-backup-file"
              />
              <p className="text-xs text-muted-foreground">
                {tAdmin("Use a .dump or .backup file, up to 2 GB.")}
                {backupFile ? ` ${backupFile.name} (${(backupFile.size / (1024 * 1024)).toFixed(1)} MB)` : ""}
              </p>
            </div>
            <div className="flex items-start gap-3">
              <Switch
                id="erp-backup-confirm"
                checked={confirmBackup}
                onCheckedChange={setConfirmBackup}
                disabled={importing}
                data-testid="switch-confirm-erp-backup"
              />
              <label className="text-sm" htmlFor="erp-backup-confirm">
                {tAdmin("I confirm this backup belongs to the company shown above.")}
              </label>
            </div>
            {importError && (
              <p className="text-sm text-destructive" role="alert" data-testid="status-erp-import-error">
                {importError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              onClick={() => void submitBackupImport()}
              disabled={!backupFile || backupFile.size === 0 || !confirmBackup || importing || backupFile.size > 2 * 1024 * 1024 * 1024}
              data-testid="button-submit-erp-backup"
            >
              {importing ? tAdmin("Importing backup…") : tAdmin("Import backup")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(contractTenant)}
        onOpenChange={(open) => !open && setContractTenant(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{tAdmin("Manage ERP contract")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <p className="font-medium">{contractTenant?.companyName}</p>
              <p className="text-xs text-muted-foreground">
                {contractTenant?.ownerEmail ?? ""}
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="erp-contract-period">
                  {tAdmin("Contract term")}
                </label>
                <Select
                  value={contractPeriod}
                  onValueChange={(value) => setContractPeriod(value as "monthly" | "yearly")}
                >
                  <SelectTrigger id="erp-contract-period">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">{tAdmin("Monthly")}</SelectItem>
                    <SelectItem value="yearly">{tAdmin("Yearly")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-sm font-medium" htmlFor="erp-contract-start">
                    {tAdmin("Contract start date")}
                  </label>
                  {contractTenant?.contractEndsAt && (
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-xs"
                      onClick={renewFromCurrentExpiry}
                    >
                      {tAdmin("Renew from current expiry")}
                    </Button>
                  )}
                </div>
                <Input
                  id="erp-contract-start"
                  type="date"
                  value={contractStartsAt}
                  onChange={(event) => setContractStartsAt(event.target.value)}
                  required
                />
              </div>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-sm font-medium">
                {tAdmin("Contract expiry")}:{" "}
                {formatDate(previewContractEndDate(contractStartsAt, contractPeriod))}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {tAdmin("Access ends at the start of the expiry date.")}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setContractTenant(null)}
              disabled={savingContract}
            >
              {tAdmin("Cancel")}
            </Button>
            <Button
              onClick={() => void saveContract()}
              disabled={savingContract || !contractStartsAt}
            >
              {savingContract ? tAdmin("Saving...") : tAdmin("Save contract")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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