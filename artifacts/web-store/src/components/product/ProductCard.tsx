import { Link } from "wouter";
import { type Product } from "@workspace/erp-api-client-react";
import { useLang } from "@/hooks/use-lang";
import { useStoreConfig } from "@/hooks/use-store-config";
import { Button } from "@/components/ui/button";
import { useStoreCart } from "@/hooks/use-store-cart";
import { useToast } from "@/hooks/use-toast";
import { resolveImg } from "@/lib/utils";
import { Plus } from "lucide-react";

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const { lang } = useLang();
  const isFr = lang === "fr";
  const { toast } = useToast();
  const addToCart = useStoreCart();
  const { showPrices, showStock, acceptOrders } = useStoreConfig();

  const handleAddToCart = () => {
    addToCart.add(product, 1).then(() => {
          toast({
            title: lang === "ar" ? "تمت الإضافة إلى السلة" : isFr ? "Ajouté au panier" : "Added to Cart",
            description: lang === "ar" ? product.nameAr : product.nameEn,
          });
        }).catch((err: Error) => {
          toast({
            title: lang === 'ar' ? 'خطأ' : isFr ? "Erreur" : 'Error',
            description: err.message || (lang === 'ar' ? 'تعذّرت الإضافة إلى السلة' : isFr ? "Impossible d’ajouter au panier" : 'Could not add to cart'),
            variant: "destructive"
          });
        });
  };

  const outOfStock = product.stock === 0;
  const canOrder = acceptOrders && !outOfStock;
  const productName = lang === "ar" ? product.nameAr : product.nameEn;
  const formattedPrice = Number.isFinite(Number(product.price))
    ? new Intl.NumberFormat(lang === "ar" ? "ar-DZ" : lang === "fr" ? "fr-FR" : "en-US", { maximumFractionDigits: 2 }).format(Number(product.price))
    : product.price;

  return (
    <article className="store-product-card group flex min-w-0 flex-col gap-3" data-testid={`card-product-${product.id}`}>
      <Link href={`/products/${product.id}`} className="store-product-image-link" aria-label={`${lang === "ar" ? "عرض تفاصيل" : isFr ? "Voir le détail" : "View details"}: ${productName}`}>
        <div className="store-product-image relative aspect-[4/5] overflow-hidden rounded-lg bg-muted/30">
          {(product.primaryImage ?? product.imageUrl) ? (
            <img
              src={resolveImg(product.primaryImage ?? product.imageUrl)}
              alt={productName}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <span className="store-no-image grid h-full w-full place-items-center text-sm text-muted-foreground">
              {lang === "ar" ? "لا توجد صورة" : isFr ? "Aucune image" : "No image"}
            </span>
          )}
          {showStock && (
            <span className={`store-stock-tag absolute start-2 top-2 rounded bg-background/90 px-2 py-1 text-[10px]${outOfStock ? " is-out" : ""}`}>
              {outOfStock
                ? (lang === "ar" ? "نفد من المخزون" : isFr ? "Épuisé" : "Out of stock")
                : (lang === "ar" ? "متوفر" : isFr ? "En stock" : "In stock")}
            </span>
          )}
          <span className="store-card-quick absolute inset-x-3 bottom-3 flex min-h-10 items-center justify-center bg-background/95 text-xs opacity-0 transition-opacity group-hover:opacity-100">
            {lang === "ar" ? "التفاصيل" : isFr ? "Voir le produit" : "View details"}
          </span>
        </div>
      </Link>

      <div className="store-product-details flex flex-1 flex-col">
        {product.catalogueType && <span className="store-product-category mb-1 text-xs text-muted-foreground">{product.catalogueType}</span>}
        <Link href={`/products/${product.id}`} className="store-product-title line-clamp-2 font-serif text-lg font-semibold text-foreground hover:text-primary" dir={lang === "ar" ? "rtl" : "ltr"}>
          {productName}
        </Link>
        <div className="store-product-bottom mt-auto flex min-h-11 flex-wrap items-center justify-between gap-2 pt-2">
          {showPrices
            ? <strong className="store-product-price whitespace-nowrap font-bold text-primary">{lang === "ar" ? `${formattedPrice} دج` : `${formattedPrice} DZD`}</strong>
            : <span />}
          <Button
            type="button"
            variant="outline"
            className="store-add-button h-9 px-3 text-xs"
            onClick={handleAddToCart}
            disabled={!canOrder || addToCart.isPending}
            data-testid={`button-quick-add-${product.id}`}
          >
            <Plus className="h-4 w-4" />
            <span>{!acceptOrders
              ? (lang === "ar" ? "الطلبات متوقفة" : isFr ? "Commandes suspendues" : "Orders paused")
              : outOfStock
                ? (lang === "ar" ? "نفد من المخزون" : isFr ? "Épuisé" : "Out of stock")
                : (lang === "ar" ? "أضف إلى السلة" : isFr ? "Ajouter au panier" : "Add to bag")}</span>
          </Button>
        </div>
        {showStock && !outOfStock && (
          <span className="store-stock-note text-xs text-muted-foreground">{lang === "ar" ? `متوفر: ${product.stock}` : isFr ? `En stock : ${product.stock}` : `${product.stock} available`}</span>
        )}
      </div>
    </article>
  );
}
