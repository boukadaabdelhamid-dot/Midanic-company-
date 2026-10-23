import React, { useMemo, useState } from "react";
import "./_group.css";
import "./storefront.css";
import { PRODUCTS, CATEGORIES, STORE, type Product } from "./_shared/fixtures";
import { CategoryNavigation } from "./_shared/CategoryNavigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Globe2,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";

type Lang = "ar" | "en";
type Cart = Record<number, number>;

export function Storefront() {
  const [lang, setLang] = useState<Lang>("ar");
  const [category, setCategory] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<Cart>({});
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [panel, setPanel] = useState<"cart" | "account" | null>(null);
  const [notice, setNotice] = useState("");
  const isAr = lang === "ar";
  const dir = isAr ? "rtl" : "ltr";
  const logo = STORE.logoUrl || "/__mockup/images/store-logo.jpg";
  const heroImage = STORE.bannerUrl || "/__mockup/images/store-hero.jpg";

  const copy = {
    demo: isAr ? "متجر تجريبي — لا تُرسل طلبات حقيقية" : "Demo shop — no real orders are placed",
    explore: isAr ? "اكتشفي روتينك، على مهل" : "Find your ritual, at your own pace",
    intro: isAr
      ? "منتجات عناية مختارة للبشرة والشعر، مع الأسعار والتوفر بوضوح."
      : "Thoughtful care for skin and hair, with clear prices and availability.",
    browse: isAr ? "تصفحي المنتجات" : "Browse products",
    collection: isAr ? "اختيارات ميدانيك" : "The Midanic edit",
    subhead: isAr ? "عناية يومية، ببساطة" : "Everyday care, made simple",
    all: isAr ? "كل المنتجات" : "All products",
    categories: isAr ? "الفئات" : "Categories",
    search: isAr ? "ابحثي عن منتج..." : "Search products...",
    stock: isAr ? "متوفر" : "In stock",
    out: isAr ? "نفد من المخزون" : "Out of stock",
    add: isAr ? "أضيفي إلى السلة" : "Add to bag",
    view: isAr ? "التفاصيل" : "View details",
    empty: isAr ? "لا توجد منتجات تطابق بحثك." : "No products match your search.",
    count: isAr ? "منتجات مختارة" : "considered essentials",
    cart: isAr ? "سلتك التجريبية" : "Your demo bag",
    emptyCart: isAr ? "سلتك فارغة حالياً" : "Your bag is empty for now",
    emptyCartHint: isAr ? "أضيفي منتجاً من المجموعة لتري ملخصه هنا." : "Add something from the collection to see it here.",
    subtotal: isAr ? "المجموع الفرعي" : "Subtotal",
    noCheckout: isAr ? "الدفع غير متاح في هذا العرض" : "Checkout isn’t available in this demo",
    checkoutInfo: isAr
      ? "هذه معاينة تصميم فقط. لن يتم إرسال طلب أو حفظ بيانات شراء."
      : "This is a design preview only. No order will be sent or purchase data saved.",
    account: isAr ? "حساب الزبون" : "Customer account",
    accountInfo: isAr
      ? "تسجيل الدخول غير مفعّل في هذه المعاينة. لن تُطلب منك أي بيانات شخصية."
      : "Sign-in is not enabled in this preview. No personal details are requested.",
    close: isAr ? "إغلاق" : "Close",
    language: isAr ? "English" : "العربية",
    demoTag: isAr ? "عرض تجريبي" : "DEMO PREVIEW",
    product: isAr ? "المنتج" : "PRODUCT",
    catalog: isAr ? "المجموعة" : "THE COLLECTION",
    available: isAr ? "التوفر" : "Availability",
    qty: isAr ? "الكمية" : "Quantity",
    removed: isAr ? "تم حذف المنتج من السلة" : "Item removed from your bag",
    added: isAr ? "أُضيف المنتج إلى السلة" : "Added to your bag",
    suspended: isAr ? "الطلبات غير متاحة حالياً" : "Orders are currently unavailable",
  };

  const shownProducts = useMemo(() => PRODUCTS.filter((product) => {
    const categoryMatch = category === null || product.categoryId === category;
    const term = search.trim().toLocaleLowerCase();
    const productName = isAr ? product.nameAr : product.nameEn;
    const categoryName = CATEGORIES.find((item) => item.id === product.categoryId);
    const categoryLabel = categoryName ? (isAr ? categoryName.nameAr : categoryName.nameFr) : "";
    return categoryMatch && (!term || `${productName} ${categoryLabel}`.toLocaleLowerCase().includes(term));
  }), [category, isAr, search]);

  const cartLines = PRODUCTS.filter((product) => (cart[product.id] ?? 0) > 0);
  const cartCount = Object.values(cart).reduce((sum, quantity) => sum + quantity, 0);
  const subtotal = cartLines.reduce((sum, product) => sum + product.price * cart[product.id], 0);
  const formatPrice = (amount: number) => `${amount.toLocaleString(isAr ? "ar-DZ" : "en-US")} ${isAr ? "دج" : "DZD"}`;
  const name = (product: Product) => isAr ? product.nameAr : product.nameEn;
  const categoryName = (id: number) => {
    const item = CATEGORIES.find((entry) => entry.id === id);
    return item ? (isAr ? item.nameAr : item.nameFr) : "";
  };

  const add = (product: Product, amount = 1) => {
    if (!STORE.acceptOrders) {
      setNotice(copy.suspended);
      window.setTimeout(() => setNotice(""), 2200);
      return;
    }
    setCart((current) => {
      const currentQty = current[product.id] ?? 0;
      const nextQty = Math.min(product.stock, currentQty + amount);
      if (nextQty === currentQty) return current;
      return { ...current, [product.id]: nextQty };
    });
    setNotice(copy.added);
    window.setTimeout(() => setNotice(""), 1800);
  };

  const changeQuantity = (product: Product, next: number) => {
    setCart((current) => {
      if (next <= 0) {
        const { [product.id]: _removed, ...rest } = current;
        setNotice(copy.removed);
        window.setTimeout(() => setNotice(""), 1800);
        return rest;
      }
      if (next > product.stock) return current;
      return { ...current, [product.id]: next };
    });
  };

  const scrollToProducts = () => document.getElementById("store-products")?.scrollIntoView({ behavior: "smooth" });
  const scrollToCategories = () => document.getElementById("store-categories")?.scrollIntoView({ behavior: "smooth" });

  return (
    <main className="store-prototype midanic-storefront" dir={dir}>
      <div className="ms-demo-strip">
        <span className="ms-demo-dot" />{copy.demo}
      </div>
      <header className="ms-header">
        <a className="ms-brand" href="#top" aria-label={isAr ? "ميدانيك، الصفحة الرئيسية" : "Midanic home"}>
          <img src={logo} alt="" />
          <span className="ms-brand-name">{isAr ? STORE.nameAr : STORE.nameEn}</span>
        </a>
        <nav className="ms-nav" aria-label={isAr ? "التنقل الرئيسي" : "Main navigation"}>
          <button className="ms-nav-link ms-nav-active" onClick={scrollToProducts}>{isAr ? "المنتجات" : "Products"}</button>
          <button className="ms-nav-link" onClick={scrollToCategories}>{copy.categories}</button>
        </nav>
        <div className="ms-actions">
          <button className="ms-icon-btn ms-language" onClick={() => setLang(isAr ? "en" : "ar")} aria-label={copy.language}>
            <Globe2 size={18} /><span>{copy.language}</span>
          </button>
          <button className="ms-icon-btn" onClick={() => setPanel("account")} aria-label={copy.account}>
            <UserRound size={19} /><span className="ms-desktop-only">{isAr ? "الحساب" : "Account"}</span>
          </button>
          <button className="ms-bag-button" onClick={() => setPanel("cart")} aria-label={`${copy.cart} ${cartCount}`}>
            <ShoppingBag size={19} />
            <span>{isAr ? "السلة" : "Bag"}</span>
            <b>{cartCount}</b>
          </button>
        </div>
      </header>

      <section className="ms-hero" id="top">
        <img className="ms-hero-photo" src={heroImage} alt={isAr ? "منتجات عناية بالبشرة" : "Skincare products"} />
        <div className="ms-hero-wash" />
        <div className="ms-hero-copy">
          <span className="ms-eyebrow"><Sparkles size={14} />{isAr ? "روتينكِ يبدأ هنا" : "A little care, every day"}</span>
          <h1>{copy.explore}</h1>
          <p>{copy.intro}</p>
          <button className="ms-primary-button" onClick={scrollToProducts}>
            {copy.browse}{isAr ? <ArrowLeft size={17} /> : <ArrowRight size={17} />}
          </button>
          <div className="ms-hero-proof">
            <span className="ms-proof-mark"><Check size={13} /></span>
            <span>{isAr ? "الأسعار والتوفر موضّحان لكل منتج" : "Prices and availability shown per item"}</span>
          </div>
        </div>
        <div className="ms-hero-caption"><span>01</span><i />{isAr ? "عناية مختارة بعناية" : "A considered selection"}</div>
      </section>

      <CategoryNavigation
        isAr={isAr}
        selected={category}
        onSelect={(categoryId) => {
          setCategory(categoryId);
          scrollToProducts();
        }}
      />

      <section className="ms-collection" id="store-products">
        <div className="ms-section-heading">
          <div>
            <div className="ms-section-kicker">{copy.catalog} <span>— 0{PRODUCTS.length}</span></div>
            <h2>{copy.collection}</h2>
            <p>{copy.subhead}</p>
          </div>
          <div className="ms-product-count" role="status" aria-live="polite"><strong>{shownProducts.length.toLocaleString(isAr ? "ar-DZ" : "en-US")}</strong><span>{copy.count}</span></div>
        </div>
        <div className="ms-tools">
          <div className="ms-category-selection">
            <span>{category === null ? copy.all : categoryName(category)}</span>
            <button type="button" onClick={scrollToCategories}>
              {isAr ? "تغيير الفئة" : "Change category"}<ChevronDown size={14} />
            </button>
            {category !== null && <button type="button" onClick={() => setCategory(null)}>{copy.all}</button>}
          </div>
          <label className="ms-search">
            <Search size={18} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={copy.search} aria-label={copy.search} />
            {search && <button onClick={() => setSearch("")} aria-label={isAr ? "مسح البحث" : "Clear search"}><X size={15} /></button>}
          </label>
        </div>
        {shownProducts.length ? (
          <div className="ms-product-grid">
            {shownProducts.map((product, index) => {
              const soldOut = product.stock === 0;
              return (
                <article className="ms-product-card" key={product.id} style={{ animationDelay: `${index * 65}ms` }}>
                  <button className="ms-product-image-button" onClick={() => setActiveProduct(product)} aria-label={`${copy.view}: ${name(product)}`}>
                    <div className="ms-product-image">
                      <img src={product.primaryImage || product.imageUrl} alt={name(product)} loading="lazy" />
                      {STORE.showStock && <span className={`ms-stock-tag ${soldOut ? "is-out" : ""}`}>
                        {soldOut ? copy.out : copy.stock}
                      </span>}
                      <span className="ms-card-quick">{copy.view}{isAr ? <ArrowLeft size={14} /> : <ArrowRight size={14} />}</span>
                    </div>
                  </button>
                  <div className="ms-card-details">
                    <div className="ms-card-category">{categoryName(product.categoryId)}</div>
                    <button className="ms-product-title" onClick={() => setActiveProduct(product)}>{name(product)}</button>
                    <div className="ms-card-bottom">
                      {STORE.showPrices ? <strong className="ms-price">{formatPrice(product.price)}</strong> : <span />}
                      <button className="ms-add-button" onClick={() => add(product)} disabled={soldOut || !STORE.acceptOrders} aria-label={`${copy.add}: ${name(product)}`}>
                        <Plus size={17} /><span>{copy.add}</span>
                      </button>
                    </div>
                    {STORE.showStock && !soldOut && <div className="ms-stock-note">{isAr ? `متوفر: ${product.stock}` : `${product.stock} available`}</div>}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="ms-empty-results">
            <Search size={25} />
            <strong>{copy.empty}</strong>
            <button onClick={() => { setSearch(""); setCategory(null); }}>{copy.all}</button>
          </div>
        )}
      </section>

      <footer className="ms-footer">
        <div className="ms-footer-brand"><img src={logo} alt="" /><span>{isAr ? STORE.nameAr : STORE.nameEn}</span></div>
        <p>{isAr ? "متجر تجريبي لمعاينة تجربة التسوق. لا تُقبل عمليات الشراء." : "A sample storefront preview. Purchases are not accepted."}</p>
        <span className="ms-footer-signature">{isAr ? "متجر تجريبي" : "DEMO SHOP"}</span>
      </footer>

      {notice && <div className="ms-toast" role="status"><Check size={16} />{notice}</div>}

      {activeProduct && (
        <div className="ms-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setActiveProduct(null); }}>
          <section className="ms-product-modal" role="dialog" aria-modal="true" aria-label={name(activeProduct)} dir={dir}>
            <button className="ms-close-button" onClick={() => setActiveProduct(null)} aria-label={copy.close}><X size={19} /></button>
            <div className="ms-modal-photo"><img src={activeProduct.primaryImage || activeProduct.imageUrl} alt={name(activeProduct)} /></div>
            <div className="ms-modal-info">
              <div className="ms-section-kicker">{categoryName(activeProduct.categoryId)}</div>
              <h2>{name(activeProduct)}</h2>
              <p>{isAr ? activeProduct.descriptionAr : activeProduct.descriptionEn}</p>
              {STORE.showStock && <div className="ms-detail-line"><span>{copy.available}</span><strong className={activeProduct.stock === 0 ? "muted" : ""}>{activeProduct.stock === 0 ? copy.out : isAr ? `${activeProduct.stock} متوفر` : `${activeProduct.stock} available`}</strong></div>}
              {STORE.showPrices && <div className="ms-modal-price">{formatPrice(activeProduct.price)}</div>}
              <button className="ms-primary-button ms-modal-add" onClick={() => add(activeProduct)} disabled={!activeProduct.stock || !STORE.acceptOrders}>
                <ShoppingBag size={17} />{copy.add}
              </button>
              <small>{copy.demo}</small>
            </div>
          </section>
        </div>
      )}

      {panel && (
        <div className="ms-modal-backdrop ms-drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setPanel(null); }}>
          <aside className="ms-drawer" role="dialog" aria-modal="true" aria-label={panel === "cart" ? copy.cart : copy.account} dir={dir}>
            <div className="ms-drawer-head">
              <div><span className="ms-section-kicker">{copy.demoTag}</span><h2>{panel === "cart" ? copy.cart : copy.account}</h2></div>
              <button className="ms-close-button" onClick={() => setPanel(null)} aria-label={copy.close}><X size={19} /></button>
            </div>
            {panel === "account" ? (
              <div className="ms-account-explainer">
                <span className="ms-account-icon"><UserRound size={24} /></span>
                <h3>{isAr ? "الدخول غير متاح في المعاينة" : "Sign-in is outside this preview"}</h3>
                <p>{copy.accountInfo}</p>
                <button className="ms-secondary-button" onClick={() => setPanel(null)}>{copy.close}</button>
              </div>
            ) : (
              <>
                <div className="ms-cart-lines">
                  {cartLines.length ? cartLines.map((product) => (
                    <div className="ms-cart-line" key={product.id}>
                      <img src={product.primaryImage || product.imageUrl} alt="" />
                      <div className="ms-cart-item-info">
                        <span className="ms-card-category">{categoryName(product.categoryId)}</span>
                        <strong>{name(product)}</strong>
                        {STORE.showPrices && <span className="ms-cart-price">{formatPrice(product.price)}</span>}
                        {STORE.showStock && <span className="ms-cart-stock">{isAr ? `المتاح ${product.stock}` : `${product.stock} in stock`}</span>}
                        <div className="ms-quantity-control">
                          <button onClick={() => changeQuantity(product, cart[product.id] - 1)} aria-label={isAr ? "تقليل الكمية" : "Decrease quantity"}><Minus size={14} /></button>
                          <span>{cart[product.id]}</span>
                          <button onClick={() => changeQuantity(product, cart[product.id] + 1)} disabled={cart[product.id] >= product.stock} aria-label={isAr ? "زيادة الكمية" : "Increase quantity"}><Plus size={14} /></button>
                        </div>
                      </div>
                      <button className="ms-remove-item" onClick={() => changeQuantity(product, 0)} aria-label={isAr ? "حذف المنتج" : "Remove item"}><X size={16} /></button>
                    </div>
                  )) : (
                    <div className="ms-empty-cart"><ShoppingBag size={28} /><strong>{copy.emptyCart}</strong><p>{copy.emptyCartHint}</p><button onClick={() => { setPanel(null); scrollToProducts(); }}>{copy.browse}</button></div>
                  )}
                </div>
                {cartLines.length > 0 && (
                  <div className="ms-cart-summary">
                    {STORE.showPrices && <div className="ms-subtotal"><span>{copy.subtotal}</span><strong>{formatPrice(subtotal)}</strong></div>}
                    <div className="ms-checkout-note"><strong>{copy.noCheckout}</strong><p>{copy.checkoutInfo}</p></div>
                    <button className="ms-disabled-checkout" disabled><ShoppingBag size={17} />{isAr ? "إتمام الشراء غير متاح" : "Checkout unavailable"}<ChevronDown size={15} /></button>
                  </div>
                )}
                {!STORE.acceptOrders && <div className="ms-suspended-note">{copy.suspended}</div>}
              </>
            )}
          </aside>
        </div>
      )}
    </main>
  );
}
