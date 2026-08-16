import { useParams, Link } from 'wouter';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, Calendar, HardDrive, Monitor } from 'lucide-react';
import { useGetProduct } from '@workspace/api-client-react';
import { format } from 'date-fns';

export default function ProductDetail() {
  const { t } = useTranslation();
  const params = useParams();
  const slug = params.slug || '';

  const { data: product, isLoading } = useGetProduct(slug);

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] w-full flex items-center justify-center" data-testid="text-loading">
        {t('common.loading')}
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-[100dvh] w-full flex items-center justify-center" data-testid="text-not-found">
        {t('common.error')}
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] w-full py-24">
      <div className="container mx-auto px-4">
        {/* Hero */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-12">
          <div>
            <div className="aspect-video bg-muted rounded-lg overflow-hidden border border-border">
              {product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="w-full h-full object-cover"
                  data-testid="img-product"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Download className="w-16 h-16 text-muted-foreground" />
                </div>
              )}
            </div>
          </div>
          <div className="space-y-6">
            <div>
              <div className="text-sm text-muted-foreground mb-2">{product.category}</div>
              <h1 className="text-4xl md:text-5xl font-bold mb-4" data-testid="text-product-name">
                {product.name}
              </h1>
              <p className="text-lg text-muted-foreground" data-testid="text-product-description">
                {product.shortDescription || product.description}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {product.trialDays && (
                <Link href="/trial" data-testid="link-request-trial">
                  <Button size="lg">
                    {t('product_detail.request_trial')}
                  </Button>
                </Link>
              )}
              <Link href="/demo" data-testid="link-request-demo">
                <Button size="lg" variant="outline">
                  {t('product_detail.request_demo')}
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-3" data-testid="tabs-product">
            <TabsTrigger value="overview">{t('product_detail.overview')}</TabsTrigger>
            <TabsTrigger value="versions">{t('product_detail.versions')}</TabsTrigger>
            <TabsTrigger value="downloads">{t('product_detail.downloads')}</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-8" data-testid="tab-overview">
            <Card>
              <CardContent className="p-6 prose dark:prose-invert max-w-none">
                <div dangerouslySetInnerHTML={{ __html: product.description }} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="versions" className="mt-8" data-testid="tab-versions">
            {product.versions && product.versions.length > 0 ? (
              <div className="space-y-4">
                {product.versions.map((version) => (
                  <Card key={version.id} data-testid={`card-version-${version.id}`}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-lg font-semibold mb-1">
                            {version.version}
                            {version.isLatest && (
                              <span className="ml-2 text-xs bg-primary text-primary-foreground px-2 py-1 rounded">
                                {t('product_detail.latest_version')}
                              </span>
                            )}
                          </h3>
                          <div className="text-sm text-muted-foreground flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            {format(new Date(version.releasedAt), 'PPP')}
                          </div>
                        </div>
                      </div>
                      {version.releaseNotes && (
                        <div className="prose dark:prose-invert max-w-none text-sm">
                          <div dangerouslySetInnerHTML={{ __html: version.releaseNotes }} />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground" data-testid="text-no-versions">
                {t('product_detail.no_versions')}
              </div>
            )}
          </TabsContent>

          <TabsContent value="downloads" className="mt-8" data-testid="tab-downloads">
            {product.downloads && product.downloads.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {product.downloads.map((file) => (
                  <Card key={file.id} data-testid={`card-download-${file.id}`}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="font-semibold mb-2">{file.fileName}</h3>
                          <div className="space-y-1 text-sm text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <Monitor className="w-4 h-4" />
                              <span className="capitalize">{file.platform}</span>
                            </div>
                            {file.version && (
                              <div>v{file.version}</div>
                            )}
                            <div className="flex items-center gap-2">
                              <HardDrive className="w-4 h-4" />
                              {(file.fileSize / 1024 / 1024).toFixed(2)} MB
                            </div>
                            {file.downloadCount !== undefined && (
                              <div>{file.downloadCount} {t('product_detail.download_count')}</div>
                            )}
                          </div>
                        </div>
                      </div>
                      <a href={file.downloadUrl} target="_blank" rel="noopener noreferrer">
                        <Button className="w-full gap-2" data-testid={`button-download-${file.id}`}>
                          <Download className="w-4 h-4" />
                          {t('product_detail.download')}
                        </Button>
                      </a>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground" data-testid="text-no-downloads">
                {t('product_detail.no_downloads')}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
