import { useEffect, useState } from 'react';
import {
  adminApi,
  type AdminStats,
  type MonthlyLicenseCount,
  type ExpiringLicense,
} from '@/lib/admin-api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  Users, Package, Key, Ticket, TrendingUp,
  AlertTriangle, CalendarClock, Sparkles,
} from 'lucide-react';
import { useGetPublicStats } from '@workspace/api-client-react';
import { useToast } from '@/hooks/use-toast';

// ── colours for pie chart ────────────────────────────────────────────────────
const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'];

const TYPE_LABELS: Record<string, string> = {
  trial: 'Trial', monthly: 'Monthly', quarterly: 'Quarterly',
  semi_annual: '6 Months', yearly: 'Yearly', lifetime: 'Lifetime',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  expired: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  suspended: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  revoked: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

function daysLeft(date: string | null): number | null {
  if (!date) return null;
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000);
}

// ── Stat card ────────────────────────────────────────────────────────────────
function StatCard({
  label, value, icon: Icon, color, sub,
}: {
  label: string; value: number | string; icon: React.ElementType; color: string; sub?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className={`h-4 w-4 ${color}`} />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{typeof value === 'number' ? value.toLocaleString() : value}</div>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function AdminOverview() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [monthly, setMonthly] = useState<MonthlyLicenseCount[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { data: publicStats } = useGetPublicStats();
  const { toast } = useToast();

  useEffect(() => {
    Promise.all([adminApi.getStats(), adminApi.getMonthlyLicenses()])
      .then(([s, m]) => {
        setStats(s);
        setMonthly(m.data);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  const renewLicense = async (license: ExpiringLicense) => {
    try {
      await adminApi.updateLicense(license.id, { status: 'active' });
      toast({ title: 'License renewed', description: `${license.licenseKey} is now active.` });
      // Refresh stats
      const [s, m] = await Promise.all([adminApi.getStats(), adminApi.getMonthlyLicenses()]);
      setStats(s);
      setMonthly(m.data);
    } catch (e: unknown) {
      toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' });
    }
  };

  // Format month label: "2025-08" → "Aug"
  const chartData = monthly.map(({ month, count }) => {
    const [year, m] = month.split('-');
    const label = new Date(Number(year), Number(m) - 1).toLocaleString('default', { month: 'short' });
    return { month: label, count };
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Overview</h1>
        <p className="text-muted-foreground text-sm mt-1">Platform at a glance</p>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
      )}

      {/* ── Primary KPIs ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats ? (
          <>
            <StatCard label="Total Users" value={stats.totalUsers} icon={Users} color="text-blue-500" />
            <StatCard label="Total Products" value={stats.totalProducts} icon={Package} color="text-green-500" />
            <StatCard label="Active Licenses" value={stats.activeLicenses} icon={Key} color="text-purple-500" />
            <StatCard label="Open Tickets" value={stats.openTickets} icon={Ticket} color="text-orange-500" />
          </>
        ) : (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="pt-6"><div className="h-8 w-24 animate-pulse rounded bg-muted" /></CardContent></Card>
          ))
        )}
      </div>

      {/* ── License KPIs ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats ? (
          <>
            <StatCard
              label="New This Month"
              value={stats.newThisMonth}
              icon={Sparkles}
              color="text-blue-400"
              sub="licenses issued"
            />
            <StatCard
              label="Expiring in 30 Days"
              value={stats.expiringIn30Days}
              icon={CalendarClock}
              color="text-yellow-500"
              sub="active licenses"
            />
            <StatCard
              label="Expiring Today"
              value={stats.expiringToday}
              icon={AlertTriangle}
              color={stats.expiringToday > 0 ? 'text-red-500' : 'text-muted-foreground'}
              sub="require immediate action"
            />
          </>
        ) : (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}><CardContent className="pt-6"><div className="h-8 w-24 animate-pulse rounded bg-muted" /></CardContent></Card>
          ))
        )}
      </div>

      {/* ── Charts row ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Bar chart — monthly licenses */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Licenses Issued — Last 6 Months</CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
                Loading chart…
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ fontSize: 12 }}
                    formatter={(v: number) => [`${v} licenses`, '']}
                  />
                  <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Pie chart — by product */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Active Licenses by Product</CardTitle>
          </CardHeader>
          <CardContent>
            {!stats || stats.byProduct.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
                {stats ? 'No active licenses' : 'Loading…'}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={stats.byProduct}
                    dataKey="count"
                    nameKey="productName"
                    cx="50%"
                    cy="45%"
                    outerRadius={72}
                    label={false}
                  >
                    {stats.byProduct.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ fontSize: 12 }}
                    formatter={(v: number, name: string) => [`${v} licenses`, name]}
                  />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Recent licenses table ──────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Licenses</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Key</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!stats ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j}><div className="h-4 w-20 animate-pulse rounded bg-muted" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : stats.recentLicenses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No licenses yet
                  </TableCell>
                </TableRow>
              ) : (
                stats.recentLicenses.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-mono text-xs">{l.licenseKey}</TableCell>
                    <TableCell className="text-sm">
                      {l.userEmail
                        ? <span title={l.userEmail}>{l.userFirstName ?? ''} {l.userLastName ?? ''}</span>
                        : <span className="text-muted-foreground italic">Unassigned</span>}
                    </TableCell>
                    <TableCell className="text-sm">{l.productName ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{TYPE_LABELS[l.type] ?? l.type}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-xs ${STATUS_COLORS[l.status] ?? ''}`}>{l.status}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {l.expiresAt ? new Date(l.expiresAt).toLocaleDateString() : '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(l.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ── Expiring soon table ────────────────────────────────────────────── */}
      {stats && stats.expiringIn14Days.length > 0 && (
        <Card className="border-yellow-300 dark:border-yellow-700">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              Expiring Within 14 Days ({stats.expiringIn14Days.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Key</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Days Left</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.expiringIn14Days.map((l) => {
                  const days = daysLeft(l.expiresAt);
                  return (
                    <TableRow key={l.id}>
                      <TableCell className="font-mono text-xs">{l.licenseKey}</TableCell>
                      <TableCell className="text-sm">
                        {l.userEmail
                          ? <span>{l.userFirstName ?? ''} <span className="text-muted-foreground text-xs">({l.userEmail})</span></span>
                          : <span className="text-muted-foreground italic">Unassigned</span>}
                      </TableCell>
                      <TableCell className="text-sm">{l.productName ?? '—'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{TYPE_LABELS[l.type] ?? l.type}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {l.expiresAt ? new Date(l.expiresAt).toLocaleDateString() : '—'}
                      </TableCell>
                      <TableCell>
                        <span className={`text-sm font-medium ${days !== null && days <= 3 ? 'text-red-500' : 'text-yellow-600 dark:text-yellow-400'}`}>
                          {days !== null ? `${days}d` : '—'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => renewLicense(l)}
                        >
                          Renew
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* ── Public stats ──────────────────────────────────────────────────── */}
      {publicStats && (
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
            Public Metrics
          </h2>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              { label: 'Published Products', value: publicStats.totalProducts },
              { label: 'Total Clients', value: publicStats.totalClients },
              { label: 'Total Downloads', value: publicStats.totalDownloads },
              { label: 'Countries', value: publicStats.totalCountries },
            ].map(({ label, value }) => (
              <Card key={label} className="bg-muted/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{value.toLocaleString()}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
