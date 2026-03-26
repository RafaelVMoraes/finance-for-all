import { format, subDays } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { useAuthContext } from '@/contexts/AuthContext';
import { Currency } from '@/hooks/useUserSettings';
import { supabase } from '@/integrations/supabase/client';
import {
  analytics,
  CategoryOptimizationReport,
  DailyExpense,
  ExpenseForecastResult,
  ExpenseStabilityResult,
  MonthlySnapshot,
  SpendingMomentumResult,
} from '@/lib/analytics';
import { getFinancialPeriodBounds, normalizeFiscalYearStartMonth } from '@/lib/financialPeriod';

interface AnalyticsUserSettings {
  mainCurrency?: Currency;
  main_currency?: Currency;
  fiscalYearStartMonth?: number;
  fiscal_year_start_month?: number;
}

export interface UseAnalyticsReturn {
  momentum: SpendingMomentumResult | null;
  stability: ExpenseStabilityResult | null;
  forecast: ExpenseForecastResult | null;
  optimization: CategoryOptimizationReport | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  guardData: {
    transactionDaysInPeriod: number;
    transactionHistoryMonths: number;
    investmentHistoryMonths: number;
  };
}

interface UseAnalyticsQueryResult {
  momentum: SpendingMomentumResult | null;
  stability: ExpenseStabilityResult | null;
  forecast: ExpenseForecastResult | null;
  optimization: CategoryOptimizationReport | null;
  error: string | null;
  lastUpdated: Date;
  guardData: {
    transactionDaysInPeriod: number;
    transactionHistoryMonths: number;
    investmentHistoryMonths: number;
  };
}

interface TxRow {
  payment_date: string;
  amount: number;
  categories: { name: string; type: 'fixed' | 'variable' | 'income' } | null;
}

interface MonthlyTotalRow {
  month: string;
  total_income: number;
  total_expenses: number;
}

interface MonthlyCategorySummaryRow {
  month: string;
  total_amount: number;
  categories: { name: string; type: 'fixed' | 'variable' | 'income' } | null;
}

interface BudgetRow {
  expected_amount: number;
  categories: { name: string; type: 'fixed' | 'variable' | 'income' } | null;
}

interface InvestmentSnapshotRow {
  month: string;
}

const DEFAULT_MAIN_CURRENCY: Currency = 'EUR';

const resolveMainCurrency = (userSettings: AnalyticsUserSettings): Currency => {
  return (userSettings.mainCurrency || userSettings.main_currency || DEFAULT_MAIN_CURRENCY) as Currency;
};

const resolveFiscalYearStartMonth = (userSettings: AnalyticsUserSettings): number => {
  const fromSettings = userSettings.fiscalYearStartMonth ?? userSettings.fiscal_year_start_month;
  const fromStorage = Number(localStorage.getItem('fintrack_year_start_month') ?? 0) + 1;
  return normalizeFiscalYearStartMonth(fromSettings ?? fromStorage);
};

const toDateKey = (date: Date): string => format(date, 'yyyy-MM-dd');

const convertAmountToMainCurrency = (amount: number, _month: string, _mainCurrency: Currency): number => {
  return amount;
};

export function useAnalytics(
  financialPeriod: { year: number; month: number },
  userSettings: AnalyticsUserSettings,
): UseAnalyticsReturn {
  const { user } = useAuthContext();
  const mainCurrency = resolveMainCurrency(userSettings);
  const fiscalYearStartMonth = resolveFiscalYearStartMonth(userSettings);

  const query = useQuery<UseAnalyticsQueryResult>({
    queryKey: [
      'analytics',
      user?.id,
      financialPeriod.year,
      financialPeriod.month,
      mainCurrency,
      fiscalYearStartMonth,
    ],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      if (!user?.id) {
        throw new Error('User must be authenticated');
      }

      const periodBounds = getFinancialPeriodBounds(
        financialPeriod.year,
        financialPeriod.month,
        1,
        fiscalYearStartMonth,
      );

      const lookbackStart = subDays(periodBounds.start, 30);
      const txStart = toDateKey(lookbackStart);
      const txEnd = toDateKey(periodBounds.end);

      const [txResult, monthlyTotalsResult, monthlyCategorySummaryResult, budgetResult, investmentSnapshotsResult] = await Promise.all([
        supabase
          .from('transactions')
          .select('payment_date,amount,categories(name,type)')
          .eq('user_id', user.id)
          .gte('payment_date', txStart)
          .lte('payment_date', txEnd)
          .order('payment_date', { ascending: true }),
        supabase
          .from('monthly_totals')
          .select('month,total_income,total_expenses')
          .eq('user_id', user.id)
          .order('month', { ascending: true }),
        supabase
          .from('monthly_category_summary')
          .select('month,total_amount,categories(name,type)')
          .eq('user_id', user.id)
          .order('month', { ascending: true }),
        supabase
          .from('budgets')
          .select('expected_amount,categories(name,type)')
          .eq('user_id', user.id),
        supabase
          .from('investment_snapshots')
          .select('month')
          .eq('user_id', user.id)
          .order('month', { ascending: true }),
      ]);

      if (txResult.error) throw txResult.error;
      if (monthlyTotalsResult.error) throw monthlyTotalsResult.error;
      if (monthlyCategorySummaryResult.error) throw monthlyCategorySummaryResult.error;
      if (budgetResult.error) throw budgetResult.error;
      if (investmentSnapshotsResult.error) throw investmentSnapshotsResult.error;

      const txRows = (txResult.data || []) as TxRow[];
      const monthlyTotalRows = (monthlyTotalsResult.data || []) as MonthlyTotalRow[];
      const monthlyCategoryRows = (monthlyCategorySummaryResult.data || []) as MonthlyCategorySummaryRow[];
      const budgetRows = (budgetResult.data || []) as BudgetRow[];
      const investmentSnapshotRows = (investmentSnapshotsResult.data || []) as InvestmentSnapshotRow[];

      const dailyExpenses: DailyExpense[] = txRows
        .filter((tx) => tx.categories?.type !== 'income')
        .map((tx) => ({
          date: tx.payment_date,
          amount: convertAmountToMainCurrency(Math.abs(Number(tx.amount || 0)), tx.payment_date, mainCurrency),
          category: tx.categories?.name || 'Uncategorized',
          is_fixed: tx.categories?.type === 'fixed',
        }));

      const monthlySnapshots: MonthlySnapshot[] = monthlyTotalRows.map((snapshot) => ({
        period_label: snapshot.month,
        year: new Date(`${snapshot.month}T00:00:00`).getFullYear(),
        month: new Date(`${snapshot.month}T00:00:00`).getMonth() + 1,
        total_income: convertAmountToMainCurrency(Number(snapshot.total_income || 0), snapshot.month, mainCurrency),
        total_expenses: convertAmountToMainCurrency(Math.abs(Number(snapshot.total_expenses || 0)), snapshot.month, mainCurrency),
        savings:
          convertAmountToMainCurrency(Number(snapshot.total_income || 0), snapshot.month, mainCurrency) -
          convertAmountToMainCurrency(Math.abs(Number(snapshot.total_expenses || 0)), snapshot.month, mainCurrency),
      }));

      const categorySnapshots = monthlyCategoryRows
        .filter((snapshot) => snapshot.categories?.type !== 'income')
        .map((snapshot) => {
          const monthDate = new Date(`${snapshot.month}T00:00:00`);
          return {
            name: snapshot.categories?.name || 'Uncategorized',
            month: monthDate.getMonth() + 1,
            year: monthDate.getFullYear(),
            actual: convertAmountToMainCurrency(
              Math.abs(Number(snapshot.total_amount || 0)),
              snapshot.month,
              mainCurrency,
            ),
            budget: null,
          };
        });

      const categoryBudgets = budgetRows
        .filter((budget) => budget.categories?.type !== 'income')
        .map((budget) => ({
          name: budget.categories?.name || 'Uncategorized',
          budget: convertAmountToMainCurrency(Number(budget.expected_amount || 0), txEnd, mainCurrency),
          is_fixed: budget.categories?.type === 'fixed',
        }));

      const analysisErrors: string[] = [];

      const runSafely = <T>(label: string, task: () => T): T | null => {
        try {
          return task();
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown analytics error';
          analysisErrors.push(`${label}: ${message}`);
          return null;
        }
      };

      const now = new Date();

      const transactionDaysInPeriod = new Set(
        txRows
          .filter((tx) => tx.payment_date >= toDateKey(periodBounds.start) && tx.payment_date <= toDateKey(periodBounds.end))
          .map((tx) => tx.payment_date),
      ).size;

      const transactionHistoryMonths = new Set(
        monthlyTotalRows.map((row) => row.month.slice(0, 7)),
      ).size;

      const investmentHistoryMonths = new Set(
        investmentSnapshotRows.map((row) => row.month.slice(0, 7)),
      ).size;

      const momentum = runSafely('spendingMomentum', () => analytics.spendingMomentum(dailyExpenses, now));
      const stability = runSafely('expenseStability', () =>
        analytics.expenseStability(categorySnapshots, monthlySnapshots),
      );
      const forecast = runSafely('expenseForecast', () =>
        analytics.expenseForecast(
          dailyExpenses,
          periodBounds.start,
          periodBounds.end,
          categoryBudgets,
          now,
        ),
      );
      const optimization = runSafely('categoryOptimization', () =>
        analytics.categoryOptimization(
          categorySnapshots,
          categoryBudgets.map((budget) => ({ name: budget.name, budget: budget.budget })),
        ),
      );

      return {
        momentum,
        stability,
        forecast,
        optimization,
        error: analysisErrors.length > 0 ? analysisErrors.join(' | ') : null,
        lastUpdated: new Date(),
        guardData: {
          transactionDaysInPeriod,
          transactionHistoryMonths,
          investmentHistoryMonths,
        },
      };
    },
    staleTime: 1000 * 60,
  });

  return {
    momentum: query.data?.momentum ?? null,
    stability: query.data?.stability ?? null,
    forecast: query.data?.forecast ?? null,
    optimization: query.data?.optimization ?? null,
    isLoading: query.isLoading || query.isFetching,
    error: query.error instanceof Error ? query.error.message : query.data?.error ?? null,
    lastUpdated: query.data?.lastUpdated ?? null,
    guardData: query.data?.guardData ?? {
      transactionDaysInPeriod: 0,
      transactionHistoryMonths: 0,
      investmentHistoryMonths: 0,
    },
  };
}
