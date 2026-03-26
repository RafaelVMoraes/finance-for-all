import { formatDistanceToNow } from 'date-fns';
import {
  Activity,
  AlertTriangle,
  AlertCircle,
  CalendarSearch,
  Copy,
  Lightbulb,
  RefreshCw,
  Target,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ElementType } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useUserSettings } from '@/hooks/useUserSettings';
import { useGeminiAnalysis } from '@/hooks/useGeminiAnalysis';
import { useI18n } from '@/i18n/I18nProvider';
import { GeminiError } from '@/lib/gemini';
import { CategoryStabilityResult } from '@/lib/analytics';
import { getFinancialPeriod, getFinancialPeriodLabel, normalizeFiscalYearStartMonth } from '@/lib/financialPeriod';
import type { AnalysisResult } from '@/types/analysis';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const formatMoney = (value: number, currency: string) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);

const formatPercent = (value: number) => `${Math.round(value)}%`;

const getStatusBadgeClass = (status: 'green' | 'red' | 'blue' | 'yellow' | 'gray') => {
  if (status === 'green') return 'bg-green-100 text-green-800 border-green-200';
  if (status === 'red') return 'bg-red-100 text-red-800 border-red-200';
  if (status === 'blue') return 'bg-blue-100 text-blue-800 border-blue-200';
  if (status === 'yellow') return 'bg-yellow-100 text-yellow-800 border-yellow-200';
  return 'bg-muted text-muted-foreground border-muted';
};

const InsightUnavailableCard = ({ title, icon: Icon, message }: { title: string; icon: ElementType; message: string }) => (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2 text-base">
        <Icon className="h-4 w-4 text-muted-foreground" />
        {title}
      </CardTitle>
    </CardHeader>
    <CardContent className="flex min-h-52 items-center justify-center">
      <div className="text-center text-sm text-muted-foreground">
        <RefreshCw className="mx-auto mb-2 h-5 w-5" />
        {message}
      </div>
    </CardContent>
  </Card>
);

const CardRow = ({ label, value, emphasize = false }: { label: string; value: string; emphasize?: boolean }) => (
  <div className="flex items-center justify-between text-sm">
    <span className="text-muted-foreground">{label}</span>
    <span className={emphasize ? 'font-semibold' : ''}>{value}</span>
  </div>
);

const parseNarrative = (narrative: string): Array<{ type: 'paragraph' | 'orderedList'; items: string[] }> => {
  const lines = narrative.split('\n').map((line) => line.trim());
  const blocks: Array<{ type: 'paragraph' | 'orderedList'; items: string[] }> = [];
  let paragraphBuffer: string[] = [];
  let orderedListBuffer: string[] = [];

  const flushParagraph = () => {
    if (paragraphBuffer.length > 0) {
      blocks.push({ type: 'paragraph', items: [paragraphBuffer.join(' ')] });
      paragraphBuffer = [];
    }
  };

  const flushOrderedList = () => {
    if (orderedListBuffer.length > 0) {
      blocks.push({ type: 'orderedList', items: orderedListBuffer });
      orderedListBuffer = [];
    }
  };

  lines.forEach((line) => {
    if (!line) {
      flushParagraph();
      flushOrderedList();
      return;
    }

    const orderedListMatch = line.match(/^\d+\.\s+(.*)$/);
    if (orderedListMatch) {
      flushParagraph();
      orderedListBuffer.push(orderedListMatch[1]);
      return;
    }

    flushOrderedList();
    paragraphBuffer.push(line);
  });

  flushParagraph();
  flushOrderedList();

  return blocks;
};

const renderBoldText = (text: string) => {
  return text.split(/(\*\*.*?\*\*)/g).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>;
    }
    return <span key={`${part}-${index}`}>{part}</span>;
  });
};

const formatGeneratedAgo = (date: Date | null): string | null => {
  if (!date) return null;
  return formatDistanceToNow(date, { addSuffix: true });
};

const getErrorMessageKey = (errorCode: GeminiError['code']) => {
  if (errorCode === 'API_KEY_MISSING') return 'analyze.deep.error.no_key';
  if (errorCode === 'NETWORK_ERROR') return 'analyze.deep.error.network';
  if (errorCode === 'RATE_LIMITED') return 'analyze.deep.error.rate_limit';
  if (errorCode === 'EMPTY_RESPONSE') return 'analyze.deep.error.empty';
  return 'analyze.deep.error.unknown';
};

interface AnalysisPanelProps {
  icon: ElementType;
  titleKey: string;
  descriptionKey: string;
  ctaKey: string;
  disabledReason: string | null;
  apiKeyMissing: boolean;
  result: AnalysisResult | null;
  isLoading: boolean;
  error: GeminiError | null;
  lastGeneratedAt: Date | null;
  onTrigger: () => Promise<void>;
  onRegenerate: () => Promise<void>;
  onRetry: () => Promise<void>;
}

const AnalysisPanel = ({
  icon: Icon,
  titleKey,
  descriptionKey,
  ctaKey,
  disabledReason,
  apiKeyMissing,
  result,
  isLoading,
  error,
  lastGeneratedAt,
  onTrigger,
  onRegenerate,
  onRetry,
}: AnalysisPanelProps) => {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  const periodGeneratedLabel = result
    ? t('analyze.deep.period_generated', {
        period: result.period_label,
        time: formatGeneratedAgo(lastGeneratedAt) || t('analyze.last_updated_never'),
      })
    : '';

  const isDisabled = Boolean(disabledReason || apiKeyMissing);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="space-y-3 p-4">
          <Skeleton className="h-28 w-full animate-pulse" />
          <p className="text-center text-sm text-muted-foreground">{t('analyze.deep.loading')}</p>
          <p className="text-center text-xs text-muted-foreground">{t('analyze.deep.loading_note')}</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50/50">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-start gap-2 text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">{t('analyze.deep.error.title')}</p>
              <p className="text-sm">{t(getErrorMessageKey(error.code))}</p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              void onRetry();
            }}
          >
            {t('analyze.deep.error.try_again')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!result) {
    const idleContent = (
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Icon className="mt-0.5 h-5 w-5 text-primary" />
          <div>
            <p className="font-medium">{t(titleKey)}</p>
            <p className="text-sm text-muted-foreground">{t(descriptionKey)}</p>
          </div>
        </div>
        <Button
          onClick={() => {
            void onTrigger();
          }}
          disabled={isDisabled}
          className="w-full sm:w-auto"
        >
          {t(ctaKey)}
        </Button>
      </CardContent>
    );

    if (disabledReason) {
      return (
        <Card>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div>{idleContent}</div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{disabledReason}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </Card>
      );
    }

    return <Card>{idleContent}</Card>;
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="font-medium">{t(titleKey)}</p>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                void onRegenerate();
              }}
              aria-label={t('analyze.deep.regenerate')}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <TooltipProvider>
              <Tooltip open={copied}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={async () => {
                      await navigator.clipboard.writeText(result.narrative);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    aria-label={t('analyze.deep.copy')}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t('analyze.deep.copied')}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">{periodGeneratedLabel}</p>
        <div className="h-px w-full bg-border" />

        <div className="space-y-3 text-sm leading-relaxed">
          {parseNarrative(result.narrative).map((block, blockIndex) =>
            block.type === 'orderedList' ? (
              <ol key={`ol-${blockIndex}`} className="list-inside list-decimal space-y-1">
                {block.items.map((item, itemIndex) => (
                  <li key={`item-${itemIndex}`}>{renderBoldText(item)}</li>
                ))}
              </ol>
            ) : (
              <p key={`p-${blockIndex}`}>{renderBoldText(block.items[0])}</p>
            ),
          )}
        </div>

        <p className="text-xs text-muted-foreground">{t('analyze.deep.result_disclaimer')}</p>
      </CardContent>
    </Card>
  );
};

export default function Analyze() {
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();
  const { settings, mainCurrency } = useUserSettings();

  const fiscalYearStartMonth = normalizeFiscalYearStartMonth(
    Number(localStorage.getItem('fintrack_year_start_month') ?? 0) + 1,
  );

  const currentPeriod = useMemo(
    () => getFinancialPeriod(new Date(), 1, fiscalYearStartMonth),
    [fiscalYearStartMonth],
  );

  const { momentum, stability, forecast, optimization, isLoading, error, lastUpdated, guardData } = useAnalytics(currentPeriod, {
    ...settings,
    mainCurrency,
    fiscalYearStartMonth,
  });
  const [apiBannerDismissed, setApiBannerDismissed] = useState(
    sessionStorage.getItem('analyze.deep.apiBannerDismissed') === 'true',
  );
  const apiKeyMissing = !import.meta.env.GEMINI_API_KEY;

  const analysisUserSettings = useMemo(
    () =>
      ({
        ...(settings || {}),
        main_currency: mainCurrency,
        user_language: locale,
      }),
    [locale, mainCurrency, settings],
  );

  const monthlyAnalysis = useGeminiAnalysis('monthly_review', currentPeriod, analysisUserSettings);
  const investmentAnalysis = useGeminiAnalysis('investment_review', currentPeriod, analysisUserSettings);
  const budgetAnalysis = useGeminiAnalysis('budget_optimization', currentPeriod, analysisUserSettings);

  const periodLabel = getFinancialPeriodLabel(
    currentPeriod.year,
    currentPeriod.month,
    1,
    fiscalYearStartMonth,
    locale,
  );

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['analytics'] });
  };

  const topVolatileCategories: CategoryStabilityResult[] = stability?.by_category.slice(0, 3) || [];
  const topOptimizationRows = optimization?.results.slice(0, 4) || [];
  const topOpportunity = optimization?.results[0] || null;
  const monthlyGuard = guardData.transactionDaysInPeriod < 7 ? t('analyze.deep.guard.monthly') : null;
  const investmentGuard =
    guardData.investmentHistoryMonths < 1 ? t('analyze.deep.guard.investment') : null;
  const budgetGuard = guardData.transactionHistoryMonths < 2 ? t('analyze.deep.guard.budget') : null;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">{t('analyze.title')}</h1>
            <p className="text-xs text-muted-foreground">
              {lastUpdated
                ? t('analyze.last_updated', {
                    time: formatDistanceToNow(lastUpdated, { addSuffix: true }),
                  })
                : t('analyze.last_updated_never')}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline">{periodLabel}</Badge>
            <Button size="icon" variant="ghost" onClick={refresh} aria-label={t('analyze.refresh')}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </header>

      {error && (
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="flex items-start gap-2 p-4 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </CardContent>
        </Card>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-medium">{t('analyze.automatic_insights.title')}</h2>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }, (_, index) => (
              <Card key={index}>
                <CardHeader>
                  <Skeleton className="h-4 w-2/3" />
                </CardHeader>
                <CardContent className="space-y-3">
                  <Skeleton className="h-8 w-1/2" />
                  <Skeleton className="h-6 w-1/3" />
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {momentum ? (
              <Card>
                <CardHeader className="space-y-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    {momentum.status === 'decelerating' ? (
                      <TrendingDown className="h-4 w-4 text-blue-600" />
                    ) : (
                      <TrendingUp className={`h-4 w-4 ${momentum.status === 'accelerating' ? 'text-red-600' : 'text-green-600'}`} />
                    )}
                    {t('analyze.momentum.title')}
                  </CardTitle>
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-2xl font-bold">{formatMoney(momentum.ma_7day, mainCurrency)}</div>
                    <Badge
                      className={getStatusBadgeClass(
                        momentum.status === 'accelerating'
                          ? 'red'
                          : momentum.status === 'decelerating'
                            ? 'blue'
                            : 'green',
                      )}
                    >
                      {t(`analyze.momentum.${momentum.status}`)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <CardRow label={t('analyze.momentum.rows.ma7')} value={formatMoney(momentum.ma_7day, mainCurrency)} />
                  <CardRow label={t('analyze.momentum.rows.ma30')} value={formatMoney(momentum.ma_30day, mainCurrency)} />
                  <CardRow label={t('analyze.momentum.rows.ratio')} value={momentum.ratio.toFixed(2)} />

                  <p className="pt-2 text-sm italic text-muted-foreground">
                    {momentum.status === 'accelerating'
                      ? t('analyze.momentum.insights.accelerating', {
                          acceleration_pct: Math.abs(momentum.acceleration_pct).toFixed(1),
                        })
                      : momentum.status === 'decelerating'
                        ? t('analyze.momentum.insights.decelerating', {
                            acceleration_pct: Math.abs(momentum.acceleration_pct).toFixed(1),
                          })
                        : t('analyze.momentum.insights.normal')}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <InsightUnavailableCard
                title={t('analyze.momentum.title')}
                icon={TrendingUp}
                message={t('analyze.could_not_calculate')}
              />
            )}

            {stability ? (
              <Card>
                <CardHeader className="space-y-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Activity className="h-4 w-4 text-primary" />
                    {t('analyze.stability.title')}
                  </CardTitle>
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-2xl font-bold">{formatPercent(stability.overall_cv * 100)}</div>
                    <Badge
                      className={getStatusBadgeClass(
                        stability.overall_stability === 'stable'
                          ? 'green'
                          : stability.overall_stability === 'moderate'
                            ? 'yellow'
                            : 'red',
                      )}
                    >
                      {t(`analyze.stability.status.${stability.overall_stability}`)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    {topVolatileCategories.map((category) => (
                      <div key={category.category} className="flex items-center justify-between gap-2 text-sm">
                        <span>{category.category}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">{formatPercent(category.cv * 100)}</span>
                          <Badge className={`${getStatusBadgeClass(category.stability === 'stable' ? 'green' : category.stability === 'moderate' ? 'yellow' : 'red')} px-2 py-0 text-[10px]`}>
                            {t(`analyze.stability.status.${category.stability}`)}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>

                  <p className="pt-2 text-sm italic text-muted-foreground">
                    {stability.most_volatile_category
                      ? t('analyze.stability.insights.most_volatile', {
                          category: stability.most_volatile_category,
                        })
                      : t('analyze.stability.insights.all_stable')}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <InsightUnavailableCard
                title={t('analyze.stability.title')}
                icon={Activity}
                message={t('analyze.could_not_calculate')}
              />
            )}

            {forecast ? (
              <Card>
                <CardHeader className="space-y-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Target className="h-4 w-4 text-primary" />
                    {t('analyze.forecast.title')}
                  </CardTitle>
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-2xl font-bold">{formatMoney(forecast.projected_total, mainCurrency)}</div>
                    <div className="flex items-center gap-1">
                      <Badge className={getStatusBadgeClass(forecast.will_exceed_budget === null ? 'gray' : forecast.will_exceed_budget ? 'red' : 'green')}>
                        {forecast.will_exceed_budget === null
                          ? t('analyze.forecast.status.no_budget')
                          : forecast.will_exceed_budget
                            ? t('analyze.forecast.status.over_budget')
                            : t('analyze.forecast.status.within_budget')}
                      </Badge>
                      {forecast.low_confidence && (
                        <Badge className={getStatusBadgeClass('yellow')}>{t('analyze.forecast.status.early_estimate')}</Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <CardRow label={t('analyze.forecast.rows.spent_so_far')} value={formatMoney(forecast.current_expenses, mainCurrency)} />
                  <CardRow label={t('analyze.forecast.rows.fixed_expenses')} value={formatMoney(forecast.fixed_expenses_total, mainCurrency)} />
                  <CardRow label={t('analyze.forecast.rows.projected_total')} value={formatMoney(forecast.projected_total, mainCurrency)} emphasize />

                  {forecast.budget_total !== null && (
                    <>
                      <CardRow label={t('analyze.forecast.rows.budget')} value={formatMoney(forecast.budget_total, mainCurrency)} />
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{t('analyze.forecast.rows.projected_difference')}</span>
                        <span className={forecast.projected_vs_budget && forecast.projected_vs_budget > 0 ? 'text-red-600' : 'text-green-600'}>
                          {`${forecast.projected_vs_budget && forecast.projected_vs_budget > 0 ? '+' : '−'}${formatMoney(Math.abs(forecast.projected_vs_budget || 0), mainCurrency)}`}
                        </span>
                      </div>
                    </>
                  )}

                  <Progress
                    value={Math.min(
                      100,
                      (forecast.current_expenses / (forecast.budget_total || forecast.projected_total || 1)) * 100,
                    )}
                    className={`h-2 ${forecast.will_exceed_budget === null ? '[&>div]:bg-muted-foreground' : forecast.will_exceed_budget ? '[&>div]:bg-red-500' : '[&>div]:bg-green-500'}`}
                  />

                  <p className="pt-2 text-sm italic text-muted-foreground">
                    {`${
                      forecast.will_exceed_budget === true
                        ? t('analyze.forecast.insights.over_budget', {
                            excess_amount: formatMoney(forecast.excess_amount || 0, mainCurrency),
                          })
                        : forecast.will_exceed_budget === false
                          ? t('analyze.forecast.insights.within_budget', {
                              projected_vs_budget: formatMoney(Math.abs(forecast.projected_vs_budget || 0), mainCurrency),
                            })
                          : t('analyze.forecast.insights.no_budget', {
                              current_expenses: formatMoney(forecast.current_expenses, mainCurrency),
                            })
                    }${
                      forecast.low_confidence
                        ? t('analyze.forecast.insights.low_confidence_append', {
                            days_passed: forecast.days_passed,
                          })
                        : ''
                    }`}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <InsightUnavailableCard
                title={t('analyze.forecast.title')}
                icon={Target}
                message={t('analyze.could_not_calculate')}
              />
            )}

            {optimization ? (
              <Card>
                <CardHeader className="space-y-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Lightbulb className="h-4 w-4 text-yellow-500" />
                    {t('analyze.optimization.title')}
                  </CardTitle>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-2xl font-bold">{formatMoney(optimization.total_potential_saving, mainCurrency)}</div>
                      <div className="text-xs text-muted-foreground">{t('analyze.optimization.potential_monthly_saving')}</div>
                    </div>
                    <Badge
                      className={getStatusBadgeClass(
                        optimization.results.some((item) => item.recommendation === 'set_budget')
                          ? 'blue'
                          : optimization.total_potential_saving > 0
                            ? 'yellow'
                            : 'green',
                      )}
                    >
                      {optimization.results.some((item) => item.recommendation === 'set_budget')
                        ? t('analyze.optimization.status.budgets_missing')
                        : optimization.total_potential_saving > 0
                          ? t('analyze.optimization.status.opportunities_found')
                          : t('analyze.optimization.status.well_optimized')}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    {topOptimizationRows.map((item) => (
                      <div key={item.category} className="space-y-1 rounded-md border p-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium">{item.category}</span>
                          <Badge className={`${getStatusBadgeClass(item.recommendation === 'set_budget' ? 'blue' : item.recommendation === 'increase_budget' ? 'red' : item.recommendation === 'reduce_budget' ? 'gray' : 'green')} px-2 py-0 text-[10px]`}>
                            {t(`analyze.optimization.recommendation.${item.recommendation}`)}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatMoney(item.avg_actual, mainCurrency)} · {t('analyze.optimization.avg_over_months', { months: optimization.months_of_history })}
                        </p>
                      </div>
                    ))}
                  </div>

                  <p className="pt-2 text-sm italic text-muted-foreground">
                    {optimization.top_opportunity
                      ? t('analyze.optimization.insights.top_opportunity', {
                          top_opportunity: optimization.top_opportunity,
                          potential_saving: formatMoney(topOpportunity?.potential_saving || 0, mainCurrency),
                        })
                      : optimization.results.some((item) => item.recommendation === 'set_budget')
                        ? t('analyze.optimization.insights.only_missing_budgets', {
                            count: optimization.results.filter((item) => item.recommendation === 'set_budget').length,
                          })
                        : t('analyze.optimization.insights.all_on_track')}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <InsightUnavailableCard
                title={t('analyze.optimization.title')}
                icon={Lightbulb}
                message={t('analyze.could_not_calculate')}
              />
            )}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-lg font-medium">{t('analyze.deep.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('analyze.deep.subtitle')}</p>
          <p className="text-xs text-muted-foreground">{t('analyze.deep.disclaimer')}</p>
        </div>

        {apiKeyMissing && !apiBannerDismissed && (
          <Card className="border-amber-200 bg-amber-50/70">
            <CardContent className="flex items-start justify-between gap-3 p-4">
              <div className="flex items-start gap-2 text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p className="text-sm">{t('analyze.deep.no_api_key')}</p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-amber-900"
                onClick={() => {
                  sessionStorage.setItem('analyze.deep.apiBannerDismissed', 'true');
                  setApiBannerDismissed(true);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="space-y-3">
          <AnalysisPanel
            icon={CalendarSearch}
            titleKey="analyze.deep.monthly.title"
            descriptionKey="analyze.deep.monthly.desc"
            ctaKey="analyze.deep.monthly.cta"
            disabledReason={monthlyGuard}
            apiKeyMissing={apiKeyMissing}
            result={monthlyAnalysis.result}
            isLoading={monthlyAnalysis.isLoading}
            error={monthlyAnalysis.error}
            lastGeneratedAt={monthlyAnalysis.lastGeneratedAt}
            onTrigger={monthlyAnalysis.trigger}
            onRegenerate={async () => {
              monthlyAnalysis.reset();
              await monthlyAnalysis.trigger();
            }}
            onRetry={async () => {
              monthlyAnalysis.reset();
              await monthlyAnalysis.trigger();
            }}
          />

          <AnalysisPanel
            icon={TrendingUp}
            titleKey="analyze.deep.investment.title"
            descriptionKey="analyze.deep.investment.desc"
            ctaKey="analyze.deep.investment.cta"
            disabledReason={investmentGuard}
            apiKeyMissing={apiKeyMissing}
            result={investmentAnalysis.result}
            isLoading={investmentAnalysis.isLoading}
            error={investmentAnalysis.error}
            lastGeneratedAt={investmentAnalysis.lastGeneratedAt}
            onTrigger={investmentAnalysis.trigger}
            onRegenerate={async () => {
              investmentAnalysis.reset();
              await investmentAnalysis.trigger();
            }}
            onRetry={async () => {
              investmentAnalysis.reset();
              await investmentAnalysis.trigger();
            }}
          />

          <AnalysisPanel
            icon={Lightbulb}
            titleKey="analyze.deep.budget.title"
            descriptionKey="analyze.deep.budget.desc"
            ctaKey="analyze.deep.budget.cta"
            disabledReason={budgetGuard}
            apiKeyMissing={apiKeyMissing}
            result={budgetAnalysis.result}
            isLoading={budgetAnalysis.isLoading}
            error={budgetAnalysis.error}
            lastGeneratedAt={budgetAnalysis.lastGeneratedAt}
            onTrigger={budgetAnalysis.trigger}
            onRegenerate={async () => {
              budgetAnalysis.reset();
              await budgetAnalysis.trigger();
            }}
            onRetry={async () => {
              budgetAnalysis.reset();
              await budgetAnalysis.trigger();
            }}
          />
        </div>
      </section>
    </div>
  );
}
