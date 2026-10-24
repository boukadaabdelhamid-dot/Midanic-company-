import { useTranslation } from 'react-i18next';
import { Link } from 'wouter';
import { ArrowRight, BookOpen, MessageCircle } from 'lucide-react';

export default function Help() {
  const { t } = useTranslation();
  return (
    <div className="min-h-[100dvh] w-full py-24">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4" data-testid="text-page-title">
            {t('help.page_title')}
          </h1>
          <p className="text-lg text-muted-foreground mb-8" data-testid="text-page-subtitle">
            {t('help.page_subtitle')}
          </p>

        </div>

        <div className="mx-auto grid max-w-4xl gap-5 md:grid-cols-[1.2fr_.8fr]">
          <Link href="/faq" className="group rounded-3xl border bg-card p-8 transition-colors hover:border-primary" data-testid="link-help-faq">
            <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><BookOpen /></div>
            <h2 className="editorial-title mb-3 text-3xl">{t('help.faq_title')}</h2>
            <p className="mb-8 leading-relaxed text-muted-foreground">{t('help.faq_description')}</p>
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary">{t('help.browse_faq')} <ArrowRight className="h-4 w-4" /></span>
          </Link>
          <div className="rounded-3xl bg-[#173748] p-8 text-[#f5f1e7]">
            <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-[#a8d5ca]"><MessageCircle /></div>
            <h2 className="editorial-title mb-3 text-3xl">{t('help.contact_title')}</h2>
            <p className="mb-8 leading-relaxed text-white/75">{t('help.contact_description')}</p>
            <Link href="/contact" className="inline-flex items-center gap-2 rounded-md bg-[#bd8050] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#ca8d5c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" data-testid="link-help-contact">
              {t('help.contact_support')} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
