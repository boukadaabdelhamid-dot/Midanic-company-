import { useEffect, useState, useCallback } from 'react';
import { adminApi, type AdminTicket, type TicketDetail } from '@/lib/admin-api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { ChevronLeft, ChevronRight, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const STATUS_OPTIONS = ['open', 'in_progress', 'waiting_customer', 'resolved', 'closed'];
const PRIORITY_OPTIONS = ['low', 'normal', 'high', 'urgent'];

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  in_progress: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30',
  waiting_customer: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30',
  resolved: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  closed: 'bg-gray-100 text-gray-600',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600',
  normal: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

export default function AdminTickets() {
  const [tickets, setTickets] = useState<AdminTicket[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<TicketDetail | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.listTickets({ page, status: statusFilter || undefined });
      setTickets(res.tickets);
      setTotal(res.total);
    } catch (e: unknown) {
      toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, toast]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  const openTicket = async (id: number) => {
    try {
      const detail = await adminApi.getTicket(id);
      setSelected(detail);
      setSheetOpen(true);
    } catch (e: unknown) {
      toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' });
    }
  };

  const handleStatusChange = async (id: number, status: string) => {
    try {
      await adminApi.updateTicket(id, { status });
      setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
      if (selected?.id === id) setSelected((prev) => prev ? { ...prev, status } : null);
    } catch (e: unknown) {
      toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' });
    }
  };

  const handleReply = async () => {
    if (!selected || !reply.trim()) return;
    setSending(true);
    try {
      const msg = await adminApi.replyTicket(selected.id, reply.trim());
      setSelected((prev) => prev ? { ...prev, messages: [...prev.messages, msg], status: prev.status === 'open' ? 'in_progress' : prev.status } : null);
      setTickets((prev) => prev.map((t) => t.id === selected.id ? { ...t, status: t.status === 'open' ? 'in_progress' : t.status } : t));
      setReply('');
      toast({ title: 'Reply sent' });
    } catch (e: unknown) {
      toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Support Tickets</h1>
          <p className="text-muted-foreground text-sm mt-1">{total} tickets</p>
        </div>
        <Select value={statusFilter || 'all'} onValueChange={(v) => { setStatusFilter(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ticket #</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>{Array.from({ length: 6 }).map((_, j) => (
                    <TableCell key={j}><div className="h-4 w-20 animate-pulse rounded bg-muted" /></TableCell>
                  ))}</TableRow>
                ))
              : tickets.length === 0
              ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No tickets</TableCell></TableRow>
              : tickets.map((t) => (
                <TableRow
                  key={t.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => openTicket(t.id)}
                >
                  <TableCell className="font-mono text-xs font-medium">{t.ticketNumber}</TableCell>
                  <TableCell className="text-sm">{t.userEmail ?? t.userId}</TableCell>
                  <TableCell className="text-sm max-w-xs truncate">{t.subject}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Select value={t.priority} onValueChange={async (v) => {
                      try {
                        await adminApi.updateTicket(t.id, { priority: v });
                        setTickets((prev) => prev.map((tk) => tk.id === t.id ? { ...tk, priority: v } : tk));
                      } catch (e: unknown) {
                        toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' });
                      }
                    }}>
                      <SelectTrigger className="h-7 w-24 text-xs" onClick={(e) => e.stopPropagation()}>
                        <SelectValue>
                          <Badge className={`text-xs ${PRIORITY_COLORS[t.priority] ?? ''}`}>{t.priority}</Badge>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORITY_OPTIONS.map((p) => (
                          <SelectItem key={p} value={p}>
                            <Badge className={`text-xs ${PRIORITY_COLORS[p] ?? ''}`}>{p}</Badge>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Select value={t.status} onValueChange={(v) => handleStatusChange(t.id, v)}>
                      <SelectTrigger className="h-7 w-32 text-xs" onClick={(e) => e.stopPropagation()}>
                        <SelectValue>
                          <Badge className={`text-xs ${STATUS_COLORS[t.status] ?? ''}`}>{t.status.replace('_', ' ')}</Badge>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((s) => (
                          <SelectItem key={s} value={s}>
                            <Badge className={`text-xs ${STATUS_COLORS[s] ?? ''}`}>{s.replace('_', ' ')}</Badge>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(t.createdAt).toLocaleDateString()}
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

      {/* Ticket detail sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg flex flex-col overflow-hidden">
          {selected && (
            <>
              <SheetHeader className="shrink-0">
                <SheetTitle className="text-base">
                  [{selected.ticketNumber}] {selected.subject}
                </SheetTitle>
                <div className="flex gap-2 flex-wrap">
                  <Badge className={STATUS_COLORS[selected.status] ?? ''}>{selected.status.replace('_', ' ')}</Badge>
                  <Badge className={PRIORITY_COLORS[selected.priority] ?? ''}>{selected.priority}</Badge>
                  <span className="text-xs text-muted-foreground">From: {selected.userEmail}</span>
                </div>
              </SheetHeader>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto py-4 space-y-3 min-h-0">
                {selected.messages.length === 0
                  ? <p className="text-muted-foreground text-sm text-center py-8">No messages yet</p>
                  : selected.messages.map((m) => (
                    <div
                      key={m.id}
                      className={`rounded-lg px-4 py-3 text-sm max-w-[85%] ${
                        m.isStaff === 'true'
                          ? 'ml-auto bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{m.message}</p>
                      <p className={`text-xs mt-1 ${m.isStaff === 'true' ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                        {new Date(m.createdAt).toLocaleString()}
                      </p>
                    </div>
                  ))}
              </div>

              {/* Reply box */}
              <div className="shrink-0 border-t pt-3 space-y-2">
                <Textarea
                  placeholder="Write a reply…"
                  rows={3}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleReply();
                  }}
                />
                <div className="flex justify-end">
                  <Button onClick={handleReply} disabled={sending || !reply.trim()} className="gap-2">
                    <Send className="h-4 w-4" />
                    {sending ? 'Sending…' : 'Send Reply'}
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
