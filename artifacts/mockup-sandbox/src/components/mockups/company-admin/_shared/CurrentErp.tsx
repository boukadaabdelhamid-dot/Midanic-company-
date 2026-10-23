// Real ERP Control JSX extracted from admin/erp.tsx; backend side effects are stubbed.
import { useState } from 'react';
import type { ErpTenant } from './fixtures';
import { TENANTS } from './fixtures';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select,SelectContent,SelectItem,SelectTrigger,SelectValue } from '@/components/ui/select';
import { Table,TableBody,TableCell,TableHead,TableHeader,TableRow } from '@/components/ui/table';
import { BriefcaseBusiness,CalendarDays,Globe2,KeyRound,Plus,RefreshCw,Settings2,ShoppingBag,Upload } from 'lucide-react';
const STATUS_OPTIONS = ["pending", "active", "suspended", "expired", "converted"];
const ACCOUNT_GROUP_OPTIONS = [
  { value: "all", label: "All ERP accounts" },
  { value: "trial", label: "Trial accounts" },
  { value: "contracted", label: "Contracted accounts" },
  { value: "other", label: "Other accounts" },
] as const;
type AccountGroup = "trial" | "contracted" | "other";
type AccountGroupFilter = "all" | AccountGroup;
const ACCOUNT_GROUP_LABELS: Record<AccountGroup, string> = {
  trial: "Trial account",
  contracted: "Contracted account",
  other: "Other account",
};
const ACCOUNT_GROUP_STYLES: Record<AccountGroup, string> = {
  trial: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  contracted: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  other: "bg-muted text-muted-foreground",
};
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

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  suspended: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  expired: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  converted: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
};

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
export function CurrentErp({onAction}: {onAction:(label:string)=>void}) {
const tAdmin = (key:string) => key;
const [accountGroupFilter,setAccountGroupFilter] = useState<AccountGroupFilter>('all');
const [statusFilter,setStatusFilter] = useState('all');
const loading = false;
const visibleTenants = TENANTS.filter(tenant => (accountGroupFilter === 'all' || getAccountGroup(tenant) === accountGroupFilter) && (statusFilter === 'all' || tenant.status === statusFilter));
const accountGroupCounts = {all:TENANTS.length, trial:TENANTS.filter(t=>getAccountGroup(t)==='trial').length,contracted:TENANTS.filter(t=>getAccountGroup(t)==='contracted').length,other:TENANTS.filter(t=>getAccountGroup(t)==='other').length};
const loadTenants = () => onAction('Refresh');
const updateProductCatalogMode = (_tenant:ErpTenant,_value:'separate'|'shared') => onAction('Product catalog');
const openBackupImport = (_tenant:ErpTenant) => onAction('Import backup');
const openContractEditor = (_tenant:ErpTenant) => onAction('Manage contract');
const setOwnerPassword = (_value:string) => {};
const setConfirmOwnerPassword = (_value:string) => {};
const setPasswordTenant = (_tenant:ErpTenant) => onAction('Change owner password');
const openDomainEditor = (_tenant:ErpTenant) => onAction('Company domain');
const openWebStoreEditor = (_tenant:ErpTenant) => onAction('Web Store');
const openFeatureEditor = (_tenant:ErpTenant) => onAction('Manage features');
const refreshStoreCount = (_tenant:ErpTenant) => onAction('Retry store count');
const refreshingStoreCountId: number|null = null;
const updateStatus = (_tenant:ErpTenant,_value:string) => onAction('Change status');
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
<Button onClick={()=>onAction('Create ERP account')}><Plus className="mr-2 h-4 w-4" />{tAdmin('Create ERP account')}</Button>
</div></div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ACCOUNT_GROUP_OPTIONS.map((group) => (
          <button
            key={group.value}
            type="button"
            aria-pressed={accountGroupFilter === group.value}
            className={`rounded-xl border bg-card p-4 text-left transition hover:border-primary/50 ${
              accountGroupFilter === group.value ? "border-primary ring-1 ring-primary/20" : ""
            }`}
            onClick={() => {
              setAccountGroupFilter(group.value);
              setStatusFilter("all");
            }}
          >
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{tAdmin(group.label)}</p>
            <p className="mt-2 text-2xl font-semibold">{accountGroupCounts[group.value]}</p>
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
              <TableHead>{tAdmin("Contract")}</TableHead>
              <TableHead>{tAdmin("Features")}</TableHead>
             <TableHead>{tAdmin("Trial ends")}</TableHead>
              <TableHead>{tAdmin("Created")}</TableHead>
              <TableHead className="text-right">{tAdmin("Access")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
             {loading ? (
                <TableRow><TableCell colSpan={10} className="py-10 text-center text-muted-foreground">{tAdmin("Loading ERP accounts...")}</TableCell></TableRow>
             ) : visibleTenants.length === 0 ? (
                 <TableRow><TableCell colSpan={10} className="py-10 text-center text-muted-foreground">{tAdmin("No ERP accounts match the selected filters.")}</TableCell></TableRow>
             ) : visibleTenants.map((tenant) => (
              <TableRow key={tenant.id}>
                <TableCell>
                  <div className="font-medium">{tenant.companyName}</div>
                  <div className="text-xs text-muted-foreground">{tAdmin("Tenant")} #{tenant.id}</div>
                  <div className="mt-2 flex flex-col items-start gap-1">
                    <label htmlFor={`catalog-mode-${tenant.id}`} className="text-xs text-muted-foreground">
                      {tAdmin("Product catalog")}
                    </label>
                    <select
                      id={`catalog-mode-${tenant.id}`}
                      value={tenant.productCatalogMode ?? "separate"}
                      onChange={(event) => void updateProductCatalogMode(
                        tenant,
                        event.target.value as "separate" | "shared",
                      )}
                      title={tAdmin("This applies to new products; existing products stay unchanged.")}
                      className="h-8 max-w-56 rounded-md border bg-background px-2 text-xs"
                    >
                      <option value="separate">{tAdmin("Separate products by store")}</option>
                      <option value="shared">{tAdmin("Share products across stores")}</option>
                    </select>
                  </div>
                  {tenant.dataImportStatus === "completed" && (
                    <p className="mt-1 text-xs text-green-700 dark:text-green-400" data-testid={`status-import-completed-${tenant.id}`}>
                      {tAdmin("Imported")}: {tenant.dataImportSummary?.tableCount ?? 0} {tAdmin("tables")}
                    </p>
                  )}
                  {tenant.dataImportStatus === "running" && (
                    <p className="mt-1 text-xs text-muted-foreground" data-testid={`status-import-running-${tenant.id}`}>
                      {tAdmin("Backup import in progress")}
                    </p>
                  )}
                  {tenant.dataImportStatus === "failed" && tenant.dataImportSummary && (
                    <p className="mt-1 text-xs text-amber-700 dark:text-amber-400" data-testid={`status-import-retained-${tenant.id}`}>
                      {tAdmin("Imported data was retained; review required")}
                    </p>
                  )}
                  {tenant.dataImportStatus === "failed" &&
                    !tenant.dataImportSummary &&
                    tenant.dataImportError?.includes("must be checked before another upload") && (
                    <p className="mt-1 text-xs text-amber-700 dark:text-amber-400" data-testid={`status-import-review-${tenant.id}`}>
                      {tAdmin("Import status needs review before retry")}
                    </p>
                  )}
                  {(tenant.dataImportStatus === "awaiting_backup" ||
                    (tenant.dataImportStatus === "failed" &&
                     !tenant.dataImportSummary &&
                     !tenant.dataImportError?.includes("must be checked before another upload"))) && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => openBackupImport(tenant)}
                      data-testid={`button-import-backup-${tenant.id}`}
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      {tAdmin(tenant.dataImportStatus === "failed" ? "Retry backup import" : "Import backup")}
                    </Button>
                  )}
                </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      className="h-auto justify-start px-2 py-1 text-left"
                      onClick={() => openContractEditor(tenant)}
                    >
                      <CalendarDays className="mr-2 h-4 w-4 shrink-0" />
                      <span>
                        <span className="block text-sm">
                          {tenant.contractPeriod
                            ? tAdmin("Manage contract")
                            : tAdmin("Set contract")}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {tenant.contractPeriod
                            ? `${tAdmin(tenant.contractPeriod)}${tenant.contractEndsAt ? ` · ${tAdmin("Expires")} ${formatDate(tenant.contractEndsAt)}` : ""}`
                            : tAdmin("No contract set")}
                        </span>
                      </span>
                    </Button>
                  </TableCell>
                <TableCell>
                   <div>{[tenant.ownerFirstName, tenant.ownerLastName].filter(Boolean).join(" ") || "—"}</div>
                   <div className="text-xs text-muted-foreground">{tenant.ownerEmail || `${tAdmin("User")} #${tenant.ownerUserId}`}</div>
                   <Button
                     variant="outline"
                     size="sm"
                     className="mt-2"
                     onClick={() => { setOwnerPassword(""); setConfirmOwnerPassword(""); setPasswordTenant(tenant); }}
                     data-testid={`button-owner-password-${tenant.id}`}
                   >
                     <KeyRound className="mr-2 h-4 w-4" />
                     {tAdmin("Change owner password")}
                   </Button>
                </TableCell>
                 <TableCell>
                   <div className="flex flex-col items-start gap-1">
                     <Badge className={ACCOUNT_GROUP_STYLES[getAccountGroup(tenant)]}>
                       {tAdmin(ACCOUNT_GROUP_LABELS[getAccountGroup(tenant)])}
                     </Badge>
                     <Badge className={STATUS_STYLES[tenant.status] ?? ""}>{tAdmin(tenant.status)}</Badge>
                   </div>
                 </TableCell>
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
</div>
);
}
