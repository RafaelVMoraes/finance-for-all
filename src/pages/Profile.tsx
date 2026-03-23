import { useState } from 'react';
import { useI18n } from '@/i18n/I18nProvider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { DeleteAccountDialog } from '@/components/DeleteAccountDialog';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useUserSettings, Currency } from '@/hooks/useUserSettings';
import { useAuthContext } from '@/contexts/AuthContext';
import { useTutorial } from '@/contexts/TutorialContext';
import { tutorialSectionLabels } from '@/config/tutorialSteps';
import { TutorialSection } from '@/types/tutorial';

const YEAR_START_MONTH_KEY = 'fintrack_year_start_month';
const YEAR_START_DAY_KEY = 'fintrack_year_start_day';

const tutorialSections: TutorialSection[] = ['dashboard', 'transactions', 'budget', 'investment', 'import'];

export default function Profile() {
  const { t } = useI18n();
  const { mainCurrency, updateMainCurrency } = useUserSettings();
  const { user, logout } = useAuthContext();
  const { startSectionTutorial } = useTutorial();
  const [yearStartMonth, setYearStartMonth] = useState(() => Number(localStorage.getItem(YEAR_START_MONTH_KEY) ?? 0));
  const [yearStartDay, setYearStartDay] = useState(() => Number(localStorage.getItem(YEAR_START_DAY_KEY) ?? 1));

  const onMonthChange = (value: string) => {
    const parsed = Number(value);
    setYearStartMonth(parsed);
    localStorage.setItem(YEAR_START_MONTH_KEY, String(parsed));
  };

  const onDayChange = (value: string) => {
    const parsed = Number(value);
    setYearStartDay(parsed);
    localStorage.setItem(YEAR_START_DAY_KEY, String(parsed));
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{t('profile.defaultCurrency.title')}</CardTitle>
          <CardDescription>{t('profile.defaultCurrency.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={mainCurrency} onValueChange={(v) => updateMainCurrency(v as Currency)}>
            <SelectTrigger className="w-full sm:w-[180px]">
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
        <CardHeader>
          <CardTitle>{t('profile.yearStart.title')}</CardTitle>
          <CardDescription>{t('profile.yearStart.description')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{t('profile.yearStart.monthLabel')}</Label>
            <Select value={String(yearStartMonth)} onValueChange={onMonthChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }, (_, index) => (
                  <SelectItem key={index} value={String(index)}>{t(`months.${index}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('profile.yearStart.dayLabel')}</Label>
            <Select value={String(yearStartDay)} onValueChange={onDayChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 31 }, (_, index) => {
                  const day = index + 1;
                  return <SelectItem key={day} value={String(day)}>{day}</SelectItem>;
                })}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('profile.help.title')}</CardTitle>
          <CardDescription>{t('profile.help.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {tutorialSections.map((section) => (
            <Button key={section} variant="outline" className="w-full justify-start" onClick={() => startSectionTutorial(section)}>
              {t(tutorialSectionLabels[section])}
            </Button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('profile.account.title')}</CardTitle>
          <CardDescription>{t('profile.account.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{user?.email}</p>
          <div className="space-y-2">
            <LanguageSwitcher />
            <Button variant="outline" onClick={logout} className="w-full sm:w-auto">
              {t('nav.logout')}
            </Button>
            <DeleteAccountDialog />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
