import { Link } from 'react-router-dom';
import { ArrowRight, ChartNoAxesCombined, PiggyBank, Upload } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Import from './Import';
import { useI18n } from '@/i18n/I18nProvider';

export default function Input() {
  const { t } = useI18n();

  return (
    <div className="space-y-5">
      <Card className="border-primary/40 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Upload className="h-5 w-5 text-primary" />
            {t('input.import.title')}
          </CardTitle>
          <CardDescription>{t('input.import.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild size="lg" className="w-full sm:w-auto">
            <a href="#input-import-section">{t('input.import.cta')}</a>
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="transition-colors hover:border-primary/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ChartNoAxesCombined className="h-4 w-4" />
              {t('input.investments.title')}
            </CardTitle>
            <CardDescription>{t('input.investments.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" asChild className="w-full justify-between">
              <Link to="/input/investments">
                {t('input.investments.action')}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="transition-colors hover:border-primary/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <PiggyBank className="h-4 w-4" />
              {t('input.budget.title')}
            </CardTitle>
            <CardDescription>{t('input.budget.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" asChild className="w-full justify-between">
              <Link to="/input/budget">
                {t('input.budget.action')}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-1 rounded-md border border-border/70 p-3">
        <Link to="/input/transactions" className="flex items-center justify-between rounded-md px-1 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <span>{t('input.links.transactions')}</span>
          <ArrowRight className="h-4 w-4" />
        </Link>
        <Link to="/input/categories" className="flex items-center justify-between rounded-md px-1 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <span>{t('input.links.categories')}</span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <section id="input-import-section">
        <Import />
      </section>
    </div>
  );
}
