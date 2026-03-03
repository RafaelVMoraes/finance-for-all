import { useI18n } from '@/i18n/I18nProvider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();

  return (
    <div className="px-3 py-2">
      <p className="mb-1 text-xs text-muted-foreground">{t('language.label')}</p>
      <Select value={locale} onValueChange={(value) => setLocale(value as 'en' | 'fr' | 'pt')}>
        <SelectTrigger className="h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="en">{t('language.en')}</SelectItem>
          <SelectItem value="fr">{t('language.fr')}</SelectItem>
          <SelectItem value="pt">{t('language.pt')}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
