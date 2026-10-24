import React from "react";
import { Link, useLocation } from "wouter";
import { getGetProductQueryKey, getGetProductQueryOptions, getGetProductsQueryKey, useGetProducts } from "@workspace/erp-api-client-react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check, Search, ShoppingBag, Sparkles } from "lucide-react";
import { resolveImg } from "@/lib/utils";
import { ProductCard } from "@/components/product/ProductCard";
import { StoreCategoryCards, type StoreProductType } from "@/components/product/StoreCategoryCards";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLang } from "@/hooks/use-lang";
import { useStoreConfig } from "@/hooks/use-store-config";
import { getApiBase } from "../lib/api-base";
import { getStoreRequestHeaders } from "../lib/store-headers";
import "./storefront.css";

const API_BASE = getApiBase();
const FALLBACK_HERO = "https://images.unsplash.com/photo-1556228578-0d85b1a4d571?q=80&w=2000&auto=format&fit=crop";

export default function Home() {
  const { lang } = useLang();
  const isAr = lang === "ar";
  const isFr = lang === "fr";
  const [, setLocation] = useLocation();
  const {
    bannerUrl,
    description,
    acceptOrders,
    nameAr,
    nameEn,
    featuredProductIds,
    featuredCategoryIds,
  } = useStoreConfig();
  const productParams = { limit: 100, filterExposed: "true" };
  const productList = useGetProducts(productParams, {
    query: {
      queryKey: getGetProductsQueryKey(productParams),
      staleTime: 30_000,
      refetchOnWindowFocus: "always",
    },
  });
  const typeQuery = useQuery<StoreProductType[]>({
    queryKey: ["/api/product-types"],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/api/product-types`, {
        headers: getStoreRequestHeaders(),
      });
      if (!response.ok) throw new Error(`Could not load product categories (${response.status})`);
      return response.json() as Promise<StoreProductType[]>;
    },
    staleTime: 5 * 60 * 1000,
  });
  const featuredQueries = useQueries({
    queries: featuredProductIds.map((id) =>
      getGetProductQueryOptions(id, {
        query: {
          queryKey: getGetProductQueryKey(id),
          enabled: true,
          retry: false,
          staleTime: 30_000,
          refetchOnWindowFocus: "always",
        },
      }),
    ),
  });
  const isFeaturedLoading = featuredQueries.some((query) => query.isLoading);
  const featuredProducts = featuredQueries.flatMap((query) =>
    query.data && query.data.isExposed !== false ? [query.data] : [],
  );
  const products = featuredProductIds.length > 0
    ? featuredProducts
    : (productList.data?.products ?? []).slice(0, 8);
  const productsLoading = featuredProductIds.length > 0 ? isFeaturedLoading : productList.isLoading;
  const productsError = featuredProductIds.length > 0
    ? featuredQueries.some((query) => query.isError)
    : productList.isError;
  const heroImage = resolveImg(bannerUrl) ?? FALLBACK_HERO;
  const storeName = isAr ? nameAr : nameEn;
  const copy = {
    eyebrow: isAr ? "اختيارات تناسبك" : isFr ? "UNE SÉLECTION POUR VOUS" : "A collection for you",
    heroTitle: isAr ? `اكتشف منتجات ${storeName}` : isFr ? `Découvrez ${storeName}` : `Discover ${storeName}`,
    intro: isAr
      ? "تصفّح مجموعة المتجر واكتشف ما يناسبك."
      : isFr ? "Parcourez la sélection de la boutique et trouvez vos favoris."
      : "Explore the store collection and find what works for you.",
    browse: isAr ? "تصفّح المنتجات" : isFr ? "Voir les produits" : "Browse products",
    featured: featuredProductIds.length > 0
      ? (isAr ? "اختيارات المتجر" : isFr ? "La sélection de la boutique" : "The store edit")
      : (isAr ? "منتجات المتجر" : isFr ? "Produits de la boutique" : "Store products"),
    featuredHint: featuredProductIds.length > 0
      ? (isAr ? "منتجات مختارة من المتجر" : isFr ? "Une sélection de cette boutique" : "A selection from this store")
      : (isAr ? "تصفّح المنتجات المتاحة في المتجر" : isFr ? "Parcourez les produits disponibles dans cette boutique" : "Browse the products available in this store"),
    allProducts: isAr ? "كل المنتجات" : isFr ? "Tous les produits" : "View all products",
    searchPlaceholder: isAr ? "ابحث عن منتج..." : isFr ? "Rechercher des produits…" : "Search products...",
    searchLabel: isAr ? "بحث المنتجات" : isFr ? "Rechercher des produits" : "Search products",
    stockNote: isAr ? "تصفح بسهولة، واختر ما يناسبك" : isFr ? "Parcourez la boutique et trouvez vos favoris." : "Browse easily. Find your favorites.",
    productsError: isAr ? "تعذّر تحميل المنتجات." : isFr ? "Impossible de charger les produits." : "Products could not be loaded.",
    retry: isAr ? "إعادة المحاولة" : isFr ? "Réessayer" : "Try again",
    emptyProducts: featuredProductIds.length > 0
      ? (isAr ? "لا توجد منتجات مميزة حالياً." : isFr ? "Aucun produit mis en avant pour le moment." : "No featured products are available right now.")
      : (isAr ? "لا توجد منتجات متاحة حالياً." : isFr ? "Aucun produit disponible pour le moment." : "No products are available right now."),
    ordersPaused: isAr ? "الطلبات متوقفة مؤقتاً. يمكنك متابعة تصفح المنتجات." : isFr ? "Les commandes sont temporairement suspendues. Vous pouvez continuer à parcourir les produits." : "Orders are temporarily paused. You can continue browsing.",
  };

  const scrollToProducts = () => document.getElementById("store-products")?.scrollIntoView({ behavior: "smooth" });
  const openSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = String(form.get("search") ?? "").trim();
    setLocation(value ? `/products?search=${encodeURIComponent(value)}` : "/products");
  };

  return (
    <div className="storefront-home" dir={isAr ? "rtl" : "ltr"}>
      {!acceptOrders && <div className="sf-order-notice" role="status">{copy.ordersPaused}</div>}
      <section className="sf-hero" id="top">
        <img className="sf-hero-image" src={heroImage} alt="" />
        <div className="sf-hero-shade" />
        <div className="sf-hero-copy">
          <span className="sf-eyebrow"><Sparkles size={15} aria-hidden="true" />{copy.eyebrow}</span>
          <h1>{copy.heroTitle}</h1>
          <p>{description || copy.intro}</p>
          <div className="sf-hero-actions">
            <Button className="sf-primary-button" onClick={scrollToProducts}>
              {copy.browse}{isAr ? <ArrowLeft size={17} /> : <ArrowRight size={17} />}
            </Button>
            <span className="sf-hero-proof"><Check size={15} />{copy.stockNote}</span>
          </div>
        </div>
        <span className="sf-hero-caption">{storeName}</span>
      </section>

      <StoreCategoryCards
        categories={typeQuery.data ?? []}
        featuredCategoryIds={featuredCategoryIds}
        products={productList.data?.products ?? []}
        isLoading={typeQuery.isLoading}
        isError={typeQuery.isError}
        onRetry={() => { void typeQuery.refetch(); }}
        lang={lang}
      />

      <section className="sf-collection" id="store-products">
        <div className="sf-collection-heading">
          <div>
            <span className="sf-kicker">{isAr ? "المجموعة" : isFr ? "LA COLLECTION" : "THE COLLECTION"}</span>
            <h2>{copy.featured}</h2>
            <p>{copy.featuredHint}</p>
          </div>
          <Link href="/products" className="sf-view-all">
            {copy.allProducts}{isAr ? <ArrowLeft size={16} /> : <ArrowRight size={16} />}
          </Link>
        </div>

        <div className="sf-tools">
          <form className="sf-search" onSubmit={openSearch} role="search">
            <Search size={18} aria-hidden="true" />
            <input name="search" type="search" placeholder={copy.searchPlaceholder} aria-label={copy.searchLabel} />
            <button type="submit" aria-label={copy.searchLabel}>{isAr ? "بحث" : isFr ? "Rechercher" : "Search"}</button>
          </form>
          <span className="sf-result-count" aria-live="polite">
            {productsLoading ? (isAr ? "جارٍ التحميل…" : isFr ? "Chargement…" : "Loading…") : products.length}
          </span>
        </div>

        {productsLoading ? (
          <div className="sf-product-grid" aria-label={isAr ? "جارٍ تحميل المنتجات" : isFr ? "Chargement des produits" : "Loading products"}>
            {Array.from({ length: 4 }).map((_, index) => (
              <div className="sf-skeleton-card" key={index}>
                <Skeleton className="aspect-[4/5] w-full rounded-xl" />
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        ) : productsError ? (
          <div className="sf-query-state" role="alert">
            <p>{copy.productsError}</p>
            <Button
              variant="outline"
              onClick={() => {
                if (featuredProductIds.length > 0) {
                  void Promise.all(featuredQueries.map((query) => query.refetch()));
                } else {
                  void productList.refetch();
                }
              }}
            >
              {copy.retry}
            </Button>
          </div>
        ) : products.length > 0 ? (
          <div className="sf-product-grid">
            {products.map((product) => <ProductCard key={product.id} product={product} />)}
          </div>
        ) : (
          <div className="sf-query-state">
            <ShoppingBag size={25} aria-hidden="true" />
            <p>{copy.emptyProducts}</p>
            <Link href="/products" className="sf-text-link">{copy.allProducts}</Link>
          </div>
        )}
      </section>
    </div>
  );
}
