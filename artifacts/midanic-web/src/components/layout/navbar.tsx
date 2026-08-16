import { useState } from 'react';
import { Link } from 'wouter';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/contexts/theme-context';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Menu, X, Sun, Moon, Globe, User, LogOut, ShieldCheck, LayoutDashboard } from 'lucide-react';
import { useUpdateLanguage, useLogout } from '@workspace/api-client-react';

export function Navbar() {
  const { t, i18n } = useTranslation();
  const { user, isAuthenticated, logout: authLogout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const updateLanguageMutation = useUpdateLanguage();
  const logoutMutation = useLogout();

  const changeLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
    localStorage.setItem('midanic_lang', lang);

    // Set RTL for Arabic
    if (lang === 'ar') {
      document.documentElement.dir = 'rtl';
      document.documentElement.lang = 'ar';
    } else {
      document.documentElement.dir = 'ltr';
      document.documentElement.lang = lang;
    }

    // Update server if authenticated
    if (isAuthenticated) {
      updateLanguageMutation.mutate({
        data: { language: lang as 'en' | 'fr' | 'ar' },
      });
    }
  };

  const handleLogout = () => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) {
      logoutMutation.mutate(
        { data: { refreshToken } },
        {
          onSettled: () => {
            authLogout();
          },
        }
      );
    } else {
      authLogout();
    }
  };

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center hover:opacity-80 transition-opacity" data-testid="link-home" aria-label="Midanic home">
            <img
              src="/midanic-logo.png"
              alt="Midanic"
              className="h-12 w-[74px] object-contain dark:invert"
            />
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6">
            <Link href="/products" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors" data-testid="link-products">
              {t('nav.products')}
            </Link>
            <Link href="/pricing" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors" data-testid="link-pricing">
              {t('nav.pricing')}
            </Link>
            <Link href="/about" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors" data-testid="link-about">
              {t('nav.about')}
            </Link>
            <Link href="/contact" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors" data-testid="link-contact">
              {t('nav.contact')}
            </Link>
            <Link href="/blog" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors" data-testid="link-blog">
              {t('nav.blog')}
            </Link>
          </div>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-3">
            {/* Language Switcher */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2" data-testid="button-language">
                  <Globe className="w-4 h-4" />
                  <span className="text-xs font-mono uppercase">{i18n.language}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => changeLanguage('en')} data-testid="button-lang-en">
                  English
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => changeLanguage('fr')} data-testid="button-lang-fr">
                  Français
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => changeLanguage('ar')} data-testid="button-lang-ar">
                  العربية
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Theme Toggle */}
            <Button variant="ghost" size="sm" onClick={toggleTheme} data-testid="button-theme">
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </Button>

            {/* Auth */}
            {isAuthenticated && user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2" data-testid="button-user-menu">
                    <User className="w-4 h-4" />
                    <span className="text-sm">{user.firstName}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <div className="px-2 py-1.5 text-sm font-medium">
                    {user.firstName} {user.lastName}
                  </div>
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    {user.email}
                  </div>
                  <DropdownMenuSeparator />
                  {user.role === 'super_admin' ? (
                    <Link href="/admin">
                      <DropdownMenuItem data-testid="link-admin">
                        <ShieldCheck className="w-4 h-4 mr-2" />
                        Admin
                      </DropdownMenuItem>
                    </Link>
                  ) : (
                    <Link href="/dashboard">
                      <DropdownMenuItem data-testid="link-dashboard">
                        <LayoutDashboard className="w-4 h-4 mr-2" />
                        {t('nav.dashboard')}
                      </DropdownMenuItem>
                    </Link>
                  )}
                  <DropdownMenuItem onClick={handleLogout} data-testid="button-logout">
                    <LogOut className="w-4 h-4 mr-2" />
                    {t('nav.logout')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                <Link href="/login" data-testid="link-login">
                  <Button variant="ghost" size="sm">
                    {t('nav.login')}
                  </Button>
                </Link>
                <Link href="/register" data-testid="link-register">
                  <Button size="sm">
                    {t('nav.register')}
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="sm"
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            data-testid="button-mobile-menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 space-y-3 border-t border-border">
            <Link
              href="/products"
              className="block px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
              onClick={() => setMobileMenuOpen(false)}
              data-testid="link-mobile-products"
            >
              {t('nav.products')}
            </Link>
            <Link
              href="/pricing"
              className="block px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
              onClick={() => setMobileMenuOpen(false)}
              data-testid="link-mobile-pricing"
            >
              {t('nav.pricing')}
            </Link>
            <Link
              href="/about"
              className="block px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
              onClick={() => setMobileMenuOpen(false)}
              data-testid="link-mobile-about"
            >
              {t('nav.about')}
            </Link>
            <Link
              href="/contact"
              className="block px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
              onClick={() => setMobileMenuOpen(false)}
              data-testid="link-mobile-contact"
            >
              {t('nav.contact')}
            </Link>
            <Link
              href="/blog"
              className="block px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
              onClick={() => setMobileMenuOpen(false)}
              data-testid="link-mobile-blog"
            >
              {t('nav.blog')}
            </Link>
            <div className="flex items-center gap-2 pt-2 border-t border-border">
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleTheme}
                className="flex-1"
                data-testid="button-mobile-theme"
              >
                {theme === 'light' ? <Moon className="w-4 h-4 mr-2" /> : <Sun className="w-4 h-4 mr-2" />}
                {theme === 'light' ? 'Dark' : 'Light'}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="flex-1" data-testid="button-mobile-language">
                    <Globe className="w-4 h-4 mr-2" />
                    <span className="uppercase">{i18n.language}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => changeLanguage('en')}>English</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => changeLanguage('fr')}>Français</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => changeLanguage('ar')}>العربية</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            {isAuthenticated && user ? (
              <div className="pt-2 border-t border-border">
                <div className="px-3 py-2 text-sm font-medium">
                  {user.firstName} {user.lastName}
                </div>
                {user.role === 'super_admin' ? (
                  <Link href="/admin" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="ghost" size="sm" className="w-full justify-start" data-testid="link-mobile-admin">
                      <ShieldCheck className="w-4 h-4 mr-2" />
                      Admin
                    </Button>
                  </Link>
                ) : (
                  <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="ghost" size="sm" className="w-full justify-start" data-testid="link-mobile-dashboard">
                      <LayoutDashboard className="w-4 h-4 mr-2" />
                      {t('nav.dashboard')}
                    </Button>
                  </Link>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={handleLogout}
                  data-testid="button-mobile-logout"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  {t('nav.logout')}
                </Button>
              </div>
            ) : (
              <div className="flex gap-2 pt-2 border-t border-border">
                <Link href="/login" className="flex-1" onClick={() => setMobileMenuOpen(false)} data-testid="link-mobile-login">
                  <Button variant="outline" size="sm" className="w-full">
                    {t('nav.login')}
                  </Button>
                </Link>
                <Link href="/register" className="flex-1" onClick={() => setMobileMenuOpen(false)} data-testid="link-mobile-register">
                  <Button size="sm" className="w-full">
                    {t('nav.register')}
                  </Button>
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
