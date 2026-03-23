import { BrainCircuit } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useI18n } from '@/i18n/I18nProvider';

export default function Analyze() {
  const { t } = useI18n();

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-md border-dashed">
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <div className="rounded-full bg-primary/10 p-3 text-primary">
            <BrainCircuit className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-semibold">{t('analyze.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('analyze.description')}</p>
        </CardContent>
      </Card>
    </div>
  );
}
