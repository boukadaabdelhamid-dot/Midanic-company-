import { useEffect, useState, useCallback } from 'react';
import {
  adminApi,
  type AdminLicense,
  type AdminSubscription,
  type CreateLicenseInput,
} from '@/lib/admin-api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ChevronLeft, ChevronRight, Plus, Copy, Check, MoreHorizontal,
  ShieldCheck, ShieldOff, Ban, Trash2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  expired: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  suspended: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  revoked: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

const TYPE_LABELS: Record<string, string> = {
  trial: 'Trial',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  semi_annual: '6 Months',
  yearly: 'Yearly',
  lifetime: 'Lifetime',
};

// ── Copy key button ──────────────────────────────────────────────────────────
function CopyKey({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1.5 font-mono text-xs group"
      title="Click to copy"
    >
      <span className="truncate max-w-[140px]">{value}</span>
      {copied
        ? <Check className="h-3 w-3 text-green-500 shrink-0" />
        : <Copy className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0 transition-opacity" />}
    </button>
  );
}

// ── Create License Sheet ─────────────────────────────────────────────────────
interface CreateSheetProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (l: AdminLicense) => void;
}

function CreateLicenseSheet({ open, onOpenChange, onCreated }: CreateSheetProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<{
    userId: string;
    productId: string;
    type: string;
    maxDevices: string;
  }>({ userId: '', productId: '', type: 'trial', maxDevices: '1' });
  const [products, setProducts] = useState<{ id: number; name: string }[]>([]);

  useEffect(() => {
    if (open) {
      adminApi.listProducts().then(p => setProducts(p)).catch(() => {});
    }
  }, [open]);

  const submit = async () => {
    if (!form.productId || !form.type) {
      toast({ title: 'Missing fields', description: 'Product and type are required.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const body: CreateLicenseInput = {
        productId: Number(form.productId),
        type: form.type,
        maxDevices: Number(form.maxDevices) || 1,
      };
      if (form.userId) body.userId = Number(form.userId);
      const license = await adminApi.createLicense(body);
      toast({ title: 'License created', description: `Key: ${license.licenseKey}` });
      onCreated(license);
      onOpenChange(false);
      setForm({ userId: '', productId: '', type: 'trial', maxDevices: '1' });
    } catch (e: unknown) {
      toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>New License</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-1.5">
            <Label>Product *</Label>
            <Select
              value={form.productId}
              onValueChange={v => setForm(f => ({ ...f, productId: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select product" />
              </SelectTrigger>
              <SelectContent>
                {products.map(p => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>License Type *</Label>
            <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(TYPE_LABELS).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>User ID <span className="text-muted-foreground">(optional)</span></Label>
            <Input
              placeholder="e.g. 42"
              value={form.userId}
              onChange={e => setForm(f => ({ ...f, userId: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">Leave empty to create an unassigned license.</p>
          </div>

          <div className="space-y-1.5">
            <Label>Max Devices</Label>
            <Input
              type="number"
              min={1}
              value={form.maxDevices}
              onChange={e => setForm(f => ({ ...f, maxDevices: e.target.value }))}
            />
          </div>
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? 'Creating…' : 'Create License'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function AdminLicenses() {
  const [licenses, setLicenses] = useState<AdminLicense[]>([]);
  const [lTotal, setLTotal] = useState(0);
  const [lPage, setLPage] = useState(1);
  const [subscriptions, setSubscriptions] = useState<AdminSubscription[]>([]);
  const [sTotal, setSTotal] = useState(0);
  const [sPage, setSPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminLicense | null>(null);
  const { toast } = useToast();

  const fetchLicenses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.listLicenses({ page: lPage, limit: 20 });
      setLicenses(res.licenses);
      setLTotal(res.total);
    } catch (e: unknown) {
      toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [lPage, toast]);

  const fetchSubscriptions = useCallback(async () => {
    try {
      const res = await adminApi.listSubscriptions({ page: sPage, limit: 20 });
      setSubscriptions(res.subscriptions);
      setSTotal(res.total);
    } catch (e: unknown) {
      toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' });
    }
  }, [sPage, toast]);

  useEffect(() => { fetchLicenses(); }, [fetchLicenses]);
  useEffect(() => { fetchSubscriptions(); }, [fetchSubscriptions]);

  const changeStatus = async (license: AdminLicense, status: string) => {
    try {
      const updated = await adminApi.updateLicense(license.id, { status });
      setLicenses(ls => ls.map(l => l.id === updated.id ? updated : l));
      toast({ title: 'Status updated', description: `License is now ${status}.` });
    } catch (e: unknown) {
      toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' });
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await adminApi.deleteLicense(deleteTarget.id);
      setLicenses(ls => ls.filter(l => l.id !== deleteTarget.id));
      setLTotal(t => t - 1);
      toast({ title: 'License deleted' });
    } catch (e: unknown) {
      toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setDeleteTarget(null);
    }
  };

  const onCreated = (license: AdminLicense) => {
    setLicenses(ls => [license, ...ls]);
    setLTotal(t => t + 1);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Licenses & Subscriptions</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage customer licenses and subscriptions</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New License
        </Button>
      </div>

      <Tabs defaultValue="licenses">
        <TabsList>
          <TabsTrigger value="licenses">Licenses ({lTotal})</TabsTrigger>
          <TabsTrigger value="subscriptions">Subscriptions ({sTotal})</TabsTrigger>
        </TabsList>

        <TabsContent value="licenses" className="mt-4 space-y-3">
          <div className="rounded-md border bg-background">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>License Key</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Devices</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading
                  ? Array.from({ length: 4 }).map((_, i) => (
                      <TableRow key={i}>{Array.from({ length: 8 }).map((_, j) => (
                        <TableCell key={j}><div className="h-4 w-20 animate-pulse rounded bg-muted" /></TableCell>
                      ))}</TableRow>
                    ))
                  : licenses.length === 0
                  ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-12">
                        <div className="space-y-2">
                          <p className="font-medium">No licenses yet</p>
                          <p className="text-xs">Click "New License" to create the first one.</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                  : licenses.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>
                        <CopyKey value={l.licenseKey} />
                      </TableCell>
                      <TableCell className="text-sm">
                        {l.userEmail
                          ? <span>{l.userEmail}</span>
                          : <span className="text-muted-foreground italic">Unassigned</span>}
                      </TableCell>
                      <TableCell className="text-sm">{l.productName ?? `#${l.productId}`}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {TYPE_LABELS[l.type] ?? l.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-center">
                        <span className={l.activatedDevices >= (l.maxDevices ?? 1) ? 'text-red-500 font-medium' : ''}>
                          {l.activatedDevices}/{l.maxDevices ?? 1}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-xs ${STATUS_COLORS[l.status] ?? ''}`}>{l.status}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {l.expiresAt ? new Date(l.expiresAt).toLocaleDateString() : '—'}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {l.status !== 'active' && (
                              <DropdownMenuItem onClick={() => changeStatus(l, 'active')}>
                                <ShieldCheck className="h-4 w-4 mr-2 text-green-500" />
                                Activate
                              </DropdownMenuItem>
                            )}
                            {l.status === 'active' && (
                              <DropdownMenuItem onClick={() => changeStatus(l, 'suspended')}>
                                <ShieldOff className="h-4 w-4 mr-2 text-yellow-500" />
                                Suspend
                              </DropdownMenuItem>
                            )}
                            {l.status !== 'revoked' && (
                              <DropdownMenuItem onClick={() => changeStatus(l, 'revoked')}>
                                <Ban className="h-4 w-4 mr-2 text-gray-500" />
                                Revoke
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-red-600 focus:text-red-600"
                              onClick={() => setDeleteTarget(l)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
          <Pagination total={lTotal} page={lPage} onPage={setLPage} />
        </TabsContent>

        <TabsContent value="subscriptions" className="mt-4 space-y-3">
          <div className="rounded-md border bg-background">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Period Start</TableHead>
                  <TableHead>Period End</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscriptions.length === 0
                  ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No subscriptions
                      </TableCell>
                    </TableRow>
                  )
                  : subscriptions.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="text-sm">{s.userEmail ?? s.userId}</TableCell>
                      <TableCell className="text-sm">{s.productName ?? s.productId}</TableCell>
                      <TableCell>
                        <Badge className={`text-xs ${STATUS_COLORS[s.status] ?? ''}`}>{s.status}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {s.currentPeriodStart ? new Date(s.currentPeriodStart).toLocaleDateString() : '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {s.currentPeriodEnd ? new Date(s.currentPeriodEnd).toLocaleDateString() : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
          <Pagination total={sTotal} page={sPage} onPage={setSPage} />
        </TabsContent>
      </Tabs>

      <CreateLicenseSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={onCreated}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this license?</AlertDialogTitle>
            <AlertDialogDescription>
              License <span className="font-mono text-foreground">{deleteTarget?.licenseKey}</span> will be permanently deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={confirmDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Pagination({ total, page, onPage }: { total: number; page: number; onPage: (p: number) => void }) {
  const totalPages = Math.ceil(total / 20);
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between text-sm text-muted-foreground">
      <span>Page {page} of {totalPages}</span>
      <div className="flex gap-1">
        <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 1} onClick={() => onPage(page - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === totalPages} onClick={() => onPage(page + 1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
