import { Link } from 'react-router-dom';
import { ArrowRight, ChartNoAxesCombined, PiggyBank, Upload } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Import from './Import';
import { useI18n } from '@/i18n/I18nProvider';

export default function Input() {
  const { t } = useI18n();

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-primary/40 shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Upload className="h-4 w-4 text-primary" />
              {t('input.import.title')}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <Button asChild size="sm" className="w-full text-xs">
              <a href="#input-import-section">{t('input.import.cta')}</a>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-primary/40 shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <ChartNoAxesCombined className="h-4 w-4 text-primary" />
              {t('input.investments.title')}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <Button variant="outline" asChild size="sm" className="w-full text-xs">
              <Link to="/input/investments">
                {t('input.investments.action')}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-2">
        <Link to="/input/budget" className="flex-1">
          <Badge variant="outline" className="w-full justify-center gap-1.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
            <PiggyBank className="h-3.5 w-3.5" />
            {t('input.budget.title')}
          </Badge>
        </Link>
        <Link to="/input/transactions" className="flex-1">
          <Badge variant="outline" className="w-full justify-center gap-1.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
            <ArrowRight className="h-3.5 w-3.5" />
            {t('input.links.transactions')}
          </Badge>
        </Link>
      </div>

      <section id="input-import-section">
        <Import />
      </section>
    </div>
  );
}
