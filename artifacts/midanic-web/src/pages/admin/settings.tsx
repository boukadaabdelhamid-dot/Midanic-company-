import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/auth-context';
import { useAdminSettings } from '@/contexts/admin-settings-context';
import { uploadFileToStorage } from '@/lib/storage-upload';
import type { AdminSettings, LocalizedAdminText } from '@/lib/admin-api';
import { useChangeEmail, useChangePassword } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { ImagePlus, KeyRound, Mail, Palette, Save, ShieldCheck, Upload } from 'lucide-react';

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export default function AdminSettings() {
  const { t } = useTranslation();
  const { user, setUser } = useAuth();
  const { settings, saveSettings } = useAdminSettings();
  const changeEmail = useChangeEmail();
  const changePassword = useChangePassword();

  const [appearance, setAppearance] = useState<AdminSettings>(settings);
  const [savingAppearance, setSavingAppearance] = useState(false);
  const [uploadingBackground, setUploadingBackground] = useState(false);
  const [newEmail, setNewEmail] = useState(user?.email ?? '');
  const [emailPassword, setEmailPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const localizedLabels: Array<{ locale: keyof LocalizedAdminText; label: string; direction: 'ltr' | 'rtl' }> = [
    { locale: 'en', label: t('settings.language_english'), direction: 'ltr' },
    { locale: 'fr', label: t('settings.language_french'), direction: 'ltr' },
    { locale: 'ar', label: t('settings.language_arabic'), direction: 'rtl' },
  ];

  useEffect(() => {
    setAppearance(settings);
  }, [settings]);

  const updateAppearance = <K extends keyof AdminSettings>(key: K, value: AdminSettings[K]) => {
    setAppearance((current) => ({ ...current, [key]: value }));
  };

  const updateLocalizedAppearance = (
    key: 'adminName' | 'pageTitle' | 'pageSubtitle',
    locale: keyof LocalizedAdminText,
    value: string,
  ) => {
    setAppearance((current) => ({
      ...current,
      [key]: { ...current[key], [locale]: value },
    }));
  };

  const submitAppearance = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingAppearance(true);
    try {
      const saved = await saveSettings({
        adminName: appearance.adminName,
        pageTitle: appearance.pageTitle,
        pageSubtitle: appearance.pageSubtitle,
        accentColor: appearance.accentColor,
        theme: appearance.theme,
        sidebarStyle: appearance.sidebarStyle,
        backgroundImageUrl: appearance.backgroundImageUrl,
      });
      setAppearance(saved);
      toast.success(t('settings.appearance_success'));
    } catch (error) {
      toast.error(getErrorMessage(error, t('settings.appearance_error')));
    } finally {
      setSavingAppearance(false);
    }
  };

  const handleBackgroundUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error(t('settings.background_image_type_error'));
      return;
    }
    setUploadingBackground(true);
    try {
      const url = await uploadFileToStorage(file);
      updateAppearance('backgroundImageUrl', url);
      toast.success(t('settings.background_image_uploaded'));
    } catch (error) {
      toast.error(getErrorMessage(error, t('settings.background_image_error')));
    } finally {
      setUploadingBackground(false);
      event.target.value = '';
    }
  };

  const submitEmail = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    changeEmail.mutate(
      { data: { newEmail: newEmail.trim(), currentPassword: emailPassword } },
      {
        onSuccess: (updatedUser) => {
          setUser(updatedUser);
          setEmailPassword('');
          toast.success(t('settings.email_success'));
        },
        onError: (error) => {
          toast.error(getErrorMessage(error, t('settings.email_error')));
        },
      },
    );
  };

  const submitPassword = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error(t('settings.password_mismatch'));
      return;
    }
    changePassword.mutate(
      { data: { currentPassword, newPassword } },
      {
        onSuccess: () => {
          setCurrentPassword('');
          setNewPassword('');
          setConfirmPassword('');
          toast.success(t('settings.password_success'));
        },
        onError: (error) => {
          toast.error(getErrorMessage(error, t('settings.password_error')));
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      <Card className="max-w-3xl overflow-hidden">
        <CardHeader className="border-b bg-muted/20">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <Palette className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>{t('settings.appearance_title')}</CardTitle>
              <CardDescription>{t('settings.appearance_description')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={submitAppearance} className="space-y-6">
            <div className="space-y-5">
              <div>
                <Label>{t('settings.localized_content')}</Label>
                <p className="mt-1 text-xs text-muted-foreground">{t('settings.localized_content_hint')}</p>
              </div>
              {localizedLabels.map(({ locale, label, direction }) => (
                <div key={locale} className="rounded-lg border bg-muted/10 p-4" dir={direction}>
                  <div className="mb-4 flex items-center gap-2">
                    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                      {label}
                    </span>
                  </div>
                  <div className="grid gap-4">
                    <div className="space-y-2">
                      <Label htmlFor={`admin-name-${locale}`}>{t('settings.admin_name')}</Label>
                      <Input
                        id={`admin-name-${locale}`}
                        value={appearance.adminName[locale]}
                        onChange={(event) => updateLocalizedAppearance('adminName', locale, event.target.value)}
                        maxLength={80}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`page-title-${locale}`}>{t('settings.page_title')}</Label>
                      <Input
                        id={`page-title-${locale}`}
                        value={appearance.pageTitle[locale]}
                        onChange={(event) => updateLocalizedAppearance('pageTitle', locale, event.target.value)}
                        maxLength={120}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`page-subtitle-${locale}`}>{t('settings.page_subtitle')}</Label>
                      <Textarea
                        id={`page-subtitle-${locale}`}
                        value={appearance.pageSubtitle[locale]}
                        onChange={(event) => updateLocalizedAppearance('pageSubtitle', locale, event.target.value)}
                        maxLength={240}
                        rows={3}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="accent-color">{t('settings.accent_color')}</Label>
                <div className="flex gap-2">
                  <Input
                    id="accent-color"
                    type="color"
                    value={appearance.accentColor}
                    onChange={(event) => updateAppearance('accentColor', event.target.value)}
                    className="h-10 w-14 cursor-pointer p-1"
                  />
                  <Input
                    value={appearance.accentColor}
                    onChange={(event) => updateAppearance('accentColor', event.target.value)}
                    pattern="^#[0-9a-fA-F]{6}$"
                    className="font-mono uppercase"
                    aria-label={t('settings.accent_color')}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t('settings.theme')}</Label>
                <Select value={appearance.theme} onValueChange={(value) => updateAppearance('theme', value as AdminSettings['theme'])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dark">{t('settings.theme_dark')}</SelectItem>
                    <SelectItem value="light">{t('settings.theme_light')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('settings.sidebar_style')}</Label>
                <Select value={appearance.sidebarStyle} onValueChange={(value) => updateAppearance('sidebarStyle', value as AdminSettings['sidebarStyle'])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">{t('settings.sidebar_default')}</SelectItem>
                    <SelectItem value="glass">{t('settings.sidebar_glass')}</SelectItem>
                    <SelectItem value="compact">{t('settings.sidebar_compact')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <Label>{t('settings.background_image')}</Label>
                <p className="mt-1 text-xs text-muted-foreground">{t('settings.background_image_hint')}</p>
              </div>
              {appearance.backgroundImageUrl && (
                <div
                  className="relative h-32 overflow-hidden rounded-lg border bg-muted bg-cover bg-center"
                  style={{ backgroundImage: `url("${appearance.backgroundImageUrl}")` }}
                >
                  <div className="absolute inset-0 bg-slate-950/45" />
                  <div className="absolute inset-0 flex items-center justify-center text-sm font-medium text-white">
                    {t('settings.background_preview')}
                  </div>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Label
                  htmlFor="background-image"
                  className="inline-flex cursor-pointer items-center gap-2 rounded-md border bg-background px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-muted"
                >
                  {uploadingBackground ? <Upload className="h-4 w-4 animate-pulse" /> : <ImagePlus className="h-4 w-4" />}
                  {uploadingBackground ? t('settings.uploading') : t('settings.upload_background')}
                </Label>
                <Input id="background-image" type="file" accept="image/*" className="sr-only" onChange={handleBackgroundUpload} disabled={uploadingBackground} />
                {appearance.backgroundImageUrl && (
                  <Button type="button" variant="ghost" onClick={() => updateAppearance('backgroundImageUrl', null)}>
                    {t('settings.remove_background')}
                  </Button>
                )}
              </div>
            </div>

            <Button type="submit" disabled={savingAppearance || uploadingBackground} className="gap-2">
              <Save className="h-4 w-4" />
              {savingAppearance ? t('settings.saving') : t('settings.save_appearance')}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="max-w-3xl">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>{t('settings.email_title')}</CardTitle>
              <CardDescription>{t('settings.email_description')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={submitEmail} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-email">{t('settings.current_email')}</Label>
              <Input id="current-email" value={user?.email ?? ''} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-email">{t('settings.new_email')}</Label>
              <Input
                id="new-email"
                type="email"
                value={newEmail}
                onChange={(event) => setNewEmail(event.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email-password">{t('settings.current_password')}</Label>
              <Input
                id="email-password"
                type="password"
                value={emailPassword}
                onChange={(event) => setEmailPassword(event.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" disabled={changeEmail.isPending}>
              {changeEmail.isPending ? t('settings.saving') : t('settings.change_email')}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="max-w-3xl">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>{t('settings.password_title')}</CardTitle>
              <CardDescription>{t('settings.password_description')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={submitPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">{t('settings.current_password')}</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <Separator />
            <div className="space-y-2">
              <Label htmlFor="new-password">{t('settings.new_password')}</Label>
              <Input
                id="new-password"
                type="password"
                minLength={8}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                required
                autoComplete="new-password"
              />
              <p className="text-xs text-muted-foreground">{t('settings.password_hint')}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">{t('settings.confirm_password')}</Label>
              <Input
                id="confirm-password"
                type="password"
                minLength={8}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                autoComplete="new-password"
              />
            </div>
            <Button type="submit" disabled={changePassword.isPending}>
              {changePassword.isPending ? t('settings.saving') : t('settings.change_password')}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="flex max-w-3xl items-start gap-3 rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p>{t('settings.security_note')}</p>
      </div>
    </div>
  );
}