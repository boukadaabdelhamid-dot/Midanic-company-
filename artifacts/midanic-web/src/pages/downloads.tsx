import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Download, HardDrive, Monitor } from 'lucide-react';
import { useListDownloads } from '@workspace/api-client-react';

export default function Downloads() {
  const { t } = useTranslation();
  const { data: downloads, isLoading } = useListDownloads();

  return (
    <div className="min-h-[100dvh] w-full py-24">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4" data-testid="text-page-title">
            {t('downloads.page_title')}
          </h1>
          <p className="text-lg text-muted-foreground" data-testid="text-page-subtitle">
            {t('downloads.page_subtitle')}
          </p>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground" data-testid="text-loading">
            {t('common.loading')}
          </div>
        ) : downloads && downloads.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {downloads.map((file) => (
              <Card key={file.id} data-testid={`card-download-${file.id}`}>
                <CardContent className="p-6">
                  <h3 className="font-semibold mb-2 line-clamp-2">{file.fileName}</h3>
                  <div className="space-y-2 mb-4 text-sm text-muted-foreground">
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
                      <div>{file.downloadCount} {t('downloads.download')}</div>
                    )}
                  </div>
                  <a href={file.downloadUrl} target="_blank" rel="noopener noreferrer">
                    <Button className="w-full gap-2" data-testid={`button-download-${file.id}`}>
                      <Download className="w-4 h-4" />
                      {t('downloads.download')}
                    </Button>
                  </a>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground" data-testid="text-no-downloads">
            {t('downloads.no_downloads')}
          </div>
        )}
      </div>
    </div>
  );
}
