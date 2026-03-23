import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BarChart2, BrainCircuit, PlusCircle, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n/I18nProvider';

interface MainLayoutProps {
  children: ReactNode;
}

const navItems = [
  { key: 'view', path: '/view', icon: BarChart2, labelKey: 'nav.view' },
  { key: 'input', path: '/input', icon: PlusCircle, labelKey: 'nav.input' },
  { key: 'analyze', path: '/analyze', icon: BrainCircuit, labelKey: 'nav.analyze' },
  { key: 'profile', path: '/profile', icon: Settings2, labelKey: 'nav.profile' },
] as const;

export function MainLayout({ children }: MainLayoutProps) {
  const location = useLocation();
  const { t } = useI18n();

  const isActive = (path: string) => {
    if (path === '/input') {
      return location.pathname === '/input' || location.pathname.startsWith('/input/');
    }
    return location.pathname === path;
  };

  return (
    <div className="min-h-screen w-full bg-background">
      <main className="mx-auto w-full max-w-6xl px-3 pb-28 pt-4 sm:px-6 sm:pb-32">{children}</main>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="mx-auto grid h-12 max-w-3xl grid-cols-4 px-2 sm:h-14 sm:px-3">
          {navItems.map((item) => {
            const active = isActive(item.path);
            const Icon = item.icon;

            return (
              <Link
                key={item.path}
                to={item.path}
                className="flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-2 text-center"
              >
                <span
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-full transition-colors',
                    active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground',
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span
                  className={cn(
                    'truncate text-[0.6rem] font-medium leading-tight sm:text-[0.65rem]',
                    active ? 'text-primary' : 'text-muted-foreground',
                  )}
                >
                  {t(item.labelKey)}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
