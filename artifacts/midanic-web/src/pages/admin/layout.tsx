import { useAuth } from '@/contexts/auth-context';
import { Redirect, Link, useLocation } from 'wouter';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  Package,
  Key,
  FileText,
  MessageSquare,
  Ticket,
  BriefcaseBusiness,
  Settings,
  ChevronLeft,
  Menu,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAdminSettings } from '@/contexts/admin-settings-context';
import { useAdminText } from '@/lib/admin-i18n';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import './company-console.css';

const NAV_ITEMS = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/admin/erp', label: 'ERP Companies', icon: BriefcaseBusiness },
  { href: '/admin/licenses', label: 'Licenses & Subscriptions', icon: Key },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/customers', label: 'Customers', icon: Users },
  { href: '/admin/products', label: 'Products', icon: Package },
  { href: '/admin/content', label: 'Content', icon: FileText },
  { href: '/admin/crm', label: 'CRM', icon: MessageSquare },
  { href: '/admin/tickets', label: 'Support Tickets', icon: Ticket },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
];

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { settings, localizedSettings } = useAdminSettings();
  const { tAdmin, language } = useAdminText();

  if (isLoading) {
    return (
      <div className="flex h-[calc(100dvh-4rem)] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user || user.role !== 'super_admin') {
    return <Redirect to="/" />;
  }

  return (
    <div
      className="company-console flex h-[calc(100dvh-4rem)] overflow-hidden bg-muted/30"
      dir={language === 'ar' ? 'rtl' : 'ltr'}
      style={{
        backgroundImage: settings.backgroundImageUrl ? `linear-gradient(rgba(15, 23, 42, 0.72), rgba(15, 23, 42, 0.72)), url("${settings.backgroundImageUrl}")` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
      {/* Sidebar */}
      <aside
        data-sidebar-style={settings.sidebarStyle}
        className={cn(
          `console-sidebar hidden md:flex flex-col border-r transition-all duration-200 ${collapsed ? 'is-collapsed' : ''}`,
          settings.sidebarStyle === 'glass' ? 'bg-background/75 backdrop-blur-xl' : 'bg-background',
          settings.sidebarStyle === 'compact' ? (collapsed ? 'w-14' : 'w-48') : (collapsed ? 'w-14' : 'w-56')
        )}
      >
        {/* Sidebar header */}
        <div className="flex h-12 items-center justify-between px-3 border-b">
          {!collapsed && (
            <span className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
              {localizedSettings.adminName}
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 ml-auto"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={tAdmin('Collapse menu')}
          >
            {collapsed ? <Menu className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto py-2" aria-label={tAdmin('Management')}>
          {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? location === href : location.startsWith(href);
            return (
              <div key={href}>
              {!collapsed && (href === '/admin' || href === '/admin/users') && <p className="console-nav-label">{tAdmin(href === '/admin' ? 'Management' : 'Platform')}</p>}
              <Link href={href} aria-current={active ? 'page' : undefined} title={tAdmin(label)}>
                <div
                  className={cn(
                    'flex items-center gap-3 mx-2 px-2 py-2 rounded-md text-sm cursor-pointer transition-colors',
                    active
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span>{tAdmin(label)}</span>}
                </div>
              </Link>
              </div>
            );
          })}
        </nav>
      </aside>

      {/* Main content */}
      <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="console-page-content mx-auto max-w-7xl p-6">
            <div className="console-context mb-6">
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild><Button variant="outline" size="icon" className="md:hidden shrink-0" aria-label={tAdmin('Open menu')}><Menu size={19} /></Button></SheetTrigger>
                <SheetContent side={language === 'ar' ? 'right' : 'left'} className="w-72 overflow-y-auto" dir={language === 'ar' ? 'rtl' : 'ltr'}>
                  <SheetHeader><SheetTitle>{localizedSettings.adminName}</SheetTitle></SheetHeader>
                  <nav className="mt-6 flex flex-col gap-1" aria-label={tAdmin('Management')}>
                    {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
                      const active = exact ? location === href : location.startsWith(href);
                      return <Link key={href} href={href} onClick={() => setMobileOpen(false)} aria-current={active ? 'page' : undefined}
                        className={cn('flex items-center gap-3 rounded-lg px-3 py-3 text-sm', active ? 'bg-primary/10 text-primary font-semibold' : 'text-muted-foreground')}>
                        <Icon size={17} />{tAdmin(label)}
                      </Link>;
                    })}
                  </nav>
                </SheetContent>
              </Sheet>
              <div className="min-w-0 flex-1"><h1 className="text-sm font-semibold tracking-tight">{localizedSettings.pageTitle}</h1>
              <p className="text-sm text-muted-foreground">{localizedSettings.pageSubtitle}</p>
              </div>
              <span className="console-admin-badge">{tAdmin('Super administrator')}</span>
            </div>
          {children}
        </div>
      </main>
    </div>
  );
}
