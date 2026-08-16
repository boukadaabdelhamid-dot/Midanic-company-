import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Award, Lightbulb, Shield, Users } from 'lucide-react';

export default function About() {
  const { t } = useTranslation();

  const values = [
    {
      icon: Award,
      title: t('about.quality'),
      description: t('about.quality_desc'),
    },
    {
      icon: Lightbulb,
      title: t('about.innovation'),
      description: t('about.innovation_desc'),
    },
    {
      icon: Users,
      title: t('about.support'),
      description: t('about.support_desc'),
    },
    {
      icon: Shield,
      title: t('about.integrity'),
      description: t('about.integrity_desc'),
    },
  ];

  return (
    <div className="min-h-[100dvh] w-full py-24">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold mb-4" data-testid="text-page-title">
            {t('about.page_title')}
          </h1>
          <p className="text-lg text-muted-foreground" data-testid="text-page-subtitle">
            {t('about.page_subtitle')}
          </p>
        </div>

        <div className="max-w-4xl mx-auto space-y-16">
          <section>
            <h2 className="text-2xl md:text-3xl font-bold mb-6" data-testid="text-our-story">
              {t('about.our_story')}
            </h2>
            <div className="prose dark:prose-invert max-w-none">
              <p className="text-lg text-muted-foreground leading-relaxed">
                Midanic was founded with a clear vision: to provide Algerian businesses with professional-grade software
                that meets international standards while understanding local market needs. We build tools that help
                businesses operate more efficiently, scale confidently, and compete globally.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl md:text-3xl font-bold mb-6" data-testid="text-our-mission">
              {t('about.our_mission')}
            </h2>
            <div className="prose dark:prose-invert max-w-none">
              <p className="text-lg text-muted-foreground leading-relaxed">
                Our mission is to empower Algerian enterprises with reliable, innovative, and user-friendly software
                solutions. We believe that local businesses deserve world-class tools, supported by people who understand
                their unique challenges and opportunities.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl md:text-3xl font-bold mb-8" data-testid="text-our-values">
              {t('about.our_values')}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {values.map((value, index) => (
                <Card key={index} data-testid={`card-value-${index}`}>
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <value.icon className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg mb-2">{value.title}</h3>
                        <p className="text-muted-foreground">{value.description}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
