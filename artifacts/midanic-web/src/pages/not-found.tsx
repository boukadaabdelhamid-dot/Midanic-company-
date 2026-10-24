import { Link } from 'wouter';
import { Home, ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function NotFound() {
  const { t } = useTranslation();
  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="text-8xl font-bold text-primary mb-4">404</div>
        <h1 className="editorial-title text-4xl font-bold mb-4">{t('common.page_not_found')}</h1>
        <p className="text-muted-foreground mb-8">
          {t('common.page_not_found_description')}
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/" className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground" data-testid="link-home">
              <Home className="w-4 h-4" />
              {t('common.go_home')}
          </Link>
          <button className="inline-flex items-center gap-2 rounded-md border bg-background px-4 py-2 text-sm font-medium" onClick={() => window.history.back()} data-testid="button-back">
            <ArrowLeft className="w-4 h-4" />{t('common.go_back')}
          </button>
        </div>
      </div>
    </div>
  );
}
