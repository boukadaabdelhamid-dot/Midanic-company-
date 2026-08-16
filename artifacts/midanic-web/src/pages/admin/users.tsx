import { useEffect, useState, useCallback } from 'react';
import {
  adminApi,
  type AdminUser,
  type CustomerEntitlement,
  type EntitlementHistoryEntry,
} from '@/lib/admin-api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Search, ChevronLeft, ChevronRight, Store, Users, HardDrive, History } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const ROLE_OPTIONS = ['customer', 'super_admin', 'admin', 'support', 'billing'];

const ROLE_COLORS: Record<string, string> = {
  super_admin: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  admin: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  support: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  billing: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  customer: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
};

// ── Entitlements panel ───────────────────────────────────────────────────────
interface EntitlementFieldProps {
  label: string;
  icon: React.ElementType;
  value: number | null;
  unlimited: boolean;
  onUnlimitedChange: (v: boolean) => void;
  onValueChange: (v: number) => void;
}

function EntitlementField({ label, icon: Icon, value, unlimited, onUnlimitedChange, onValueChange }: EntitlementFieldProps) {
  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-1.5 text-sm font-medium">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        {label}
      </Label>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Switch
            id={`unlimited-${label}`}
            checked={unlimited}
            onCheckedChange={onUnlimitedChange}
          />
          <Label htmlFor={`unlimited-${label}`} className="text-xs text-muted-foreground cursor-pointer">
            Unlimited
          </Label>
        </div>
        {!unlimited && (
          <Input
            type="number"
            min={1}
            className="h-8 w-28 text-sm"
            value={value ?? ''}
            onChange={(e) => onValueChange(Number(e.target.value))}
            placeholder="e.g. 5"
          />
        )}
        {unlimited && (
          <span className="text-sm text-muted-foreground italic">∞ no limit</span>
        )}
      </div>
    </div>
  );
}

function formatVal(v: number | null): string {
  return v === null ? '∞' : String(v);
}

interface EntitlementsPanelProps {
  user: AdminUser;
  onClose: () => void;
}

function EntitlementsPanel({ user, onClose }: EntitlementsPanelProps) {
  const [ent, setEnt] = useState<CustomerEntitlement | null>(null);
  const [history, setHistory] = useState<EntitlementHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Local editable state
  const [maxStores, setMaxStores] = useState<number | null>(null);
  const [maxUsers, setMaxUsers] = useState<number | null>(null);
  const [storageGb, setStorageGb] = useState<number | null>(null);
  const [unlimitedStores, setUnlimitedStores] = useState(true);
  const [unlimitedUsers, setUnlimitedUsers] = useState(true);
  const [unlimitedStorage, setUnlimitedStorage] = useState(true);

  const { toast } = useToast();

  useEffect(() => {
    setLoading(true);
    adminApi.getCustomerEntitlements(user.id)
      .then(({ entitlements, history }) => {
        setEnt(entitlements);
        setHistory(history);
        setMaxStores(entitlements.maxStores);
        setMaxUsers(entitlements.maxUsers);
        setStorageGb(entitlements.storageGb);
        setUnlimitedStores(entitlements.maxStores === null);
        setUnlimitedUsers(entitlements.maxUsers === null);
        setUnlimitedStorage(entitlements.storageGb === null);
      })
      .catch((e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }))
      .finally(() => setLoading(false));
  }, [user.id, toast]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await adminApi.updateCustomerEntitlements(user.id, {
        maxStores: unlimitedStores ? null : (maxStores ?? null),
        maxUsers: unlimitedUsers ? null : (maxUsers ?? null),
        storageGb: unlimitedStorage ? null : (storageGb ?? null),
      });
      setEnt(updated);
      // Refresh history
      const { history: newHistory } = await adminApi.getCustomerEntitlements(user.id);
      setHistory(newHistory);
      toast({ title: 'Entitlements saved', description: `Limits updated for ${user.firstName} ${user.lastName}` });
    } catch (e: unknown) {
      toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 py-2">
      {/* Current summary */}
      {ent && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Stores', value: ent.maxStores, icon: Store, color: 'text-blue-500' },
            { label: 'Users', value: ent.maxUsers, icon: Users, color: 'text-green-500' },
            { label: 'Storage (GB)', value: ent.storageGb, icon: HardDrive, color: 'text-purple-500' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="rounded-lg border bg-muted/30 p-3 text-center">
              <Icon className={`h-4 w-4 mx-auto mb-1 ${color}`} />
              <div className="text-lg font-bold">{formatVal(value)}</div>
              <div className="text-xs text-muted-foreground">{label}</div>
            </div>
          ))}
        </div>
      )}

      <Separator />

      {/* Edit form */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold">Edit Limits</h3>
        {loading ? (
          <div className="space-y-3">
            {[0,1,2].map(i => <div key={i} className="h-10 animate-pulse rounded bg-muted" />)}
          </div>
        ) : (
          <>
            <EntitlementField
              label="Max Stores / Branches"
              icon={Store}
              value={maxStores}
              unlimited={unlimitedStores}
              onUnlimitedChange={(v) => { setUnlimitedStores(v); if (v) setMaxStores(null); }}
              onValueChange={setMaxStores}
            />
            <EntitlementField
              label="Max Users"
              icon={Users}
              value={maxUsers}
              unlimited={unlimitedUsers}
              onUnlimitedChange={(v) => { setUnlimitedUsers(v); if (v) setMaxUsers(null); }}
              onValueChange={setMaxUsers}
            />
            <EntitlementField
              label="Storage (GB)"
              icon={HardDrive}
              value={storageGb}
              unlimited={unlimitedStorage}
              onUnlimitedChange={(v) => { setUnlimitedStorage(v); if (v) setStorageGb(null); }}
              onValueChange={setStorageGb}
            />
            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? 'Saving…' : 'Save Limits'}
            </Button>
          </>
        )}
      </div>

      {/* History */}
      {history.length > 0 && (
        <>
          <Separator />
          <div>
            <button
              className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setShowHistory((v) => !v)}
            >
              <History className="h-3.5 w-3.5" />
              Change History ({history.length})
            </button>
            {showHistory && (
              <div className="mt-3 space-y-2">
                {history.map((h) => (
                  <div key={h.id} className="rounded-md border bg-muted/30 p-3 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-foreground">{h.changedByEmail ?? 'System'}</span>
                      <span className="text-muted-foreground">{new Date(h.createdAt).toLocaleString()}</span>
                    </div>
                    <div className="text-muted-foreground">
                      {h.oldValues && (
                        <span className="line-through mr-2 text-red-400">
                          Stores:{formatVal(h.oldValues.maxStores)} Users:{formatVal(h.oldValues.maxUsers)} Storage:{formatVal(h.oldValues.storageGb)}GB
                        </span>
                      )}
                      <span className="text-green-500">
                        Stores:{formatVal(h.newValues.maxStores)} Users:{formatVal(h.newValues.maxUsers)} Storage:{formatVal(h.newValues.storageGb)}GB
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <Button variant="outline" className="w-full" onClick={onClose}>Close</Button>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const { toast } = useToast();

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.listUsers({ page, limit: 20, search: search || undefined });
      setUsers(res.users);
      setTotal(res.total);
    } catch (e: unknown) {
      toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [page, search, toast]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  };

  const handleRoleChange = async (id: number, role: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await adminApi.updateUser(id, { role });
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, role } : u)));
      toast({ title: 'Role updated' });
    } catch (e: unknown) {
      toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' });
    }
  };

  const handleToggleActive = async (id: number, isActive: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await adminApi.updateUser(id, { isActive });
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, isActive } : u)));
      toast({ title: isActive ? 'User activated' : 'User deactivated' });
    } catch (e: unknown) {
      toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' });
    }
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-muted-foreground text-sm mt-1">{total} total users</p>
        </div>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email…"
            className="pl-8"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <Button type="submit" variant="secondary">Search</Button>
        {search && (
          <Button type="button" variant="ghost" onClick={() => { setSearch(''); setSearchInput(''); setPage(1); }}>
            Clear
          </Button>
        )}
      </form>

      <div className="rounded-md border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Active</TableHead>
              <TableHead>Joined</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}><div className="h-4 w-24 animate-pulse rounded bg-muted" /></TableCell>
                    ))}
                  </TableRow>
                ))
              : users.length === 0
              ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No users found
                  </TableCell>
                </TableRow>
              )
              : users.map((u) => (
                <TableRow
                  key={u.id}
                  className="cursor-pointer hover:bg-muted/40 transition-colors"
                  onClick={() => setSelectedUser(u)}
                  title="Click to view / edit entitlements"
                >
                  <TableCell className="font-medium">
                    {u.firstName} {u.lastName}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{u.email}</TableCell>
                  <TableCell className="text-sm">{u.companyName ?? '—'}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Select value={u.role} onValueChange={(val) => handleRoleChange(u.id, val, { stopPropagation: () => {} } as React.MouseEvent)}>
                      <SelectTrigger className="w-36 h-7 text-xs" onClick={(e) => e.stopPropagation()}>
                        <SelectValue>
                          <Badge className={`text-xs font-medium ${ROLE_COLORS[u.role] ?? ''}`}>
                            {u.role}
                          </Badge>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {ROLE_OPTIONS.map((r) => (
                          <SelectItem key={r} value={r}>
                            <span className={`text-xs font-medium ${ROLE_COLORS[r] ?? ''}`}>{r}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Switch
                      checked={u.isActive}
                      onCheckedChange={(val) => handleToggleActive(u.id, val, { stopPropagation: () => {} } as React.MouseEvent)}
                    />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Page {page} of {totalPages}</span>
          <div className="flex gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Entitlements slide-over */}
      <Sheet open={!!selectedUser} onOpenChange={(open) => { if (!open) setSelectedUser(null); }}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {selectedUser && (
            <>
              <SheetHeader className="mb-4">
                <SheetTitle>{selectedUser.firstName} {selectedUser.lastName}</SheetTitle>
                <SheetDescription className="text-xs">{selectedUser.email} · {selectedUser.companyName ?? 'No company'}</SheetDescription>
              </SheetHeader>
              <EntitlementsPanel user={selectedUser} onClose={() => setSelectedUser(null)} />
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
