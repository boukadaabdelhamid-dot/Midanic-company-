import { useState } from 'react';
import { Link } from 'wouter';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const forgotSchema = z.object({
  email: z.string().email(),
});

type ForgotForm = z.infer<typeof forgotSchema>;

function apiPath(path: string): string {
  const base = (import.meta.env.BASE_URL as string | undefined)?.replace(/\/$/, '') ?? '';
  return `${base}${path}`;
}

export default function ForgotPassword() {
  const { t, i18n } = useTranslation();
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const form = useForm<ForgotForm>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: '' },
  });

  async function onSubmit(values: ForgotForm) {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(apiPath('/api/auth/forgot-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: values.email.trim().toLowerCase() }),
      });
      if (!response.ok) {
        throw new Error(t('auth.reset_request_error'));
      }
      setSubmitted(true);
    } catch {
      setError(t('auth.reset_request_error'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center bg-muted/30 px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">{t('auth.forgot_title')}</CardTitle>
          <CardDescription>{t('auth.forgot_subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          {submitted ? (
            <div className="space-y-5 text-center" dir={i18n.language === 'ar' ? 'rtl' : 'ltr'}>
              <div className="text-3xl text-green-600" aria-hidden="true">✓</div>
              <p className="text-sm text-muted-foreground">{t('auth.reset_sent_description')}</p>
              <Link href="/login" className="text-sm font-medium text-primary hover:underline">
                {t('auth.back_to_login')}
              </Link>
            </div>
          ) : (
            <>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" data-testid="form-forgot-password">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('auth.email')}</FormLabel>
                        <FormControl>
                          <Input type="email" autoComplete="email" {...field} data-testid="input-forgot-email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
                  <Button type="submit" className="w-full" disabled={loading} data-testid="button-forgot-submit">
                    {loading ? t('auth.sending_reset_link') : t('auth.send_reset_link')}
                  </Button>
                </form>
              </Form>
              <div className="mt-6 text-center text-sm">
                <Link href="/login" className="text-primary hover:underline">
                  {t('auth.back_to_login')}
                </Link>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}