import { Link, useLocation } from "wouter";
import { Check, Globe, LayoutDashboard, LogOut, ShoppingBag, UserRound } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useLang } from "@/hooks/use-lang";
import { useStoreConfig } from "@/hooks/use-store-config";
import { type CartItem } from "@workspace/erp-api-client-react";
import { useStoreCart } from "@/hooks/use-store-cart";
import { Button } from "@/components/ui/button";
import { resolveImg } from "@/lib/utils";

const fallbackLogo = `${import.meta.env.BASE_URL}midanic-logo.jpg`;

export function Navbar() {
  const { user, logout } = useAuth();
  const { lang, setLang } = useLang();
  const { logoUrl, nameAr, nameEn } = useStoreConfig();
  const [, setLocation] = useLocation();
  const { data: cart } = useStoreCart();
  const isAr = lang === "ar";
  const isFr = lang === "fr";
  const cartCount = (Array.isArray(cart) ? cart : []).reduce(
    (acc: number, item: CartItem) => acc + (item.quantity || 0),
    0,
  );
  const storeName = isAr ? nameAr : nameEn;

  const handleLogout = () => {
    logout();
    setLocation("/");
  };

  return (
    <header className="sf-header" dir={isAr ? "rtl" : "ltr"}>
      <div className="sf-header-inner">
        <Link href="/" className="sf-brand" aria-label={isAr ? `${storeName}، الصفحة الرئيسية` : `${storeName} home`}>
          <img src={resolveImg(logoUrl) ?? fallbackLogo} alt="" />
          <span>{storeName}</span>
        </Link>

        <nav className="sf-main-nav" aria-label={isAr ? "التنقل الرئيسي" : "Main navigation"}>
          <Link href="/products">{isAr ? "المنتجات" : isFr ? "Produits" : "Products"}</Link>
          {user && <Link className="sf-nav-account" href="/orders">{isAr ? "طلباتي" : isFr ? "Commandes" : "Orders"}</Link>}
          {user?.role === "admin" && (
            <Link className="sf-nav-account" href="/admin">
              <LayoutDashboard size={15} aria-hidden="true" />
              {isAr ? "الإدارة" : isFr ? "Administration" : "Admin"}
            </Link>
          )}
        </nav>

        <div className="sf-header-actions">
          <details className="sf-language-menu">
            <summary
              className="sf-language-button inline-flex cursor-pointer list-none items-center justify-center gap-1.5 rounded-md px-2 py-1 text-sm"
              aria-label={isAr ? "اختيار اللغة" : isFr ? "Choisir la langue" : "Choose language"}
              data-testid="button-toggle-lang"
            >
              <Globe size={17} aria-hidden="true" />
              <span>{isAr ? "العربية" : isFr ? "Français" : "English"}</span>
            </summary>
            <div className="sf-language-options" role="radiogroup" aria-label={isAr ? "اللغة" : isFr ? "Langue" : "Language"}>
              {([
                ["en", "English"],
                ["fr", "Français"],
                ["ar", "العربية"],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={lang === value}
                  onClick={(event) => {
                    setLang(value);
                    event.currentTarget.closest("details")?.removeAttribute("open");
                  }}
                  className="sf-language-option"
                  data-testid={`language-option-${value}`}
                >
                  {label}
                  {lang === value && <Check size={16} aria-hidden="true" />}
                </button>
              ))}
            </div>
          </details>

          <Link href="/cart" className="sf-cart-link" aria-label={isAr ? `السلة (${cartCount})` : isFr ? `Panier (${cartCount})` : `Cart (${cartCount})`} data-testid="link-cart">
            <ShoppingBag size={18} aria-hidden="true" />
            <span className="sf-cart-label">{isAr ? "السلة" : isFr ? "Panier" : "Bag"}</span>
            <b>{cartCount}</b>
          </Link>

          {user ? (
            <>
              <Link href="/profile" className="sf-profile-link" data-testid="link-profile">
                <UserRound size={17} aria-hidden="true" />
                <span>{isAr ? "الحساب" : isFr ? "Compte" : "Account"}</span>
              </Link>
              <Button className="sf-logout-button" variant="outline" size="sm" onClick={handleLogout} data-testid="button-logout">
                <LogOut size={15} aria-hidden="true" />
                <span>{isAr ? "خروج" : isFr ? "Déconnexion" : "Log out"}</span>
              </Button>
            </>
          ) : (
            <Link href="/auth/login" className="sf-login-link" data-testid="link-login">
              {isAr ? "تسجيل الدخول" : isFr ? "Connexion" : "Sign in"}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
