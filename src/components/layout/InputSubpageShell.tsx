import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n/I18nProvider';

interface InputSubpageShellProps {
  children: ReactNode;
}

export function InputSubpageShell({ children }: InputSubpageShellProps) {
  const { t } = useI18n();

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-20 -mx-3 border-b border-border bg-background/95 px-3 py-2 backdrop-blur sm:mx-0 sm:rounded-md sm:border sm:px-4">
        <Button variant="ghost" asChild className="gap-2 px-2">
          <Link to="/input">
            <ArrowLeft className="h-4 w-4" />
            {t('input.backToInput')}
          </Link>
        </Button>
      </div>
      {children}
    </div>
  );
}
