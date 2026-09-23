import { useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const resetSchema = z.object({
  password: z.string().min(8),
  confirmPassword: z.string().min(8),
}).refine((values) => values.password === values.confirmPassword, {
  path: ['confirmPassword'],
  message: 'auth.password_mismatch',
});

type ResetForm = z.infer<typeof resetSchema>;

function apiPath(path: string): string {
  const base = (import.meta.env.BASE_URL as string | undefined)?.replace(/\/$/, '') ?? '';
  return `${base}${path}`;
}

export default function ResetPassword({ token }: { token: string }) {
  const { t, i18n } = useTranslation();
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<'checking' | 'valid' | 'invalid'>('checking');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const form = useForm<ResetForm>({
    resolver: zodResolver(resetSchema, {
      errorMap: (issue, ctx) => {
        if (issue.message === 'auth.password_mismatch') {
          return { message: t('auth.password_mismatch') };
        }
        return { message: ctx.defaultError };
      },
    }),
    defaultValues: { password: '', confirmPassword: '' },
  });

  useEffect(() => {
    if (!token) {
      setStatus('invalid');
      return;
    }
    fetch(apiPath(`/api/auth/reset-password/${encodeURIComponent(token)}`))
      .then((response) => setStatus(response.ok ? 'valid' : 'invalid'))
      .catch(() => setStatus('invalid'));
  }, [token]);

  async function onSubmit(values: ResetForm) {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(apiPath(`/api/auth/reset-password/${encodeURIComponent(token)}`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: values.password }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error || t('auth.reset_request_error'));
      }
      setDone(true);
      setTimeout(() => setLocation('/login'), 2200);
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : t('auth.reset_request_error'));
    } finally {
      setLoading(false);
    }
  }

  const isArabic = i18n.language === 'ar';

  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center bg-muted/30 px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">{t('auth.reset_title')}</CardTitle>
          <CardDescription>{t('auth.reset_subtitle')}</CardDescription>
        </CardHeader>
        <CardContent dir={isArabic ? 'rtl' : 'ltr'}>
          {status === 'checking' && <p className="py-6 text-center text-sm text-muted-foreground">{t('auth.verifying_reset_link')}</p>}
          {status === 'invalid' && (
            <div className="space-y-4 text-center">
              <p className="text-sm text-destructive">{t('auth.invalid_reset_link')}</p>
              <Link href="/forgot-password" className="text-sm font-medium text-primary hover:underline">
                {t('auth.request_new_link')}
              </Link>
            </div>
          )}
          {status === 'valid' && !done && (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" data-testid="form-reset-password">
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('auth.new_password')}</FormLabel>
                      <FormControl><Input type="password" autoComplete="new-password" {...field} data-testid="input-new-password" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('auth.confirm_password')}</FormLabel>
                      <FormControl><Input type="password" autoComplete="new-password" {...field} data-testid="input-confirm-password" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
                <Button type="submit" className="w-full" disabled={loading} data-testid="button-reset-submit">
                  {loading ? t('auth.resetting_password') : t('auth.reset_password')}
                </Button>
              </form>
            </Form>
          )}
          {done && (
            <div className="space-y-4 text-center">
              <div className="text-3xl text-green-600" aria-hidden="true">✓</div>
              <p className="text-sm text-muted-foreground">{t('auth.reset_success_description')}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}