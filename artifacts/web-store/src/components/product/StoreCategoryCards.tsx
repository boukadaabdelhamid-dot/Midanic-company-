import { Link } from "wouter";
import { ArrowLeft, ArrowRight, Layers3, RotateCw } from "lucide-react";
import type { Product } from "@workspace/erp-api-client-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { resolveImg } from "@/lib/utils";

export type StoreProductType = {
  id: number;
  nameAr: string;
  nameFr?: string;
  nameEn?: string;
  imageUrl?: string | null;
};

type Props = {
  categories: StoreProductType[];
  featuredCategoryIds: number[];
  products: Product[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  lang: "ar" | "en" | "fr";
};

export function StoreCategoryCards({ categories, featuredCategoryIds, products, isLoading, isError, onRetry, lang }: Props) {
  const isAr = lang === "ar";
  const isFr = lang === "fr";
  const visibleCategories = featuredCategoryIds.length > 0
    ? featuredCategoryIds.flatMap((id) => {
        const category = categories.find((item) => item.id === id);
        return category ? [category] : [];
      })
    : categories;
  const allLabel = isAr ? "كل المنتجات" : isFr ? "Tous les produits" : "All products";
  const errorLabel = isAr ? "تعذّر تحميل الفئات." : isFr ? "Impossible de charger les catégories." : "Categories could not be loaded.";
  const emptyLabel = isAr ? "لا توجد فئات متاحة حالياً." : isFr ? "Aucune catégorie disponible pour le moment." : "No categories are available right now.";
  const retryLabel = isAr ? "إعادة المحاولة" : isFr ? "Réessayer" : "Try again";

  return (
    <section className="sf-categories" id="store-categories" aria-labelledby="store-category-title">
      <div className="sf-section-heading">
        <div>
          <span className="sf-kicker">{isAr ? "اكتشف حسب الفئة" : isFr ? "DÉCOUVREZ LA COLLECTION" : "EXPLORE THE COLLECTION"}</span>
          <h2 id="store-category-title">{isAr ? "فئات المنتجات" : isFr ? "Acheter par catégorie" : "Shop by category"}</h2>
        </div>
      </div>
      {isLoading ? (
        <div className="sf-category-grid" aria-label={isAr ? "جارٍ تحميل الفئات" : isFr ? "Chargement des catégories" : "Loading categories"}>
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-[86px] rounded-2xl" />
          ))}
        </div>
      ) : isError ? (
        <div className="sf-inline-state" role="alert">
          <p>{errorLabel}</p>
          <Button variant="outline" size="sm" onClick={onRetry}><RotateCw size={15} />{retryLabel}</Button>
        </div>
      ) : visibleCategories.length === 0 ? (
        <div className="sf-inline-state"><p>{emptyLabel}</p></div>
      ) : (
        <div className="sf-category-grid">
          <Link className="sf-category-card sf-category-all" href="/products">
            <span className="sf-category-image"><Layers3 size={22} aria-hidden="true" /></span>
            <span className="sf-category-copy"><strong>{allLabel}</strong></span>
            <span className="sf-category-arrow" aria-hidden="true">{isAr ? <ArrowLeft size={16} /> : <ArrowRight size={16} />}</span>
          </Link>
          {visibleCategories.map((category) => {
            const label = isAr ? category.nameAr : isFr ? category.nameFr || category.nameEn || "" : category.nameEn || "";
            const filterValue = category.nameFr || category.nameEn || "";
            const matchingProduct = products.find((product) =>
              product.catalogueType?.trim().toLocaleLowerCase() === filterValue.trim().toLocaleLowerCase(),
            );
            const imageUrl = category.imageUrl || matchingProduct?.primaryImage || matchingProduct?.imageUrl;
            return (
              <Link
                key={category.id}
                className="sf-category-card"
                href={`/products?type=${encodeURIComponent(filterValue)}`}
              >
                <span className="sf-category-image">
                  {imageUrl
                    ? <img src={resolveImg(imageUrl)} alt="" loading="lazy" />
                    : <Layers3 size={22} aria-hidden="true" />}
                </span>
                <span className="sf-category-copy"><strong>{label}</strong></span>
                <span className="sf-category-arrow" aria-hidden="true">{isAr ? <ArrowLeft size={16} /> : <ArrowRight size={16} />}</span>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
