import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Receipt,
  Target,
  TrendingUp,
  Upload,
  LogOut,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthContext } from '@/contexts/AuthContext';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { DeleteAccountDialog } from '@/components/DeleteAccountDialog';
import { useTutorial } from '@/contexts/TutorialContext';
import { tutorialSectionLabels } from '@/config/tutorialSteps';
import { TutorialSection } from '@/types/tutorial';
import { useI18n } from '@/i18n/I18nProvider';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

const navItems = [
  { path: '/dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard },
  { path: '/transactions', labelKey: 'nav.transactions', icon: Receipt },
  { path: '/budget', labelKey: 'nav.budget', icon: Target },
  { path: '/investments', labelKey: 'nav.investments', icon: TrendingUp },
  { path: '/import', labelKey: 'nav.import', icon: Upload },
];

const tutorialSections: TutorialSection[] = ['dashboard', 'transactions', 'budget', 'investment', 'import'];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
  showCollapseToggle?: boolean;
}

export function Sidebar({ collapsed, onToggle, onNavigate, showCollapseToggle = true }: SidebarProps) {
  const location = useLocation();
  const { logout, user } = useAuthContext();
  const { startSectionTutorial, mandatoryOnboarding } = useTutorial();
  const { t } = useI18n();

  return (
    <aside
      className={cn(
        'flex h-full max-h-screen flex-col border-r border-border bg-card transition-all duration-300 overflow-hidden',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      <div className={cn(
        'flex h-16 items-center border-b border-border',
        collapsed ? 'justify-center px-2' : 'justify-between px-4'
      )}>
        {!collapsed && <h1 className="text-xl font-bold text-foreground">{t('common.appName')}</h1>}
        {showCollapseToggle && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className="h-8 w-8"
            disabled={mandatoryOnboarding}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          const linkContent = (
            <Link
              key={item.path}
              to={item.path}
              onClick={onNavigate}
              className={cn(
                'flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                collapsed ? 'justify-center' : 'gap-3',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && t(item.labelKey)}
            </Link>
          );

          if (collapsed) {
            return (
              <Tooltip key={item.path} delayDuration={0}>
                <TooltipTrigger asChild>
                  {linkContent}
                </TooltipTrigger>
                <TooltipContent side="right">
                  {t(item.labelKey)}
                </TooltipContent>
              </Tooltip>
            );
          }

          return linkContent;
        })}

        {!collapsed && (
          <div className="mt-4 rounded-lg border border-border p-2">
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
              <GraduationCap className="h-3.5 w-3.5" /> {t('nav.tutorials')}
            </p>
            <div className="space-y-1">
              {tutorialSections.map((section) => (
                <Button
                  key={section}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-xs"
                  onClick={() => startSectionTutorial(section)}
                >
                  {t(tutorialSectionLabels[section])}
                </Button>
              ))}
            </div>
          </div>
        )}
      </nav>

      {!collapsed && <LanguageSwitcher />}

      <div className="shrink-0 border-t border-border p-2">
        {!collapsed && (
          <div className="mb-2 truncate px-3 text-xs text-muted-foreground">
            {user?.email}
          </div>
        )}

        {!collapsed && (
          <div className="mb-2">
            <DeleteAccountDialog />
          </div>
        )}

        {collapsed ? (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="w-full"
                onClick={logout}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {t('nav.logout')}
            </TooltipContent>
          </Tooltip>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2"
            onClick={logout}
          >
            <LogOut className="h-4 w-4" />
            {t('nav.logout')}
          </Button>
        )}
      </div>
    </aside>
  );
}
