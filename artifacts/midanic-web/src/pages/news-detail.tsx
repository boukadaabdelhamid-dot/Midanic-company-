import { useParams, Link } from 'wouter';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Calendar } from 'lucide-react';
import { useGetNewsArticle } from '@workspace/api-client-react';
import { format } from 'date-fns';

export default function NewsDetail() {
  const { t } = useTranslation();
  const params = useParams();
  const slug = params.slug || '';

  const { data: article, isLoading } = useGetNewsArticle(slug);

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] w-full flex items-center justify-center" data-testid="text-loading">
        {t('common.loading')}
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-[100dvh] w-full flex items-center justify-center" data-testid="text-not-found">
        {t('common.error')}
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] w-full py-24">
      <div className="container mx-auto px-4 max-w-4xl">
        <Link href="/news" data-testid="link-back">
          <Button variant="ghost" className="mb-8 gap-2">
            <ArrowLeft className="w-4 h-4" />
            {t('common.back')}
          </Button>
        </Link>

        {article.coverImageUrl && (
          <div className="aspect-video bg-muted rounded-lg overflow-hidden mb-8">
            <img
              src={article.coverImageUrl}
              alt={article.title}
              className="w-full h-full object-cover"
              data-testid="img-cover"
            />
          </div>
        )}

        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl font-bold mb-4" data-testid="text-title">
            {article.title}
          </h1>
          {article.publishedAt && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="w-4 h-4" />
              <span>{format(new Date(article.publishedAt), 'MMMM d, yyyy')}</span>
            </div>
          )}
        </div>

        <div className="prose dark:prose-invert max-w-none" data-testid="content-body">
          <div dangerouslySetInnerHTML={{ __html: article.content }} />
        </div>
      </div>
    </div>
  );
}
