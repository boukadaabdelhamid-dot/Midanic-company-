import { ArrowLeft, ArrowRight, Check, ShoppingBag } from "lucide-react";
import { CATEGORIES, PRODUCTS } from "./fixtures";

interface CategoryNavigationProps {
  isAr: boolean;
  selected: number | null;
  onSelect: (categoryId: number | null) => void;
}

export function CategoryNavigation({ isAr, selected, onSelect }: CategoryNavigationProps) {
  const categories = [
    { id: null, label: isAr ? "كل المنتجات" : "All products", products: PRODUCTS },
    ...CATEGORIES.map((category) => ({
      id: category.id,
      label: isAr ? category.nameAr : category.nameFr,
      products: PRODUCTS.filter((product) => product.categoryId === category.id),
    })),
  ];

  return (
    <section className="ms-discovery" id="store-categories" aria-labelledby="store-categories-heading">
      <div className="ms-discovery-heading">
        <div>
          <span className="ms-section-kicker">{isAr ? "تصفحي حسب حاجتك" : "Find your everyday care"}</span>
          <h2 id="store-categories-heading">{isAr ? "فئات المنتجات" : "Shop by category"}</h2>
        </div>
        <span className="ms-discovery-count">
          {CATEGORIES.length} {isAr ? "فئات" : "categories"}
        </span>
      </div>
      <div className="ms-category-cards">
        {categories.map((category) => {
          const active = selected === category.id;
          const count = category.products.length;
          const image = category.products[0]?.primaryImage || category.products[0]?.imageUrl;
          return (
            <button
              key={category.id ?? "all"}
              type="button"
              className={`ms-category-card${active ? " is-selected" : ""}${category.id === null ? " is-all" : ""}`}
              aria-pressed={active}
              aria-controls="store-products"
              onClick={() => onSelect(category.id)}
            >
              <span className="ms-category-thumbnail">
                {category.id === null ? <ShoppingBag size={22} /> : image ? <img src={image} alt="" loading="lazy" /> : <ShoppingBag size={22} />}
              </span>
              <span className="ms-category-card-copy">
                <strong>{category.label}</strong>
                <small>{isAr ? (count === 1 ? "منتج واحد" : `${count} منتجات`) : `${count} ${count === 1 ? "product" : "products"}`}</small>
              </span>
              <span className="ms-category-card-arrow" aria-hidden="true">
                {active ? <Check size={16} /> : isAr ? <ArrowLeft size={16} /> : <ArrowRight size={16} />}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
