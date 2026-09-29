import { useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import {
  getListDesktopLicensesQueryKey,
  useCreateDesktopLicense,
  useListDesktopLicenses,
  useReissueDesktopLicense,
} from '@workspace/api-client-react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useAdminText } from '@/lib/admin-i18n';
import { useForm } from 'react-hook-form';
import { ChevronLeft, ChevronRight, Copy, KeyRound, RefreshCw, Search, ShieldAlert } from 'lucide-react';

const PAGE_SIZE = 20;

type DesktopLicenseFormValues = {
  customerName: string;
  hwid: string;
};

function getApiErrorMessage(error: unknown): string | null {
  if (error && typeof error === 'object' && 'data' in error) {
    const data = (error as { data?: unknown }).data;
    if (data && typeof data === 'object' && 'error' in data) {
      const message = (data as { error?: unknown }).error;
      if (typeof message === 'string') return message;
    }
  }
  return error instanceof Error ? error.message : null;
}

function formatIssuedDate(value: string, language: 'en' | 'fr' | 'ar'): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const locale = language === 'fr' ? 'fr-FR' : language === 'ar' ? 'ar' : 'en-US';
  return date.toLocaleDateString(locale);
}

export default function DesktopLicensesTab() {
  const { tAdmin, language } = useAdminText();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [searchText, setSearchText] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [lastIssuedKey, setLastIssuedKey] = useState<string | null>(null);
  const [lastIssuedKeyWasReissued, setLastIssuedKeyWasReissued] = useState(false);
  const [reissueLicenseId, setReissueLicenseId] = useState<number | null>(null);

  const formSchema = useMemo(() => z.object({
    customerName: z.string().max(180),
    hwid: z.string().trim().regex(/^[A-Za-z0-9]{16}$/, tAdmin('The HWID must contain exactly 16 letters or digits.')),
  }), [tAdmin]);

  const form = useForm<DesktopLicenseFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { customerName: '', hwid: '' },
  });

  const query = useListDesktopLicenses({
    page,
    limit: PAGE_SIZE,
    search: appliedSearch || undefined,
  });

  const createMutation = useCreateDesktopLicense({
    mutation: {
      onSuccess: (license) => {
        setLastIssuedKey(license.licenseKey);
        setLastIssuedKeyWasReissued(false);
        form.reset();
        setPage(1);
        setSearchText('');
        setAppliedSearch('');
        void queryClient.invalidateQueries({ queryKey: getListDesktopLicensesQueryKey() });
        toast({ title: tAdmin('Desktop key generated') });
      },
      onError: (error) => {
        const message = getApiErrorMessage(error);
        const knownMessages = [
          'A desktop key already exists for this HWID',
          'Desktop license key generation is not configured',
          'The HWID must contain exactly 16 letters or digits.',
        ];
        toast({
          title: tAdmin(message && knownMessages.includes(message)
            ? message
            : 'Could not generate desktop key.'),
          variant: 'destructive',
        });
      },
    },
  });

  const reissueMutation = useReissueDesktopLicense({
    mutation: {
      onSuccess: (license) => {
        setLastIssuedKey(license.licenseKey);
        setLastIssuedKeyWasReissued(true);
        setReissueLicenseId(null);
        void queryClient.invalidateQueries({ queryKey: getListDesktopLicensesQueryKey() });
        toast({ title: tAdmin('Desktop key reissued') });
      },
      onError: () => {
        toast({ title: tAdmin('Could not reissue desktop key.'), variant: 'destructive' });
      },
    },
  });

  const licenses = query.data?.licenses ?? [];
  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const onSubmit = (values: DesktopLicenseFormValues) => {
    createMutation.mutate({
      data: {
        hwid: values.hwid.trim().toUpperCase(),
        ...(values.customerName.trim()
          ? { customerName: values.customerName.trim() }
          : {}),
      },
    });
  };

  const applySearch = () => {
    setPage(1);
    setAppliedSearch(searchText.trim());
  };

  const copyKey = async (key: string) => {
    try {
      await navigator.clipboard.writeText(key);
      toast({ title: tAdmin('Key copied') });
    } catch {
      toast({ title: tAdmin('Copy failed'), variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">{tAdmin('Desktop program licenses')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {tAdmin('Generate and track activation keys for the existing desktop app.')}
        </p>
      </div>

      <div role="note" className="flex gap-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
        <p>{tAdmin('These keys use the current offline format. The unchanged desktop app does not check expiry or online revocation, so changing a platform record will not disable an issued key.')}</p>
      </div>

      <section className="rounded-md border bg-background p-4">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <FormField
              control={form.control}
              name="customerName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{tAdmin('School / customer (optional)')}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      maxLength={180}
                      autoComplete="organization"
                      data-testid="input-desktop-license-customer"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="hwid"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{tAdmin('Device ID (HWID)')}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      maxLength={16}
                      autoComplete="off"
                      placeholder={tAdmin('Enter the 16-character device ID')}
                      data-testid="input-desktop-license-hwid"
                      onChange={(event) => field.onChange(event.target.value.replace(/\s/g, '').toUpperCase())}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={createMutation.isPending} data-testid="button-generate-desktop-license">
              <KeyRound className="mr-2 h-4 w-4" aria-hidden="true" />
              {createMutation.isPending ? tAdmin('Generating…') : tAdmin('Generate key')}
            </Button>
          </form>
        </Form>
      </section>

      {lastIssuedKey && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-primary/30 bg-primary/5 p-3">
          <div className="space-y-1">
            <p className="text-sm font-medium">
              {tAdmin(lastIssuedKeyWasReissued ? 'Reissued key' : 'Generated key')}
            </p>
            <code className="break-all font-mono text-sm" data-testid="text-generated-desktop-license-key">
              {lastIssuedKey}
            </code>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void copyKey(lastIssuedKey)}
            data-testid="button-copy-generated-desktop-license"
          >
            <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
            {tAdmin('Copy key')}
          </Button>
        </div>
      )}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-semibold">{tAdmin('Issued desktop keys')} ({total})</h3>
          <div className="flex w-full gap-2 sm:w-auto">
            <Input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  applySearch();
                }
              }}
              placeholder={tAdmin('Search by customer or HWID…')}
              aria-label={tAdmin('Search by customer or HWID…')}
              data-testid="input-search-desktop-licenses"
            />
            <Button type="button" variant="outline" onClick={applySearch} data-testid="button-search-desktop-licenses">
              <Search className="mr-2 h-4 w-4" aria-hidden="true" />
              {tAdmin('Search')}
            </Button>
          </div>
        </div>

        {query.isError && (
          <p role="alert" className="text-sm text-destructive" data-testid="status-desktop-license-load-error">
            {tAdmin('Could not load desktop keys.')}
          </p>
        )}

        <div className="overflow-x-auto rounded-md border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tAdmin('Customer')}</TableHead>
                <TableHead>{tAdmin('Device ID')}</TableHead>
                <TableHead>{tAdmin('License key')}</TableHead>
                <TableHead>{tAdmin('Issued')}</TableHead>
                <TableHead>{tAdmin('Reissue key')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.isLoading
                ? Array.from({ length: 4 }).map((_, index) => (
                    <TableRow key={index}>
                      {Array.from({ length: 5 }).map((__, cellIndex) => (
                        <TableCell key={cellIndex}>
                          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : licenses.length === 0
                  ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                        {tAdmin('No desktop keys have been generated yet.')}
                      </TableCell>
                    </TableRow>
                  )
                  : licenses.map((license) => (
                    <TableRow key={license.id} data-testid={`row-desktop-license-${license.id}`}>
                      <TableCell className="text-sm">
                        {license.customerName || <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{license.hwid}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <code className="whitespace-nowrap font-mono text-xs" data-testid={`text-desktop-license-key-${license.id}`}>
                            {license.licenseKey}
                          </code>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={tAdmin('Copy key')}
                            title={tAdmin('Copy key')}
                            onClick={() => void copyKey(license.licenseKey)}
                            data-testid={`button-copy-desktop-license-${license.id}`}
                          >
                            <Copy className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {formatIssuedDate(license.createdAt, language)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={tAdmin('Reissue key')}
                          title={tAdmin('Reissue key')}
                          disabled={reissueMutation.isPending}
                          onClick={() => setReissueLicenseId(license.id)}
                          data-testid={`button-reissue-desktop-license-${license.id}`}
                        >
                          <RefreshCw className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page <= 1 || query.isFetching}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            data-testid="button-desktop-license-previous-page"
          >
            <ChevronLeft className="mr-1 h-4 w-4" aria-hidden="true" />
            {tAdmin('Previous page')}
          </Button>
          <span className="text-sm text-muted-foreground">
            {tAdmin('Page')} {page} {tAdmin('of')} {totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page >= totalPages || query.isFetching}
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            data-testid="button-desktop-license-next-page"
          >
            {tAdmin('Next page')}
            <ChevronRight className="ml-1 h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </section>

      <AlertDialog
        open={reissueLicenseId !== null}
        onOpenChange={(open) => {
          if (!open && !reissueMutation.isPending) setReissueLicenseId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tAdmin('Reissue this key?')}</AlertDialogTitle>
            <AlertDialogDescription>
              {tAdmin('Reissuing replaces the key saved for this device. Already activated copies remain active; installations that are not activated must use the new key.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reissueMutation.isPending}>
              {tAdmin('Cancel')}
            </AlertDialogCancel>
            <Button
              type="button"
              disabled={reissueMutation.isPending || reissueLicenseId === null}
              onClick={() => {
                if (reissueLicenseId !== null) {
                  reissueMutation.mutate({ id: reissueLicenseId });
                }
              }}
              data-testid="button-confirm-desktop-license-reissue"
            >
              {reissueMutation.isPending ? tAdmin('Reissuing…') : tAdmin('Reissue')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}