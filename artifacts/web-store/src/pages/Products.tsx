import React, { useEffect, useState } from "react";
import { getGetProductsQueryKey, useGetProducts } from "@workspace/erp-api-client-react";
import { useQuery } from "@tanstack/react-query";
import { ProductCard } from "@/components/product/ProductCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Filter, RotateCw } from "lucide-react";
import { useLang } from "@/hooks/use-lang";
import { getApiBase } from "../lib/api-base";
import { getStoreRequestHeaders } from "../lib/store-headers";

const API_BASE = getApiBase();

type ProductType = { id: number; nameFr?: string; nameEn?: string; nameAr: string; imageUrl?: string | null };

export default function Products() {
  const { lang } = useLang();
  const isFr = lang === "fr";
  const [searchParams] = useState(() => new URLSearchParams(window.location.search));
  const initialType = searchParams.get("type") || undefined;

  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [activeType, setActiveType] = useState<string | undefined>(initialType);
  const [page, setPage] = useState(1);
  const pageSize = 24;

  const { data: productTypes, isError: isTypesError, refetch: refetchTypes } = useQuery<ProductType[]>({
    queryKey: ["/api/product-types"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/product-types`, {
        headers: getStoreRequestHeaders(),
      });
      if (!res.ok) throw new Error(`Could not load product categories (${res.status})`);
      return res.json() as Promise<ProductType[]>;
    },
    staleTime: 5 * 60 * 1000,
  });

  const productParams = {
    search: search || undefined,
    filterCatalogueType: activeType,
    filterExposed: "true",
    page,
    limit: pageSize,
  };
  const { data: productsRes, isLoading, isError, isFetching, refetch } = useGetProducts(
    productParams,
    { query: {
      queryKey: getGetProductsQueryKey(productParams),
      refetchInterval: 15_000,
      refetchOnWindowFocus: "always",
    } },
  );
  const products = productsRes?.products ?? [];
  const total = productsRes?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const categoryLabel = (type: ProductType) => isFr
    ? type.nameFr || type.nameEn || ""
    : type.nameEn || type.nameFr || "";

  // Hiding the last product on a page must not strand visitors on an empty page.
  useEffect(() => {
    if (productsRes && page > totalPages) setPage(totalPages);
  }, [productsRes, page, totalPages]);

  return (
    <div className="container mx-auto px-4 py-12 md:py-20" dir={lang === "ar" ? "rtl" : "ltr"}>
      <div className="mb-16 text-center max-w-2xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-serif font-bold mb-4 text-foreground">
          {lang === 'ar' ? 'مجموعتنا' : isFr ? 'Notre collection' : 'Our Collection'}
        </h1>
        <p className="text-lg text-muted-foreground">
          {lang === 'ar' ? 'تصفّح المنتجات المتاحة في هذا المتجر.' : isFr ? 'Découvrez les produits disponibles dans cette boutique.' : 'Browse products available from this store.'}
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-10">
        {/* Sidebar Filters */}
        <div className="w-full md:w-64 flex flex-col gap-8 shrink-0">
          <div className="relative">
            <Search className={`absolute ${lang === "ar" ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground`} />
            <Input
              placeholder={lang === 'ar' ? "بحث..." : isFr ? "Rechercher…" : "Search..."}
              className={`${lang === "ar" ? "pr-10" : "pl-10"} h-12 bg-background border-border/60 focus-visible:border-primary`}
              dir={lang === "ar" ? "rtl" : "ltr"}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              data-testid="input-search"
            />
          </div>

          <div>
            <div className="flex items-center gap-2 mb-4 pb-2 border-b">
              <Filter className="h-5 w-5 text-primary" />
              <h3 className="font-serif font-semibold text-lg">
                {lang === 'ar' ? 'الفئات' : isFr ? 'Catégories' : 'Categories'}
              </h3>
            </div>
            <div className="flex flex-col gap-1">
              <Button
                variant={activeType === undefined ? "secondary" : "ghost"}
                className={`justify-start font-medium ${activeType === undefined ? 'bg-secondary/50' : ''}`}
                onClick={() => { setActiveType(undefined); setPage(1); }}
                data-testid="btn-category-all"
              >
                {lang === 'ar' ? 'جميع المنتجات' : isFr ? 'Tous les produits' : 'All Products'}
              </Button>
              {productTypes?.map((type) => (
                <Button
                  key={type.id}
                  variant={activeType === categoryLabel(type) ? "secondary" : "ghost"}
                  className={`justify-start font-medium text-left ${activeType === categoryLabel(type) ? 'bg-secondary/50 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                  onClick={() => { setActiveType(categoryLabel(type)); setPage(1); }}
                  data-testid={`btn-category-${type.id}`}
                >
                  <span dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                    {lang === 'ar' ? type.nameAr : categoryLabel(type)}
                  </span>
                </Button>
              ))}
              {isTypesError && (
                <div className="mt-2 text-sm text-destructive" role="alert">
                  <p>{lang === "ar" ? "تعذّر تحميل الفئات." : isFr ? "Impossible de charger les catégories." : "Categories could not be loaded."}</p>
                  <Button type="button" variant="link" className="h-auto px-0" onClick={() => { void refetchTypes(); }}>
                    <RotateCw className="mr-1 h-3 w-3" />
                    {lang === "ar" ? "إعادة المحاولة" : isFr ? "Réessayer" : "Try again"}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Product Grid */}
        <div className="flex-1">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-4">
                  <Skeleton className="aspect-[4/5] w-full rounded-lg" />
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))}
            </div>
          ) : isError ? (
            <div className="text-center py-32 bg-muted/20 border border-border/40 rounded-xl flex flex-col items-center justify-center">
              <p className="text-xl text-muted-foreground font-serif mb-6" role="alert">
                {lang === 'ar' ? 'تعذّر تحميل المنتجات حالياً.' : isFr ? 'Impossible de charger les produits pour le moment.' : 'Products could not be loaded right now.'}
              </p>
              <Button
                variant="outline"
                size="lg"
                className="rounded-full px-8"
                onClick={() => { void refetch(); }}
              >
                <RotateCw className="mr-2 h-4 w-4" />
                {lang === 'ar' ? 'إعادة المحاولة' : isFr ? 'Réessayer' : 'Try again'}
              </Button>
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-32 bg-muted/20 border border-border/40 rounded-xl flex flex-col items-center justify-center">
              <p className="text-xl text-muted-foreground font-serif mb-6">
                {lang === 'ar' ? 'لم يتم العثور على منتجات تطابق بحثك.' : isFr ? 'Aucun produit ne correspond à votre recherche.' : 'No products found matching your criteria.'}
              </p>
              <Button
                variant="outline"
                size="lg"
                className="rounded-full px-8"
                onClick={() => { setSearch(""); setActiveType(undefined); setPage(1); }}
              >
                {lang === 'ar' ? 'مسح الفلاتر' : isFr ? 'Effacer les filtres' : 'Clear Filters'}
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-10">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
          {!isLoading && !isError && total > 0 && (
            <nav
              className="mt-10 flex flex-wrap items-center justify-center gap-4"
              aria-label={lang === "ar" ? "صفحات المنتجات" : isFr ? "Pages de produits" : "Product pages"}
              dir={lang === "ar" ? "rtl" : "ltr"}
            >
              <Button
                variant="outline"
                disabled={page <= 1 || isFetching}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                data-testid="products-previous-page"
              >
                {lang === "ar" ? "السابق" : isFr ? "Précédent" : "Previous"}
              </Button>
              <span className="text-sm text-muted-foreground" aria-live="polite" data-testid="products-page-status">
                {lang === "ar"
                  ? `الصفحة ${page} من ${totalPages} — ${total} منتجًا`
                  : isFr ? `Page ${page} sur ${totalPages} — ${total} produits`
                  : `Page ${page} of ${totalPages} — ${total} products`}
              </span>
              <Button
                variant="outline"
                disabled={page >= totalPages || isFetching}
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                data-testid="products-next-page"
              >
                {lang === "ar" ? "التالي" : isFr ? "Suivant" : "Next"}
              </Button>
            </nav>
          )}
        </div>
      </div>
    </div>
  );
}
