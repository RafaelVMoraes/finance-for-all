import { useEffect, useState } from 'react';
import { useI18n } from '@/i18n/I18nProvider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DeleteAccountDialog } from '@/components/DeleteAccountDialog';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useUserSettings, Currency } from '@/hooks/useUserSettings';
import { useAuthContext } from '@/contexts/AuthContext';
import { useTutorial } from '@/contexts/TutorialContext';
import { tutorialSectionLabels } from '@/config/tutorialSteps';
import { TutorialSection } from '@/types/tutorial';
import { Smartphone } from 'lucide-react';

const YEAR_START_MONTH_KEY = 'fintrack_year_start_month';
const YEAR_START_DAY_KEY = 'fintrack_year_start_day'; // legacy (unused) - kept only for migration cleanup

const tutorialSections: TutorialSection[] = ['dashboard', 'transactions', 'budget', 'investment', 'import'];

export default function Profile() {
  const { t } = useI18n();
  const { mainCurrency, updateMainCurrency } = useUserSettings();
  const { user, logout } = useAuthContext();
  const { startSectionTutorial } = useTutorial();
  const [yearStartMonth, setYearStartMonth] = useState(() => Number(localStorage.getItem(YEAR_START_MONTH_KEY) ?? 0));

  useEffect(() => {
    // Clean up legacy state so it can't ever desync user expectations.
    if (localStorage.getItem(YEAR_START_DAY_KEY) !== null) {
      localStorage.removeItem(YEAR_START_DAY_KEY);
      window.dispatchEvent(new Event('fintrack-settings-changed'));
    }
    if (localStorage.getItem('fintrack_cycle_start_day') !== null) {
      localStorage.removeItem('fintrack_cycle_start_day');
      window.dispatchEvent(new Event('fintrack-settings-changed'));
    }
  }, []);

  const onMonthChange = (value: string) => {
    const parsed = Number(value);
    setYearStartMonth(parsed);
    localStorage.setItem(YEAR_START_MONTH_KEY, String(parsed));
    window.dispatchEvent(new Event('fintrack-settings-changed'));
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardHeader className="p-3 pb-1.5">
            <CardTitle className="text-sm">{t('profile.defaultCurrency.title')}</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <Select value={mainCurrency} onValueChange={(v) => updateMainCurrency(v as Currency)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EUR">€ EUR</SelectItem>
                <SelectItem value="USD">$ USD</SelectItem>
                <SelectItem value="BRL">R$ BRL</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-3 pb-1.5">
            <CardTitle className="text-sm">{t('profile.account.title')}</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 space-y-1.5">
            <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
            <LanguageSwitcher />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="p-3 pb-1.5">
          <CardTitle className="text-sm">{t('profile.yearStart.title')}</CardTitle>
          <CardDescription className="text-xs">{t('profile.yearStart.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 p-3 pt-0">
          <div className="space-y-1">
            <Label className="text-xs">{t('profile.yearStart.monthLabel')}</Label>
            <Select value={String(yearStartMonth)} onValueChange={onMonthChange}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }, (_, index) => (
                  <SelectItem key={index} value={String(index)}>{t(`months.${index}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-3 pb-1.5">
          <CardTitle className="text-sm">{t('profile.help.title')}</CardTitle>
          <CardDescription className="text-xs">{t('profile.help.description')}</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2 p-3 pt-0">
          {tutorialSections.map((section) => (
            <Button key={section} variant="outline" size="sm" className="justify-start text-xs h-8" onClick={() => startSectionTutorial(section)}>
              {t(tutorialSectionLabels[section])}
            </Button>
          ))}
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="justify-start text-xs h-8 col-span-2">
                <Smartphone className="mr-1 h-3.5 w-3.5" />
                {t('nav.installOnIphone')}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle className="text-base">{t('installApp.title')}</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">{t('installApp.description')}</p>
              <ol className="list-decimal space-y-1.5 pl-5 text-sm">
                <li>{t('installApp.steps.safari')}</li>
                <li>{t('installApp.steps.share')}</li>
                <li>{t('installApp.steps.addToHome')}</li>
                <li>{t('installApp.steps.webApp')}</li>
              </ol>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={logout} className="flex-1 text-xs h-8">
          {t('nav.logout')}
        </Button>
        <DeleteAccountDialog />
      </div>
    </div>
  );
}
