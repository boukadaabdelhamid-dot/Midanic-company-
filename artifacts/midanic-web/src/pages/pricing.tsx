import { useTranslation } from 'react-i18next';
import { Link } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';

export default function Pricing() {
  const { t } = useTranslation();

  const plans = [
    {
      name: t('pricing.trial'),
      description: t('pricing.trial_desc'),
      details: t('pricing.trial_days'),
      action: 'trial',
    },
    {
      name: t('pricing.monthly'),
      description: t('pricing.monthly_desc'),
      action: 'contact',
    },
    {
      name: t('pricing.quarterly'),
      description: t('pricing.quarterly_desc'),
      action: 'contact',
    },
    {
      name: t('pricing.semi_annual'),
      description: t('pricing.semi_annual_desc'),
      action: 'contact',
    },
    {
      name: t('pricing.yearly'),
      description: t('pricing.yearly_desc'),
      action: 'contact',
      featured: true,
    },
    {
      name: t('pricing.lifetime'),
      description: t('pricing.lifetime_desc'),
      action: 'contact',
    },
  ];

  return (
    <div className="min-h-[100dvh] w-full py-24">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold mb-4" data-testid="text-page-title">
            {t('pricing.page_title')}
          </h1>
          <p className="text-lg text-muted-foreground" data-testid="text-page-subtitle">
            {t('pricing.page_subtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {plans.map((plan, index) => (
            <Card
              key={index}
              className={plan.featured ? 'border-primary shadow-lg' : ''}
              data-testid={`card-plan-${index}`}
            >
              <CardHeader>
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {plan.details && (
                  <div className="text-3xl font-bold">{plan.details}</div>
                )}
                {plan.action === 'trial' ? (
                  <Link href="/trial" data-testid={`link-action-${index}`}>
                    <Button className="w-full" variant={plan.featured ? 'default' : 'outline'}>
                      {t('pricing.request_quote')}
                    </Button>
                  </Link>
                ) : (
                  <Link href="/contact" data-testid={`link-action-${index}`}>
                    <Button className="w-full" variant={plan.featured ? 'default' : 'outline'}>
                      {t('pricing.contact_sales')}
                    </Button>
                  </Link>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-16 text-center">
          <p className="text-muted-foreground mb-4">
            All plans include full access to product features and local support.
          </p>
          <Link href="/contact" data-testid="link-contact-sales">
            <Button size="lg" variant="outline">
              {t('pricing.contact_sales')}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
