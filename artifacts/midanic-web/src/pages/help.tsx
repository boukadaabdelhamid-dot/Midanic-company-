import { useTranslation } from 'react-i18next';
import { Link } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { BookOpen, Video, MessageCircle, Search } from 'lucide-react';
import { useState } from 'react';

export default function Help() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');

  const resources = [
    {
      icon: BookOpen,
      title: t('help.getting_started'),
      description: 'Quick start guides and tutorials to get you up and running',
      link: '/help/getting-started',
    },
    {
      icon: BookOpen,
      title: t('help.documentation'),
      description: 'Comprehensive documentation for all our products',
      link: '/help/docs',
    },
    {
      icon: Video,
      title: t('help.video_tutorials'),
      description: 'Step-by-step video guides and demonstrations',
      link: '/help/videos',
    },
    {
      icon: MessageCircle,
      title: t('help.contact_support'),
      description: 'Get help from our support team',
      link: '/contact',
    },
  ];

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

          <div className="relative max-w-xl mx-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type="search"
              placeholder={t('help.search_placeholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
              data-testid="input-search"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {resources.map((resource, index) => (
            <Link key={index} href={resource.link} data-testid={`card-resource-${index}`}>
              <Card className="h-full hover:border-primary transition-colors cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <resource.icon className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg mb-2">{resource.title}</h3>
                      <p className="text-sm text-muted-foreground">{resource.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <div className="mt-12 text-center">
          <p className="text-muted-foreground mb-4">
            Can't find what you're looking for?
          </p>
          <Link href="/contact" data-testid="link-contact">
            <Button size="lg">
              {t('help.contact_support')}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
