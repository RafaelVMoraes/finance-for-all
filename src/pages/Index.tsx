import { useI18n } from '@/i18n/I18nProvider';

const Index = () => {
  const { t } = useI18n();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">{t('common.appName')}</h1>
        <p className="text-xl text-muted-foreground">{t('auth.subtitle')}</p>
      </div>
    </div>
  );
};

export default Index;
