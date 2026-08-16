import { useState } from 'react';
import { Link } from 'wouter';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, ArrowRight } from 'lucide-react';
import { useListProducts } from '@workspace/api-client-react';

export default function Products() {
  const { t } = useTranslation();
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [featuredOnly, setFeaturedOnly] = useState(false);

  const { data: products, isLoading } = useListProducts(
    { category, featured: featuredOnly || undefined },
  );

  const categories = products
    ? Array.from(new Set(products.map((p) => p.category)))
    : [];

  return (
    <div className="min-h-[100dvh] w-full py-24">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="max-w-3xl mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4" data-testid="text-page-title">
            {t('products.page_title')}
          </h1>
          <p className="text-lg text-muted-foreground" data-testid="text-page-subtitle">
            {t('products.page_subtitle')}
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-8">
          <Button
            variant={!category && !featuredOnly ? 'default' : 'outline'}
            onClick={() => {
              setCategory(undefined);
              setFeaturedOnly(false);
            }}
            data-testid="button-filter-all"
          >
            {t('products.filter_all')}
          </Button>
          <Button
            variant={featuredOnly ? 'default' : 'outline'}
            onClick={() => {
              setFeaturedOnly(!featuredOnly);
              setCategory(undefined);
            }}
            data-testid="button-filter-featured"
          >
            {t('products.filter_featured')}
          </Button>
          {categories.map((cat) => (
            <Button
              key={cat}
              variant={category === cat ? 'default' : 'outline'}
              onClick={() => {
                setCategory(cat);
                setFeaturedOnly(false);
              }}
              data-testid={`button-filter-${cat}`}
            >
              {cat}
            </Button>
          ))}
        </div>

        {/* Products Grid */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground" data-testid="text-loading">
            {t('products.loading')}
          </div>
        ) : products && products.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product) => (
              <Card key={product.id} className="hover:border-primary transition-colors" data-testid={`card-product-${product.id}`}>
                <CardContent className="p-6">
                  <div className="aspect-video bg-muted rounded-md mb-4 overflow-hidden">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Download className="w-12 h-12 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{product.name}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                    {product.shortDescription || product.description}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{product.category}</span>
                    {product.trialDays && (
                      <span className="text-xs text-accent font-medium">
                        {t('products.trial_available')}
                      </span>
                    )}
                  </div>
                  <Link href={`/products/${product.slug}`} data-testid={`link-product-${product.id}`}>
                    <Button className="w-full mt-4 gap-2">
                      {t('products.view_details')}
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground" data-testid="text-no-products">
            {t('products.no_products')}
          </div>
        )}
      </div>
    </div>
  );
}
