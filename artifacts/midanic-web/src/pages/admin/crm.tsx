import { useEffect, useState, useCallback } from 'react';
import {
  adminApi,
  type ContactMessage, type TrialRequest, type DemoRequest, type NewsletterSubscriber,
} from '@/lib/admin-api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { ChevronLeft, ChevronRight, Mail, MailOpen } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30',
  approved: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  expired: 'bg-gray-100 text-gray-600',
  scheduled: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const TRIAL_STATUSES = ['pending', 'approved', 'rejected', 'expired'];
const DEMO_STATUSES = ['pending', 'scheduled', 'completed', 'cancelled'];

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

export default function AdminCRM() {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [msgTotal, setMsgTotal] = useState(0);
  const [msgPage, setMsgPage] = useState(1);

  const [trials, setTrials] = useState<TrialRequest[]>([]);
  const [trialTotal, setTrialTotal] = useState(0);
  const [trialPage, setTrialPage] = useState(1);

  const [demos, setDemos] = useState<DemoRequest[]>([]);
  const [demoTotal, setDemoTotal] = useState(0);
  const [demoPage, setDemoPage] = useState(1);

  const [subscribers, setSubscribers] = useState<NewsletterSubscriber[]>([]);
  const [subTotal, setSubTotal] = useState(0);
  const [subPage, setSubPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [m, t, d, s] = await Promise.all([
        adminApi.listContactMessages({ page: msgPage }),
        adminApi.listTrialRequests({ page: trialPage }),
        adminApi.listDemoRequests({ page: demoPage }),
        adminApi.listNewsletter({ page: subPage }),
      ]);
      setMessages(m.messages); setMsgTotal(m.total);
      setTrials(t.requests); setTrialTotal(t.total);
      setDemos(d.requests); setDemoTotal(d.total);
      setSubscribers(s.subscribers); setSubTotal(s.total);
    } catch (e: unknown) {
      toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [msgPage, trialPage, demoPage, subPage, toast]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const toggleRead = async (id: number, isRead: boolean) => {
    try {
      const updated = await adminApi.updateContactMessage(id, { isRead });
      setMessages((prev) => prev.map((m) => (m.id === id ? updated : m)));
    } catch (e: unknown) {
      toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' });
    }
  };

  const updateTrialStatus = async (id: number, status: string) => {
    try {
      const updated = await adminApi.updateTrialRequest(id, { status });
      setTrials((prev) => prev.map((t) => (t.id === id ? updated : t)));
    } catch (e: unknown) {
      toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' });
    }
  };

  const updateDemoStatus = async (id: number, status: string) => {
    try {
      const updated = await adminApi.updateDemoRequest(id, { status });
      setDemos((prev) => prev.map((d) => (d.id === id ? updated : d)));
    } catch (e: unknown) {
      toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">CRM</h1>
        <p className="text-muted-foreground text-sm mt-1">Contact messages, trial & demo requests, newsletter</p>
      </div>

      <Tabs defaultValue="messages">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="messages">Contact ({msgTotal})</TabsTrigger>
          <TabsTrigger value="trials">Trials ({trialTotal})</TabsTrigger>
          <TabsTrigger value="demos">Demos ({demoTotal})</TabsTrigger>
          <TabsTrigger value="newsletter">Newsletter ({subTotal})</TabsTrigger>
        </TabsList>

        {/* Contact Messages */}
        <TabsContent value="messages" className="mt-4 space-y-3">
          <div className="rounded-md border bg-background">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading
                  ? <TableRow><TableCell colSpan={5} className="text-center py-8"><div className="h-4 w-32 mx-auto animate-pulse rounded bg-muted" /></TableCell></TableRow>
                  : messages.length === 0
                  ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No messages</TableCell></TableRow>
                  : messages.map((m) => (
                    <TableRow key={m.id} className={m.isRead ? 'opacity-60' : ''}>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleRead(m.id, !m.isRead)}>
                          {m.isRead ? <MailOpen className="h-3.5 w-3.5" /> : <Mail className="h-3.5 w-3.5 text-primary" />}
                        </Button>
                      </TableCell>
                      <TableCell className="font-medium text-sm">{m.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{m.email}</TableCell>
                      <TableCell className="text-sm max-w-xs truncate">{m.subject}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{new Date(m.createdAt).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
          <Pagination total={msgTotal} page={msgPage} onPage={setMsgPage} />
        </TabsContent>

        {/* Trial Requests */}
        <TabsContent value="trials" className="mt-4 space-y-3">
          <div className="rounded-md border bg-background">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading
                  ? <TableRow><TableCell colSpan={6}><div className="h-4 w-32 mx-auto animate-pulse rounded bg-muted my-4" /></TableCell></TableRow>
                  : trials.length === 0
                  ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No trial requests</TableCell></TableRow>
                  : trials.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium text-sm">{t.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{t.email}</TableCell>
                      <TableCell className="text-sm">{t.companyName}</TableCell>
                      <TableCell className="text-sm">{t.productName ?? t.productId}</TableCell>
                      <TableCell>
                        <Select value={t.status} onValueChange={(v) => updateTrialStatus(t.id, v)}>
                          <SelectTrigger className="h-7 w-28 text-xs">
                            <SelectValue>
                              <Badge className={`text-xs ${STATUS_COLORS[t.status] ?? ''}`}>{t.status}</Badge>
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {TRIAL_STATUSES.map((s) => (
                              <SelectItem key={s} value={s}>
                                <Badge className={`text-xs ${STATUS_COLORS[s] ?? ''}`}>{s}</Badge>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{new Date(t.createdAt).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
          <Pagination total={trialTotal} page={trialPage} onPage={setTrialPage} />
        </TabsContent>

        {/* Demo Requests */}
        <TabsContent value="demos" className="mt-4 space-y-3">
          <div className="rounded-md border bg-background">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Preferred Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading
                  ? <TableRow><TableCell colSpan={6}><div className="h-4 w-32 mx-auto animate-pulse rounded bg-muted my-4" /></TableCell></TableRow>
                  : demos.length === 0
                  ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No demo requests</TableCell></TableRow>
                  : demos.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium text-sm">{d.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{d.email}</TableCell>
                      <TableCell className="text-sm">{d.companyName}</TableCell>
                      <TableCell className="text-sm">{d.productName ?? d.productId}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{d.preferredDate ?? '—'}</TableCell>
                      <TableCell>
                        <Select value={d.status} onValueChange={(v) => updateDemoStatus(d.id, v)}>
                          <SelectTrigger className="h-7 w-28 text-xs">
                            <SelectValue>
                              <Badge className={`text-xs ${STATUS_COLORS[d.status] ?? ''}`}>{d.status}</Badge>
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {DEMO_STATUSES.map((s) => (
                              <SelectItem key={s} value={s}>
                                <Badge className={`text-xs ${STATUS_COLORS[s] ?? ''}`}>{s}</Badge>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
          <Pagination total={demoTotal} page={demoPage} onPage={setDemoPage} />
        </TabsContent>

        {/* Newsletter */}
        <TabsContent value="newsletter" className="mt-4 space-y-3">
          <div className="rounded-md border bg-background">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead>Subscribed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading
                  ? <TableRow><TableCell colSpan={4}><div className="h-4 w-32 mx-auto animate-pulse rounded bg-muted my-4" /></TableCell></TableRow>
                  : subscribers.length === 0
                  ? <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No subscribers</TableCell></TableRow>
                  : subscribers.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium text-sm">{s.email}</TableCell>
                      <TableCell className="text-sm">{s.name ?? '—'}</TableCell>
                      <TableCell>
                        <Badge className={s.isActive ? 'bg-green-100 text-green-700 dark:bg-green-900/30' : 'bg-gray-100 text-gray-600'}>
                          {s.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{new Date(s.createdAt).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
          <Pagination total={subTotal} page={subPage} onPage={setSubPage} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
