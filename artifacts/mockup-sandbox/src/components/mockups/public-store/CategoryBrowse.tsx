import { useMemo, useState } from "react";
import { ArrowLeft, Check, ChevronLeft, Search, ShoppingBag, SlidersHorizontal, Sparkles, X } from "lucide-react";
import { CATEGORIES, PRODUCTS, STORE } from "./_shared/fixtures";

export function CategoryBrowse() {
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<number[]>([]);

  const categoryProducts = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    return PRODUCTS.filter((product) => {
      const matchesCategory = selectedCategory === null || product.categoryId === selectedCategory;
      return matchesCategory && (!normalizedSearch || product.nameAr.toLocaleLowerCase().includes(normalizedSearch));
    });
  }, [selectedCategory, search]);

  const activeCategory = CATEGORIES.find((category) => category.id === selectedCategory);
  const formatPrice = (price: number) => `${price.toLocaleString("ar-DZ")} دج`;

  return (
    <main dir="rtl" className="min-h-[100dvh] bg-[#e9eee8] px-0 text-[#203b35] sm:flex sm:items-start sm:justify-center sm:px-8 sm:py-8">
      <div className="relative mx-auto min-h-[100dvh] w-full max-w-[430px] overflow-hidden bg-[#fbfaf5] shadow-[0_20px_70px_rgba(30,56,47,.13)] sm:min-h-[860px] sm:rounded-[34px]">
        <div className="flex items-center justify-between bg-[#203b35] px-5 py-2 text-[10px] font-medium tracking-wide text-[#e7eee8]">
          <span>متجر تجريبي — لا تُرسل طلبات حقيقية</span>
          <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#a7c7a7]" /> معاينة آمنة</span>
        </div>

        <header className="flex items-center justify-between px-5 pb-4 pt-5">
          <div className="flex items-center gap-3">
            <img src={STORE.logoUrl || "/__mockup/images/store-logo.jpg"} alt="" className="h-10 w-10 rounded-full border border-[#e4e7dc] object-cover" />
            <div>
              <p className="text-[17px] font-bold leading-tight tracking-[-.04em]">{STORE.nameAr}</p>
              <p className="mt-1 text-[10px] text-[#77847c]">اختيارات للعناية اليومية</p>
            </div>
          </div>
          <button
            type="button"
            aria-label="السلة"
            className="relative flex h-11 w-11 items-center justify-center rounded-full border border-[#e6e8df] bg-white text-[#203b35] transition hover:bg-[#f1f3eb]"
            onClick={() => document.getElementById("category-browse-cart")?.scrollIntoView({ behavior: "smooth", block: "center" })}
          >
            <ShoppingBag size={18} strokeWidth={1.7} />
            {cart.length > 0 && <span className="absolute -left-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#d76b4e] px-1 text-[9px] font-bold text-white">{cart.length}</span>}
          </button>
        </header>

        <section className="px-5">
          <div className="relative overflow-hidden rounded-[24px] bg-[#dfe9de]">
            <img src={STORE.bannerUrl || "/__mockup/images/store-hero.jpg"} alt="" className="absolute inset-0 h-full w-full object-cover opacity-[.35]" />
            <div className="absolute inset-0 bg-gradient-to-l from-[#dfe9de] via-[#dfe9de]/95 to-transparent" />
            <div className="relative flex min-h-[174px] flex-col items-start justify-center p-5">
              <span className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-[#c7d7c7] bg-[#f9fbf5]/70 px-2.5 py-1 text-[10px] font-semibold text-[#55725e]">
                <Sparkles size={11} /> عناية على طريقتك
              </span>
              <h1 className="max-w-[225px] text-[25px] font-bold leading-[1.25] tracking-[-.055em]">ابدئي من الفئة الأقرب إليك</h1>
              <p className="mt-2 max-w-[210px] text-[11px] leading-5 text-[#5d7064]">تصفحي مجموعات ميدانيك واختاري ما يناسب روتينك.</p>
            </div>
            <div className="absolute bottom-4 left-4 flex h-10 w-10 items-center justify-center rounded-full bg-[#fbfaf5]/75 text-[#37594a]">
              <ArrowLeft size={17} />
            </div>
          </div>
        </section>

        <section className="px-5 pt-6">
          <div className="mb-3 flex items-end justify-between">
            <div>
              <p className="text-[10px] font-bold tracking-[.16em] text-[#9a725d]">تصفحي حسب احتياجك</p>
              <h2 className="mt-1 text-[18px] font-bold tracking-[-.04em]">فئات المنتجات</h2>
            </div>
            <span className="pb-1 text-[10px] text-[#849087]">{CATEGORIES.length} فئات</span>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setSelectedCategory(null)}
              className={`relative flex min-h-[62px] items-center justify-between rounded-[17px] border px-3.5 text-right transition ${
                selectedCategory === null ? "border-[#315847] bg-[#315847] text-white shadow-[0_5px_14px_rgba(49,88,71,.14)]" : "border-[#e6e8df] bg-white text-[#33473d] hover:border-[#bdcfc0]"
              }`}
            >
              <span>
                <span className="block text-[12px] font-bold">كل المنتجات</span>
                <span className={`mt-1 block text-[9px] ${selectedCategory === null ? "text-[#d3e2d2]" : "text-[#8a938b]"}`}>{PRODUCTS.length} منتجات</span>
              </span>
              {selectedCategory === null ? <Check size={15} /> : <ChevronLeft size={15} className="text-[#9ca69d]" />}
            </button>
            {CATEGORIES.map((category) => {
              const count = PRODUCTS.filter((product) => product.categoryId === category.id).length;
              const isActive = selectedCategory === category.id;
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setSelectedCategory(isActive ? null : category.id)}
                  aria-pressed={isActive}
                  className={`group relative flex min-h-[62px] items-center gap-2.5 overflow-hidden rounded-[17px] border px-2.5 text-right transition ${
                    isActive ? "border-[#315847] bg-[#e8efe5] ring-1 ring-[#315847]" : "border-[#e6e8df] bg-white hover:border-[#bdcfc0]"
                  }`}
                >
                  <img src={category.imageUrl} alt="" className="h-10 w-10 shrink-0 rounded-[12px] object-cover" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[10px] font-bold leading-4">{category.nameAr}</span>
                    <span className="mt-0.5 block text-[9px] text-[#89928a]">{count} منتجات</span>
                  </span>
                  <ChevronLeft size={14} className={`shrink-0 ${isActive ? "text-[#315847]" : "text-[#a0a9a0]"}`} />
                </button>
              );
            })}
          </div>
        </section>

        <section className="px-5 pb-5 pt-6">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold tracking-[.16em] text-[#9a725d]">اختيارات ميدانيك</p>
              <h2 className="mt-1 text-[18px] font-bold tracking-[-.04em]">{activeCategory?.nameAr || "منتجات تستحق التجربة"}</h2>
            </div>
            <button
              type="button"
              aria-label="مسح البحث"
              onClick={() => document.getElementById("browse-search")?.focus()}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[#e6e8df] bg-white text-[#5a6f61]"
            >
              <SlidersHorizontal size={15} />
            </button>
          </div>

          <label className="mb-3 flex h-11 items-center gap-2.5 rounded-[14px] border border-[#e7e8df] bg-white px-3.5 focus-within:border-[#75917c]">
            <Search size={16} className="shrink-0 text-[#88948a]" />
            <input
              id="browse-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="ابحثي عن منتج..."
              className="w-full bg-transparent text-[12px] text-[#283d34] outline-none placeholder:text-[#a0a69e]"
            />
            {search && <button type="button" onClick={() => setSearch("")} aria-label="مسح البحث"><X size={15} className="text-[#8c978e]" /></button>}
          </label>

          {categoryProducts.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {categoryProducts.map((product) => {
                const category = CATEGORIES.find((item) => item.id === product.categoryId);
                const added = cart.includes(product.id);
                return (
                  <article key={product.id} className="overflow-hidden rounded-[18px] border border-[#e9e9e1] bg-white">
                    <div className="relative aspect-[1.08/1] overflow-hidden bg-[#f0f1e9]">
                      <img src={product.primaryImage} alt={product.nameAr} className="h-full w-full object-cover transition duration-500 hover:scale-[1.04]" />
                      {product.stock === 0 && <span className="absolute right-2 top-2 rounded-full bg-[#f7f5ed]/95 px-2 py-1 text-[8px] font-semibold text-[#8d8275]">نفد مؤقتاً</span>}
                    </div>
                    <div className="p-3">
                      <p className="mb-1 truncate text-[9px] text-[#9a725d]">{category?.nameAr}</p>
                      <h3 className="min-h-[34px] text-[11px] font-bold leading-[1.55]">{product.nameAr}</h3>
                      <div className="mt-2.5 flex items-center justify-between gap-1">
                        {STORE.showPrices && <span className="whitespace-nowrap text-[11px] font-bold text-[#315847]">{formatPrice(product.price)}</span>}
                        <button
                          type="button"
                          disabled={product.stock < 1 || !STORE.acceptOrders || added}
                          onClick={() => setCart((items) => [...items, product.id])}
                          aria-label={added ? "أُضيف إلى السلة" : "أضيفي إلى السلة"}
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px] transition ${
                            added ? "bg-[#e5eee3] text-[#315847]" : product.stock < 1 ? "cursor-not-allowed bg-[#f2f0e9] text-[#b2b5ac]" : "bg-[#315847] text-white hover:bg-[#244738]"
                          }`}
                        >
                          {added ? <Check size={15} /> : <ShoppingBag size={14} />}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="rounded-[20px] border border-dashed border-[#d8ded3] bg-[#f5f6ef] px-5 py-9 text-center">
              <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#6f8875]"><Search size={18} /></div>
              <p className="text-[13px] font-bold">ما لقينا منتجات بهذا الاسم</p>
              <p className="mt-1 text-[10px] text-[#879188]">جرّبي كلمة أخرى أو اختاري فئة مختلفة.</p>
              <button type="button" onClick={() => { setSearch(""); setSelectedCategory(null); }} className="mt-4 text-[11px] font-bold text-[#315847] underline underline-offset-4">عرض كل المنتجات</button>
            </div>
          )}
        </section>

        <section id="category-browse-cart" className="mx-5 mb-5 flex items-center justify-between rounded-[18px] bg-[#edf1e8] px-4 py-3.5">
          <div>
            <p className="text-[11px] font-bold">سلتك التجريبية</p>
            <p className="mt-1 text-[9px] text-[#7e8b80]">{cart.length ? `${cart.length} منتجات أُضيفت` : "أضيفي منتجاتك المفضلة هنا"}</p>
          </div>
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#315847]"><ShoppingBag size={15} /></span>
        </section>

        <footer className="border-t border-[#ecece4] px-5 py-4 text-center text-[9px] text-[#8b958b]">
          <span>ميدانيك · عناية يومية ببساطة</span>
          <span className="mx-2 text-[#c2c9bf]">•</span>
          <span>معاينة تصميم فقط</span>
        </footer>
      </div>
    </main>
  );
}

export default CategoryBrowse;
