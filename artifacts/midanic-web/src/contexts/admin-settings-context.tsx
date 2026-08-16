import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/contexts/theme-context';
import { adminApi, type AdminSettings, type LocalizedAdminText } from '@/lib/admin-api';

export const DEFAULT_ADMIN_SETTINGS: AdminSettings = {
  id: 0,
  adminName: { en: 'Midanic Admin', fr: 'Midanic Admin', ar: 'ميدانيك' },
  pageTitle: { en: 'Administration', fr: 'Administration', ar: 'الإدارة' },
  pageSubtitle: {
    en: 'Manage your platform from one place',
    fr: 'Gérez votre plateforme depuis un seul endroit',
    ar: 'أدر منصتك من مكان واحد',
  },
  accentColor: '#3b82f6',
  theme: 'dark',
  sidebarStyle: 'default',
  backgroundImageUrl: null,
  updatedAt: '',
};

interface AdminSettingsContextValue {
  settings: AdminSettings;
  localizedSettings: {
    adminName: string;
    pageTitle: string;
    pageSubtitle: string;
  };
  loading: boolean;
  saveSettings: (updates: Partial<AdminSettings>) => Promise<AdminSettings>;
  refreshSettings: () => Promise<void>;
}

const AdminSettingsContext = createContext<AdminSettingsContextValue | undefined>(undefined);

function getAdminLocale(language: string): keyof LocalizedAdminText {
  if (language.startsWith('fr')) return 'fr';
  if (language.startsWith('ar')) return 'ar';
  return 'en';
}

function hexToHsl(hex: string): string {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16) / 255;
  const g = parseInt(value.slice(2, 4), 16) / 255;
  const b = parseInt(value.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const delta = max - min;
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    switch (max) {
      case r: h = (g - b) / delta + (g < b ? 6 : 0); break;
      case g: h = (b - r) / delta + 2; break;
      default: h = (r - g) / delta + 4;
    }
    h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function AdminSettingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { setTheme } = useTheme();
  const { i18n } = useTranslation();
  const [settings, setSettings] = useState(DEFAULT_ADMIN_SETTINGS);
  const [loading, setLoading] = useState(true);

  const applySettings = (next: AdminSettings) => {
    setSettings(next);
    setTheme(next.theme);
    const root = document.documentElement;
    const primary = hexToHsl(next.accentColor);
    root.style.setProperty('--primary', primary);
    root.style.setProperty('--ring', primary);
    root.style.setProperty('--sidebar-primary', primary);
    root.style.setProperty('--sidebar-ring', primary);
    root.style.setProperty('--admin-background-image', next.backgroundImageUrl ? `url("${next.backgroundImageUrl}")` : 'none');
  };

  const refreshSettings = async () => {
    if (user?.role !== 'super_admin') {
      setLoading(false);
      return;
    }
    try {
      applySettings(await adminApi.getAdminSettings());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshSettings();
  }, [user?.id, user?.role]);

  const localizedSettings = useMemo(() => {
    const locale = getAdminLocale(i18n.language);
    return {
      adminName: settings.adminName[locale],
      pageTitle: settings.pageTitle[locale],
      pageSubtitle: settings.pageSubtitle[locale],
    };
  }, [i18n.language, settings]);

  const value = useMemo<AdminSettingsContextValue>(() => ({
    settings,
    localizedSettings,
    loading,
    saveSettings: async (updates) => {
      const saved = await adminApi.updateAdminSettings(updates);
      applySettings(saved);
      return saved;
    },
    refreshSettings,
  }), [settings, localizedSettings, loading]);

  return <AdminSettingsContext.Provider value={value}>{children}</AdminSettingsContext.Provider>;
}

export function useAdminSettings() {
  const context = useContext(AdminSettingsContext);
  if (!context) throw new Error('useAdminSettings must be used within AdminSettingsProvider');
  return context;
}