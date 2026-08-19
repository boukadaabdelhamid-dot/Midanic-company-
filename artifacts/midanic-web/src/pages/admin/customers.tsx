import { useEffect, useState } from 'react';
import { adminApi, type AdminCustomer } from '@/lib/admin-api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { Search, Download, Mail, MessageCircle, ChevronLeft, ChevronRight, UserRound } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const dateTime = (value: string | null) => value
  ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  : 'Never';

function CustomerEditor({ customer, onSaved }: { customer: AdminCustomer; onSaved: (customer: AdminCustomer) => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    firstName: customer.firstName, lastName: customer.lastName, email: customer.email,
    companyName: customer.companyName ?? '', phone: customer.phone ?? '', address: customer.address ?? '',
  });
  const [saving, setSaving] = useState(false);
  const set = (key: keyof typeof form, value: string) => setForm((previous) => ({ ...previous, [key]: value }));
  const save = async () => {
    setSaving(true);
    try {
      const updated = await adminApi.updateCustomer(customer.id, form);
      onSaved(updated);
      toast({ title: 'Customer updated' });
    } catch (error) {
      toast({ title: 'Could not update customer', description: (error as Error).message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1 text-sm"><span>First name</span><Input value={form.firstName} onChange={(e) => set('firstName', e.target.value)} /></label>
        <label className="space-y-1 text-sm"><span>Last name</span><Input value={form.lastName} onChange={(e) => set('lastName', e.target.value)} /></label>
      </div>
      <label className="space-y-1 text-sm block"><span>Email</span><Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} /></label>
      <label className="space-y-1 text-sm block"><span>Phone</span><Input value={form.phone} onChange={(e) => set('phone', e.target.value)} /></label>
      <label className="space-y-1 text-sm block"><span>Company</span><Input value={form.companyName} onChange={(e) => set('companyName', e.target.value)} /></label>
      <label className="space-y-1 text-sm block"><span>Address</span><Textarea value={form.address} onChange={(e) => set('address', e.target.value)} rows={3} /></label>
      <Button className="w-full" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Button>
    </div>
  );
}

export default function AdminCustomers() {
  const { toast } = useToast();
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [selected, setSelected] = useState<AdminCustomer | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [erpLink, setErpLink] = useState<{ id: number; createdAt: string; launchUrl?: string } | null>(null);

  const load = () => {
    setLoading(true);
    adminApi.listCustomers({ page, limit: 20, search: search || undefined })
      .then((result) => { setCustomers(result.customers); setTotal(result.total); })
      .catch((error) => toast({ title: 'Could not load customers', description: error.message, variant: 'destructive' }))
      .finally(() => setLoading(false));
  };
  useEffect(load, [page, search]);
  useEffect(() => {
    if (!selected) {
      setErpLink(null);
      return;
    }
    setErpLink(null);
    adminApi.getCustomerErpLink(selected.id)
      .then((result) => setErpLink(result.link))
      .catch((error) => toast({ title: 'Could not load ERP link status', description: error.message, variant: 'destructive' }));
  }, [selected?.id]);

  const toggleStatus = async (customer: AdminCustomer) => {
    try {
      const updated = await adminApi.updateCustomer(customer.id, { isActive: !customer.isActive });
      setCustomers((current) => current.map((item) => item.id === updated.id ? updated : item));
      if (selected?.id === updated.id) setSelected(updated);
      toast({ title: updated.isActive ? 'Customer activated' : 'Customer suspended' });
    } catch (error) {
      toast({ title: 'Could not change status', description: (error as Error).message, variant: 'destructive' });
    }
  };
  const exportCustomers = async () => {
    try {
      const blob = await adminApi.exportCustomers();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = 'midanic-customers.csv'; link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast({ title: 'Could not export customers', description: (error as Error).message, variant: 'destructive' });
    }
  };
  const createErpLink = async (customer: AdminCustomer) => {
    try {
      const result = await adminApi.createCustomerErpLink(customer.id);
      setErpLink(result);
      toast({ title: 'Permanent ERP link created', description: 'It remains active until deleted.' });
    } catch (error) {
      toast({ title: 'Could not create ERP link', description: (error as Error).message, variant: 'destructive' });
    }
  };
  const deleteErpLink = async (customer: AdminCustomer) => {
    try {
      await adminApi.deleteCustomerErpLink(customer.id);
      setErpLink(null);
      toast({ title: 'ERP link deleted' });
    } catch (error) {
      toast({ title: 'Could not delete ERP link', description: (error as Error).message, variant: 'destructive' });
    }
  };
  const totalPages = Math.max(1, Math.ceil(total / 20));

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-2xl font-bold">Customers</h1><p className="text-sm text-muted-foreground">{total} registered customers</p></div>
        <Button variant="outline" onClick={exportCustomers}><Download className="mr-2 h-4 w-4" />Export CSV</Button>
      </div>
      <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); setPage(1); setSearch(searchInput.trim()); }}>
        <div className="relative flex-1 max-w-md"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-8" placeholder="Search name, email, company or phone…" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} /></div>
        <Button type="submit">Search</Button>
        {search && <Button type="button" variant="ghost" onClick={() => { setSearch(''); setSearchInput(''); setPage(1); }}>Clear</Button>}
      </form>
      <div className="rounded-md border bg-background overflow-x-auto">
        <Table>
          <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead>Contact</TableHead><TableHead>Company</TableHead><TableHead>Status</TableHead><TableHead>Registered</TableHead><TableHead>Last login</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {loading ? <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">Loading customers…</TableCell></TableRow>
              : customers.length === 0 ? <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">No customers found.</TableCell></TableRow>
              : customers.map((customer) => (
                <TableRow key={customer.id} className="cursor-pointer" onClick={() => setSelected(customer)}>
                  <TableCell><div className="font-medium">{customer.firstName} {customer.lastName}</div><div className="text-xs text-muted-foreground">{customer.address || 'No address'}</div></TableCell>
                  <TableCell><div>{customer.email}</div><div className="text-xs text-muted-foreground">{customer.phone || 'No phone'}</div></TableCell>
                  <TableCell>{customer.companyName || '—'}</TableCell>
                  <TableCell><Badge variant={customer.isActive ? 'default' : 'secondary'}>{customer.isActive ? 'Active' : 'Suspended'}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{dateTime(customer.createdAt)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{dateTime(customer.lastLoginAt)}</TableCell>
                  <TableCell onClick={(event) => event.stopPropagation()}><div className="flex justify-end gap-1"><Button size="sm" variant="outline" onClick={() => setSelected(customer)}>Details</Button><Button size="sm" variant="ghost" onClick={() => toggleStatus(customer)}>{customer.isActive ? 'Suspend' : 'Activate'}</Button></div></TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between text-sm text-muted-foreground"><span>Page {page} of {totalPages}</span><div className="flex gap-1"><Button variant="outline" size="icon" disabled={page === 1} onClick={() => setPage((value) => value - 1)}><ChevronLeft className="h-4 w-4" /></Button><Button variant="outline" size="icon" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}><ChevronRight className="h-4 w-4" /></Button></div></div>
      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selected && <><SheetHeader><SheetTitle className="flex items-center gap-2"><UserRound className="h-5 w-5" />{selected.firstName} {selected.lastName}</SheetTitle><SheetDescription>Customer account details and contact actions</SheetDescription></SheetHeader>
            <div className="mt-5 space-y-5">
              <div className="flex flex-wrap gap-2"><Badge variant={selected.isActive ? 'default' : 'secondary'}>{selected.isActive ? 'Active' : 'Suspended'}</Badge><span className="text-xs text-muted-foreground self-center">Registered {dateTime(selected.createdAt)} · Last login {dateTime(selected.lastLoginAt)}</span></div>
              <div className="flex flex-wrap gap-2"><Button variant="outline" asChild disabled={!selected.phone}><a href={selected.phone ? `https://wa.me/${selected.phone.replace(/\D/g, '')}` : undefined} target="_blank" rel="noreferrer"><MessageCircle className="mr-2 h-4 w-4" />WhatsApp</a></Button><Button variant="outline" asChild><a href={`mailto:${selected.email}`}><Mail className="mr-2 h-4 w-4" />Email</a></Button><Button variant="secondary" onClick={() => toggleStatus(selected)}>{selected.isActive ? 'Suspend' : 'Activate'}</Button><Button onClick={() => createErpLink(selected)} disabled={!selected.isActive}>{erpLink ? 'Replace ERP link' : 'Grant ERP access'}</Button></div>
              {erpLink && <div className="rounded-md border bg-muted/40 p-3 space-y-2"><p className="text-sm font-medium">Permanent ERP login link</p><p className="text-xs text-muted-foreground">This link opens the ERP login page and stays valid until you delete it. The customer signs in with the same email and password.</p>{erpLink.launchUrl ? <div className="flex flex-wrap gap-2"><Input className="min-w-0 flex-1" readOnly value={erpLink.launchUrl} onFocus={(event) => event.currentTarget.select()} /><Button variant="outline" onClick={() => navigator.clipboard.writeText(erpLink.launchUrl!)}>Copy</Button><Button asChild><a href={erpLink.launchUrl} target="_blank" rel="noreferrer">Open</a></Button><Button variant="destructive" onClick={() => deleteErpLink(selected)}>Delete link</Button></div> : <div className="flex flex-wrap gap-2"><p className="text-xs text-muted-foreground self-center">A permanent link is active. For security, its text is shown only when it is created.</p><Button variant="destructive" onClick={() => deleteErpLink(selected)}>Delete link</Button></div>}</div>}
              <CustomerEditor customer={selected} onSaved={(updated) => { setSelected(updated); setCustomers((current) => current.map((item) => item.id === updated.id ? updated : item)); }} />
            </div>
          </>}
        </SheetContent>
      </Sheet>
    </div>
  );
}