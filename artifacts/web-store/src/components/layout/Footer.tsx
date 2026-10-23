import { Link } from "wouter";
import { Facebook, Instagram, MessageCircle } from "lucide-react";
import { useStoreConfig } from "@/hooks/use-store-config";
import { useLang } from "@/hooks/use-lang";
import { resolveImg } from "@/lib/utils";

const fallbackLogo = `${import.meta.env.BASE_URL}midanic-logo.jpg`;

export function Footer() {
  const {
    description,
    facebookUrl,
    instagramUrl,
    tiktokUrl,
    whatsappNumber,
    logoUrl,
    nameAr,
    nameEn,
  } = useStoreConfig();
  const { lang } = useLang();
  const isAr = lang === "ar";
  const storeName = isAr ? nameAr : nameEn;
  const year = new Date().getFullYear();

  return (
    <footer className="sf-footer" dir={isAr ? "rtl" : "ltr"}>
      <div className="sf-footer-main">
        <div className="sf-footer-identity">
          <Link href="/" className="sf-footer-brand">
            <img src={resolveImg(logoUrl) ?? fallbackLogo} alt="" />
            <span>{storeName}</span>
          </Link>
          {description && <p>{description}</p>}
        </div>
        <div className="sf-footer-links">
          <h2>{isAr ? "روابط سريعة" : "Explore"}</h2>
          <Link href="/">{isAr ? "الرئيسية" : "Home"}</Link>
          <Link href="/products">{isAr ? "المنتجات" : "Products"}</Link>
          <Link href="/cart">{isAr ? "سلة التسوق" : "Shopping bag"}</Link>
        </div>
        {(facebookUrl || instagramUrl || tiktokUrl || whatsappNumber) && (
          <div className="sf-footer-social">
            <h2>{isAr ? "تابعنا وتواصل معنا" : "Connect with us"}</h2>
            <div>
              {facebookUrl && (
                <a href={facebookUrl} target="_blank" rel="noopener noreferrer" aria-label="Facebook">
                  <Facebook size={17} /><span>Facebook</span>
                </a>
              )}
              {instagramUrl && (
                <a href={instagramUrl} target="_blank" rel="noopener noreferrer" aria-label="Instagram">
                  <Instagram size={17} /><span>Instagram</span>
                </a>
              )}
              {tiktokUrl && (
                <a href={tiktokUrl} target="_blank" rel="noopener noreferrer" aria-label="TikTok">
                  <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V9.17a8.16 8.16 0 0 0 4.77 1.52V7.24a4.85 4.85 0 0 1-1-.55z" />
                  </svg>
                  <span>TikTok</span>
                </a>
              )}
              {whatsappNumber && (
                <a href={`https://wa.me/${whatsappNumber.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp">
                  <MessageCircle size={17} /><span>WhatsApp</span>
                </a>
              )}
            </div>
          </div>
        )}
      </div>
      <div className="sf-footer-legal">
        <span>© {year} {storeName}</span>
        <span>{isAr ? "جميع الحقوق محفوظة." : "All rights reserved."}</span>
      </div>
    </footer>
  );
}
