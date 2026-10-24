import { useTranslation } from 'react-i18next';

export default function Terms() {
  const { t, i18n } = useTranslation();
  const sections = ['agreement', 'license', 'types', 'restrictions', 'payment', 'support', 'termination', 'liability', 'contact'];

  return (
    <div className="min-h-[100dvh] w-full py-20 md:py-28">
      <div className="container mx-auto max-w-4xl px-4">
        <p className="eyebrow mb-4">{t('footer.legal')}</p>
        <h1 className="editorial-title mb-5 text-5xl md:text-6xl" data-testid="text-page-title">{t('terms.title')}</h1>
        <p className="mb-12 text-muted-foreground">{t('terms.updated', { date: new Date().toLocaleDateString(i18n.language) })}</p>
        <div className="space-y-10">
          {sections.map((section) => (
            <section key={section} className="border-t pt-7">
              <h2 className="mb-3 text-xl font-semibold">{t(`terms.${section}_title`)}</h2>
              <p className="max-w-3xl leading-8 text-muted-foreground">{t(`terms.${section}_body`)}</p>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
