import { useCallback, useEffect, useMemo, useState } from "react";
import { adminApi, type AdminCustomer, type ErpTenant } from "@/lib/admin-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { useToast } from "@/hooks/use-toast";
import { BriefcaseBusiness, Copy, ExternalLink, Globe2, Plus, RefreshCw } from "lucide-react";

const STATUS_OPTIONS = ["pending", "active", "suspended", "expired", "converted"];

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
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const { toast } = useToast();

  const loadTenants = useCallback(async () => {
    setLoading(true);
    try {
      const result = await adminApi.listErpTenants(statusFilter === "all" ? undefined : statusFilter);
      setTenants(result.tenants);
    } catch (error) {
      toast({ title: "Unable to load ERP accounts", description: (error as Error).message, variant: "destructive" });
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
          toast({ title: "Unable to load customers", description: (error as Error).message, variant: "destructive" });
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
      toast({ title: "ERP account updated" });
    } catch (error) {
      toast({ title: "Update failed", description: (error as Error).message, variant: "destructive" });
    }
  }

  async function createTenant() {
    const parsedOwnerId = Number(ownerUserId);
    if (!companyName.trim() || !Number.isInteger(parsedOwnerId) || parsedOwnerId <= 0) {
      toast({ title: "Enter a company name and a valid owner user ID", variant: "destructive" });
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
      toast({ title: "ERP account created" });
    } catch (error) {
      toast({ title: "Creation failed", description: (error as Error).message, variant: "destructive" });
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
      toast({ title: "Assign a subdomain before activating it", variant: "destructive" });
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
          ? "Domain saved inactive — activate it after DNS is ready"
          : "ERP domain updated",
      });
    } catch (error) {
      toast({ title: "Domain update failed", description: (error as Error).message, variant: "destructive" });
    } finally {
      setSavingDomain(false);
    }
  }

  async function copyHostname(hostname: string) {
    await navigator.clipboard.writeText(`https://${hostname}`);
    toast({ title: "ERP domain copied" });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <BriefcaseBusiness className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">ERP Control</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Control companies, trials, access, and lifecycle from one place.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => void loadTenants()} disabled={loading} aria-label="Refresh">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />Create ERP account</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create ERP account</DialogTitle></DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="erp-company-name">Company name</label>
                  <Input id="erp-company-name" value={companyName} onChange={(event) => setCompanyName(event.target.value)} placeholder="Company name" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="erp-owner-id">Owner user ID</label>
                  <Select value={ownerUserId} onValueChange={setOwnerUserId} disabled={loadingCustomers}>
                    <SelectTrigger id="erp-owner-id">
                      <SelectValue placeholder={loadingCustomers ? "Loading customers..." : "Select a customer"} />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((customer) => (
                        <SelectItem key={customer.id} value={String(customer.id)}>
                          {customer.firstName} {customer.lastName} — {customer.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Choose the customer who will own this ERP account.</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="erp-subdomain">Company subdomain</label>
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
                   <p className="text-xs text-muted-foreground">The domain starts inactive. After creating the account, open its domain settings and activate it once wildcard DNS is ready.</p>
                </div>
              </div>
              <DialogFooter><Button onClick={() => void createTenant()} disabled={creating}>{creating ? "Creating..." : "Create account"}</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {STATUS_OPTIONS.map((status) => (
          <button key={status} className="rounded-xl border bg-card p-4 text-left transition hover:border-primary/50" onClick={() => setStatusFilter(status)}>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{status}</p>
            <p className="mt-2 text-2xl font-semibold">{counts[status] ?? 0}</p>
          </button>
        ))}
      </div>

      <div className="flex justify-end">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUS_OPTIONS.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Company domain</TableHead>
              <TableHead>Trial ends</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Access</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">Loading ERP accounts...</TableCell></TableRow>
            ) : tenants.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">No ERP accounts found.</TableCell></TableRow>
            ) : tenants.map((tenant) => (
              <TableRow key={tenant.id}>
                <TableCell>
                  <div className="font-medium">{tenant.companyName}</div>
                  <div className="text-xs text-muted-foreground">Tenant #{tenant.id}</div>
                </TableCell>
                <TableCell>
                  <div>{[tenant.ownerFirstName, tenant.ownerLastName].filter(Boolean).join(" ") || "—"}</div>
                  <div className="text-xs text-muted-foreground">{tenant.ownerEmail || `User #${tenant.ownerUserId}`}</div>
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
                      <span className="block text-sm">{tenant.hostname ?? "Assign domain"}</span>
                      <span className="block text-xs text-muted-foreground">
                        {tenant.hostname ? tenant.domainStatus : "unassigned"}
                      </span>
                    </span>
                  </Button>
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
            <DialogTitle>Manage ERP company domain</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <p className="text-sm font-medium">{domainTenant?.companyName}</p>
              <p className="text-xs text-muted-foreground">All companies use the same shared ERP service; this hostname selects the tenant.</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="domain-subdomain">Subdomain</label>
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
              <label className="text-sm font-medium">Domain access</label>
              <Select value={domainStatus} onValueChange={(value) => setDomainStatus(value as "inactive" | "active")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="inactive">Inactive — block ERP access</SelectItem>
                  <SelectItem value="active">Active — allow ERP access</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {domainTenant?.hostname && (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => void copyHostname(domainTenant.hostname!)}>
                  <Copy className="mr-2 h-4 w-4" />Copy URL
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a href={`https://${domainTenant.hostname}`} target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" />Open
                  </a>
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDomainTenant(null)}>Cancel</Button>
            <Button onClick={() => void saveDomain()} disabled={savingDomain}>
              {savingDomain ? "Saving..." : "Save domain"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}