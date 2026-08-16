import { useEffect, useState } from 'react';
import { useLocation, Link } from 'wouter';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/auth-context';
import { adminApi, type MyLicense, type MyDownload, type MyErpAccess } from '@/lib/admin-api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Copy, Check, Download, RefreshCw, KeyRound, Package,
  Clock, ShieldAlert, ShieldOff, Shield, BriefcaseBusiness, ExternalLink,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// ── helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  active: {
    label: 'Active',
    color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    icon: <Shield className="h-3.5 w-3.5" />,
  },
  expired: {
    label: 'Expired',
    color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    icon: <ShieldAlert className="h-3.5 w-3.5" />,
  },
  suspended: {
    label: 'Suspended',
    color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    icon: <ShieldOff className="h-3.5 w-3.5" />,
  },
  revoked: {
    label: 'Revoked',
    color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    icon: <ShieldOff className="h-3.5 w-3.5" />,
  },
};

const TYPE_LABELS: Record<string, string> = {
  trial: 'Trial',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  semi_annual: '6 Months',
  yearly: 'Yearly',
  lifetime: 'Lifetime ∞',
};

function daysUntil(date: string | null): number | null {
  if (!date) return null;
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000);
}

function formatExpiry(date: string | null): string {
  if (!date) return 'Never';
  return new Date(date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function isExpiringSoon(license: MyLicense): boolean {
  if (license.status !== 'active' || !license.expiresAt) return false;
  const days = daysUntil(license.expiresAt);
  return days !== null && days <= 14;
}

// ── Copy key ─────────────────────────────────────────────────────────────────
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
      className="flex items-center gap-2 font-mono text-sm bg-muted rounded-md px-3 py-1.5 hover:bg-muted/80 transition-colors w-full"
      title="Click to copy"
    >
      <KeyRound className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <span className="truncate flex-1 text-left">{value}</span>
      {copied
        ? <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />
        : <Copy className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
    </button>
  );
}

// ── License card ─────────────────────────────────────────────────────────────
function LicenseCard({ license, downloads }: { license: MyLicense; downloads: MyDownload[] }) {
  const days = daysUntil(license.expiresAt);
  const expiringSoon = isExpiringSoon(license);
  const status = STATUS_CONFIG[license.status] ?? STATUS_CONFIG.active;
  const productDownloads = downloads.filter(d => d.productId === license.productId);
  const isInactive = license.status !== 'active';

  return (
    <Card className={`relative overflow-hidden transition-all ${isInactive ? 'opacity-60' : ''} ${expiringSoon ? 'border-yellow-400 dark:border-yellow-600' : ''}`}>
      {expiringSoon && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-yellow-400 dark:bg-yellow-600" />
      )}
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Package className="h-4 w-4 text-muted-foreground shrink-0" />
            <CardTitle className="text-base truncate">
              {license.productName ?? `Product #${license.productId}`}
            </CardTitle>
          </div>
          <Badge className={`text-xs shrink-0 flex items-center gap-1 ${status.color}`}>
            {status.icon}
            {status.label}
          </Badge>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <Badge variant="outline" className="text-xs">{TYPE_LABELS[license.type] ?? license.type}</Badge>
          {expiringSoon && days !== null && (
            <span className="text-xs text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Expires in {days} day{days !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* License key */}
        <CopyKey value={license.licenseKey} />

        {/* Meta row */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Expires</p>
            <p className="font-medium">{formatExpiry(license.expiresAt)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Devices</p>
            <p className={`font-medium ${license.activatedDevices >= (license.maxDevices ?? 1) ? 'text-red-500' : ''}`}>
              {license.activatedDevices} / {license.maxDevices ?? 1}
            </p>
          </div>
        </div>

        {/* Downloads for this product */}
        {license.status === 'active' && productDownloads.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Downloads</p>
            <div className="space-y-1.5">
              {productDownloads.map(d => (
                <a
                  key={d.id}
                  href={d.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-md bg-muted hover:bg-primary hover:text-primary-foreground transition-colors group"
                >
                  <Download className="h-3.5 w-3.5 shrink-0" />
                  <span className="flex-1 truncate">{d.fileName}</span>
                  {d.platform && (
                    <span className="text-xs text-muted-foreground group-hover:text-primary-foreground/70 shrink-0">
                      {d.platform}
                    </span>
                  )}
                  {d.version && (
                    <span className="text-xs text-muted-foreground group-hover:text-primary-foreground/70 shrink-0">
                      v{d.version}
                    </span>
                  )}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Renew button for expired / expiring soon */}
        {(license.status === 'expired' || expiringSoon) && (
          <Button variant="outline" size="sm" className="w-full gap-2" disabled>
            <RefreshCw className="h-3.5 w-3.5" />
            {license.status === 'expired' ? 'Renew License' : 'Renew Before Expiry'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main dashboard page ──────────────────────────────────────────────────────
export default function Dashboard() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { t } = useTranslation();
  const { toast } = useToast();

  const [licenses, setLicenses] = useState<MyLicense[]>([]);
  const [downloads, setDownloads] = useState<MyDownload[]>([]);
  const [erpAccess, setErpAccess] = useState<MyErpAccess | null>(null);
  const [loading, setLoading] = useState(true);

  // Redirect unauthenticated visitors
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation('/login');
    }
    // Redirect admins to admin panel
    if (!authLoading && isAuthenticated && user?.role === 'super_admin') {
      setLocation('/admin');
    }
  }, [authLoading, isAuthenticated, user, setLocation]);

  useEffect(() => {
    if (!isAuthenticated) return;
    setLoading(true);
    Promise.all([adminApi.getMyLicenses(), adminApi.getMyDownloads(), adminApi.getMyErpAccess()])
      .then(([licRes, dlRes, erpRes]) => {
        setLicenses(licRes.licenses);
        setDownloads(dlRes.downloads);
        setErpAccess(erpRes);
      })
      .catch((e: Error) => {
        toast({ title: 'Error loading data', description: e.message, variant: 'destructive' });
      })
      .finally(() => setLoading(false));
  }, [isAuthenticated, toast]);

  if (authLoading || (!isAuthenticated && !authLoading)) return null;

  const activeLicenses = licenses.filter(l => l.status === 'active');
  const inactiveLicenses = licenses.filter(l => l.status !== 'active');

  return (
    <main className="flex-1 bg-muted/30 py-8">
      <div className="container mx-auto px-4 max-w-5xl space-y-8">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">
            {t('nav.dashboard')}
          </h1>
          <p className="text-muted-foreground mt-1">
            Welcome back, {user?.firstName}. Here are your licenses and downloads.
          </p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-2xl font-bold">{activeLicenses.length}</p>
              <p className="text-sm text-muted-foreground mt-1">Active Licenses</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-2xl font-bold">{downloads.length}</p>
              <p className="text-sm text-muted-foreground mt-1">Available Downloads</p>
            </CardContent>
          </Card>
          <Card className="col-span-2 sm:col-span-1">
            <CardContent className="pt-6">
              <p className="text-2xl font-bold">
                {licenses.filter(l => isExpiringSoon(l)).length}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Expiring Soon</p>
            </CardContent>
          </Card>
        </div>

        {/* ERP access */}
        <section>
          <Card className={erpAccess?.canAccess ? 'border-primary/40 bg-primary/[0.03]' : ''}>
            <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
                  <BriefcaseBusiness className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-semibold">Midanic ERP</h2>
                  {loading && !erpAccess ? (
                    <p className="mt-1 text-sm text-muted-foreground">Checking your ERP access...</p>
                  ) : erpAccess?.canAccess ? (
                    <>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {erpAccess.companyName ? `${erpAccess.companyName} · ` : ''}Your ERP workspace is ready.
                      </p>
                      {erpAccess.trialEndsAt && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Trial ends {formatExpiry(erpAccess.trialEndsAt)}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {erpAccess?.message ?? 'Your ERP access link will appear here after approval.'}
                    </p>
                  )}
                </div>
              </div>
              {erpAccess?.canAccess && (
                <Button asChild className="shrink-0 gap-2">
                  <a href={erpAccess.launchUrl}>
                    Open ERP
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Active licenses */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Active Licenses</h2>
          {loading ? (
            <div className="grid sm:grid-cols-2 gap-4">
              {[1, 2].map(i => (
                <Card key={i}>
                  <CardContent className="pt-6 space-y-3">
                    <div className="h-5 w-1/2 animate-pulse rounded bg-muted" />
                    <div className="h-10 animate-pulse rounded bg-muted" />
                    <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : activeLicenses.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <KeyRound className="h-8 w-8 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No active licenses</p>
                <p className="text-sm mt-1">Contact us or browse our products to get started.</p>
                <Link href="/products">
                  <Button variant="outline" size="sm" className="mt-4">Browse Products</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {activeLicenses.map(l => (
                <LicenseCard key={l.id} license={l} downloads={downloads} />
              ))}
            </div>
          )}
        </section>

        {/* Inactive licenses (collapsed section) */}
        {!loading && inactiveLicenses.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-muted-foreground">
              License History ({inactiveLicenses.length})
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {inactiveLicenses.map(l => (
                <LicenseCard key={l.id} license={l} downloads={downloads} />
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
