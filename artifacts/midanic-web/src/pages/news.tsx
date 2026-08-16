import { Link } from 'wouter';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from 'lucide-react';
import { useListNews } from '@workspace/api-client-react';
import { format } from 'date-fns';
import { useState } from 'react';

export default function News() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const { data, isLoading } = useListNews({ page, limit: 9 });

  return (
    <div className="min-h-[100dvh] w-full py-24">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4" data-testid="text-page-title">
            {t('news.page_title')}
          </h1>
          <p className="text-lg text-muted-foreground" data-testid="text-page-subtitle">
            {t('news.page_subtitle')}
          </p>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground" data-testid="text-loading">
            {t('news.loading')}
          </div>
        ) : data && data.articles.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {data.articles.map((article) => (
                <Link key={article.id} href={`/news/${article.slug}`} data-testid={`card-article-${article.id}`}>
                  <Card className="h-full hover:border-primary transition-colors cursor-pointer">
                    <CardContent className="p-6">
                      {article.coverImageUrl && (
                        <div className="aspect-video bg-muted rounded-md mb-4 overflow-hidden">
                          <img
                            src={article.coverImageUrl}
                            alt={article.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <h3 className="text-lg font-semibold mb-2 line-clamp-2">{article.title}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
                        {article.excerpt}
                      </p>
                      {article.publishedAt && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Calendar className="w-3 h-3" />
                          <span>{format(new Date(article.publishedAt), 'MMM d, yyyy')}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="outline"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                data-testid="button-prev"
              >
                {t('common.previous')}
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {Math.ceil(data.total / 9)}
              </span>
              <Button
                variant="outline"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= Math.ceil(data.total / 9)}
                data-testid="button-next"
              >
                {t('common.next')}
              </Button>
            </div>
          </>
        ) : (
          <div className="text-center py-12 text-muted-foreground" data-testid="text-no-articles">
            {t('news.no_articles')}
          </div>
        )}
      </div>
    </div>
  );
}
