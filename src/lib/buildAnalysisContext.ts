import { addMonths, format, startOfMonth, subMonths } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { APP_START_DATE } from '@/constants/app';
import type {
  BudgetOptimizationData,
  FinancialContext,
  InvestmentReviewData,
  MonthlyReviewData,
} from '@/types/analysis';
import type { Currency, UserSettings } from '@/hooks/useUserSettings';

interface PeriodInput {
  year: number;
  month: number;
}

interface TxRow {
  amount: number;
  payment_date: string;
  original_label: string;
  edited_label: string | null;
  category_id: string | null;
  categories: { id: string; name: string; type: 'fixed' | 'variable' | 'income' } | null;
}

interface BudgetRow {
  category_id: string;
  expected_amount: number;
  categories: { id: string; name: string; type: 'fixed' | 'variable' | 'income' } | null;
}

interface InvestmentRow {
  id: string;
  name: string;
  investment_type: string;
  currency: Currency;
  initial_amount: number;
}

interface SnapshotRow {
  investment_id: string;
  month: string;
  total_value: number;
}

interface ExchangeRateRow {
  month: string;
  from_currency: Currency;
  to_currency: Currency;
  rate: number;
}

type UserSettingsInput = UserSettings & {
  mainCurrency?: Currency;
  language?: string;
  user_language?: string;
};

const monthDate = (period: PeriodInput): Date => new Date(Date.UTC(period.year, period.month - 1, 1));

const pctChange = (previous: number, current: number): number => {
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / previous) * 100;
};

const mean = (values: number[]): number => {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const standardDeviation = (values: number[]): number => {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const variance = mean(values.map((value) => (value - avg) ** 2));
  return Math.sqrt(variance);
};

const resolveMainCurrency = (userSettings: UserSettingsInput): Currency => {
  return (userSettings.main_currency || userSettings.mainCurrency || 'EUR') as Currency;
};

const resolveLanguage = (userSettings: UserSettingsInput): string => {
  return userSettings.user_language || userSettings.language || 'en';
};

const getUserId = async (): Promise<string> => {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('User must be authenticated to build analysis context');
  return data.user.id;
};

const fetchExchangeRates = async (userId: string): Promise<ExchangeRateRow[]> => {
  const { data, error } = await supabase
    .from('exchange_rates')
    .select('month,from_currency,to_currency,rate')
    .eq('user_id', userId)
    .order('month', { ascending: false });

  if (error) throw error;
  return (data || []) as ExchangeRateRow[];
};

const getRate = (
  rates: ExchangeRateRow[],
  fromCurrency: Currency,
  toCurrency: Currency,
  month: Date,
): number => {
  if (fromCurrency === toCurrency) return 1;

  const monthStr = format(startOfMonth(month), 'yyyy-MM-dd');
  const exact = rates.find(
    (rate) =>
      rate.month === monthStr && rate.from_currency === fromCurrency && rate.to_currency === toCurrency,
  );
  if (exact) return exact.rate;

  const inverseExact = rates.find(
    (rate) =>
      rate.month === monthStr && rate.from_currency === toCurrency && rate.to_currency === fromCurrency,
  );
  if (inverseExact) return 1 / inverseExact.rate;

  const fallback = rates.find(
    (rate) => rate.from_currency === fromCurrency && rate.to_currency === toCurrency,
  );
  if (fallback) return fallback.rate;

  const inverseFallback = rates.find(
    (rate) => rate.from_currency === toCurrency && rate.to_currency === fromCurrency,
  );
  if (inverseFallback) return 1 / inverseFallback.rate;

  return 1;
};

const calculateNetWorth = (
  investments: InvestmentRow[],
  snapshots: SnapshotRow[],
  rates: ExchangeRateRow[],
  currency: Currency,
  month: Date,
): number => {
  const monthStr = format(startOfMonth(month), 'yyyy-MM-dd');

  return investments.reduce((sum, investment) => {
    const snapshot = snapshots.find(
      (entry) => entry.investment_id === investment.id && entry.month === monthStr,
    );
    const value = snapshot?.total_value ?? investment.initial_amount;
    const rate = getRate(rates, investment.currency, currency, month);
    return sum + value * rate;
  }, 0);
};

export async function buildMonthlyReviewContext(
  financialPeriod: PeriodInput,
  userSettings: UserSettingsInput,
): Promise<FinancialContext> {
  const userId = await getUserId();
  const mainCurrency = resolveMainCurrency(userSettings);
  const userLanguage = resolveLanguage(userSettings);
  const currentMonth = monthDate(financialPeriod);
  const previousMonth = subMonths(currentMonth, 1);

  const currentStart = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
  const currentEnd = format(startOfMonth(addMonths(currentMonth, 1)), 'yyyy-MM-dd');
  const previousStart = format(startOfMonth(previousMonth), 'yyyy-MM-dd');
  const previousEnd = currentStart;

  const [{ data: currentTxData, error: currentTxError }, { data: prevTxData, error: prevTxError }] =
    await Promise.all([
      supabase
        .from('transactions')
        .select('amount,payment_date,original_label,edited_label,category_id,categories(id,name,type)')
        .eq('user_id', userId)
        .gte('payment_date', currentStart)
        .lt('payment_date', currentEnd),
      supabase
        .from('transactions')
        .select('amount,payment_date,original_label,edited_label,category_id,categories(id,name,type)')
        .eq('user_id', userId)
        .gte('payment_date', previousStart)
        .lt('payment_date', previousEnd),
    ]);

  if (currentTxError) throw currentTxError;
  if (prevTxError) throw prevTxError;

  const [budgetResult, investmentsResult, snapshotsResult, rates] = await Promise.all([
    supabase
      .from('budgets')
      .select('category_id,expected_amount,categories(id,name,type)')
      .eq('user_id', userId),
    supabase
      .from('investments')
      .select('id,name,investment_type,currency,initial_amount')
      .eq('user_id', userId),
    supabase
      .from('investment_snapshots')
      .select('investment_id,month,total_value')
      .order('month', { ascending: false }),
    fetchExchangeRates(userId),
  ]);

  if (budgetResult.error) throw budgetResult.error;
  if (investmentsResult.error) throw investmentsResult.error;
  if (snapshotsResult.error) throw snapshotsResult.error;

  const currentTransactions = (currentTxData || []) as TxRow[];
  const prevTransactions = (prevTxData || []) as TxRow[];
  const budgets = (budgetResult.data || []) as BudgetRow[];
  const investments = (investmentsResult.data || []) as InvestmentRow[];
  const snapshots = (snapshotsResult.data || []) as SnapshotRow[];

  const totalIncome = currentTransactions
    .filter((tx) => tx.categories?.type === 'income')
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

  const totalExpenses = currentTransactions
    .filter((tx) => tx.categories?.type !== 'income')
    .reduce((sum, tx) => sum + Math.abs(Number(tx.amount || 0)), 0);

  const prevMonthExpenses = prevTransactions
    .filter((tx) => tx.categories?.type !== 'income')
    .reduce((sum, tx) => sum + Math.abs(Number(tx.amount || 0)), 0);

  const budgetMap = new Map(budgets.map((budget) => [budget.category_id, budget]));
  const categoryNames = new Map<string, string>();

  currentTransactions.forEach((tx) => {
    if (tx.category_id && tx.categories?.type !== 'income') {
      categoryNames.set(tx.category_id, tx.categories?.name || 'Uncategorized');
    }
  });

  prevTransactions.forEach((tx) => {
    if (tx.category_id && tx.categories?.type !== 'income') {
      categoryNames.set(tx.category_id, tx.categories?.name || 'Uncategorized');
    }
  });

  budgets.forEach((budget) => {
    if (budget.categories?.type !== 'income') {
      categoryNames.set(budget.category_id, budget.categories?.name || 'Uncategorized');
    }
  });

  const categories = Array.from(categoryNames.entries())
    .map(([categoryId, name]) => {
      const actual = currentTransactions
        .filter((tx) => tx.category_id === categoryId && tx.categories?.type !== 'income')
        .reduce((sum, tx) => sum + Math.abs(Number(tx.amount || 0)), 0);

      const prevMonthActual = prevTransactions
        .filter((tx) => tx.category_id === categoryId && tx.categories?.type !== 'income')
        .reduce((sum, tx) => sum + Math.abs(Number(tx.amount || 0)), 0);

      return {
        name,
        budget: budgetMap.get(categoryId)?.expected_amount ?? null,
        actual,
        prev_month_actual: prevMonthActual,
      };
    })
    .sort((a, b) => b.actual - a.actual);

  const top5Expenses = currentTransactions
    .filter((tx) => tx.categories?.type !== 'income')
    .map((tx) => ({
      description: tx.edited_label || tx.original_label,
      category: tx.categories?.name || 'Uncategorized',
      amount: Math.abs(Number(tx.amount || 0)),
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  const netWorthCurrent = investments.length
    ? calculateNetWorth(investments, snapshots, rates, mainCurrency, currentMonth)
    : null;
  const netWorthPrevious = investments.length
    ? calculateNetWorth(investments, snapshots, rates, mainCurrency, previousMonth)
    : null;

  const monthlyData: MonthlyReviewData = {
    total_income: totalIncome,
    total_expenses: totalExpenses,
    savings_amount: totalIncome - totalExpenses,
    savings_rate_pct: totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0,
    prev_month_expenses: prevMonthExpenses,
    expense_change_pct: pctChange(prevMonthExpenses, totalExpenses),
    categories,
    top_5_expenses: top5Expenses,
    net_worth_current: netWorthCurrent,
    net_worth_prev_month: netWorthPrevious,
  };

  return {
    user_language: userLanguage,
    main_currency: mainCurrency,
    analysis_type: 'monthly_review',
    period_label: format(currentMonth, 'MMMM yyyy'),
    data: monthlyData,
  };
}

export async function buildInvestmentReviewContext(
  financialPeriod: PeriodInput,
  userSettings: UserSettingsInput,
): Promise<FinancialContext> {
  const userId = await getUserId();
  const mainCurrency = resolveMainCurrency(userSettings);
  const userLanguage = resolveLanguage(userSettings);
  const selectedMonth = monthDate(financialPeriod);
  const previousMonth = subMonths(selectedMonth, 1);

  const [investmentsResult, snapshotsResult, rates] = await Promise.all([
    supabase
      .from('investments')
      .select('id,name,investment_type,currency,initial_amount')
      .eq('user_id', userId),
    supabase
      .from('investment_snapshots')
      .select('investment_id,month,total_value')
      .order('month', { ascending: false }),
    fetchExchangeRates(userId),
  ]);

  if (investmentsResult.error) throw investmentsResult.error;
  if (snapshotsResult.error) throw snapshotsResult.error;

  const investments = (investmentsResult.data || []) as InvestmentRow[];
  const snapshots = (snapshotsResult.data || []) as SnapshotRow[];

  const currentTotal = calculateNetWorth(investments, snapshots, rates, mainCurrency, selectedMonth);
  const previousTotal = calculateNetWorth(investments, snapshots, rates, mainCurrency, previousMonth);

  const janOfYear = new Date(Date.UTC(financialPeriod.year, 0, 1));
  const ytdBaseline = calculateNetWorth(investments, snapshots, rates, mainCurrency, janOfYear);

  const byTypeMap = new Map<string, { current: number; previous: number }>();
  investments.forEach((investment) => {
    const currentRate = getRate(rates, investment.currency, mainCurrency, selectedMonth);
    const previousRate = getRate(rates, investment.currency, mainCurrency, previousMonth);

    const currentSnapshot = snapshots.find(
      (snapshot) =>
        snapshot.investment_id === investment.id &&
        snapshot.month === format(startOfMonth(selectedMonth), 'yyyy-MM-dd'),
    );
    const previousSnapshot = snapshots.find(
      (snapshot) =>
        snapshot.investment_id === investment.id &&
        snapshot.month === format(startOfMonth(previousMonth), 'yyyy-MM-dd'),
    );

    const currentValue = (currentSnapshot?.total_value ?? investment.initial_amount) * currentRate;
    const previousValue = (previousSnapshot?.total_value ?? investment.initial_amount) * previousRate;

    const key = investment.investment_type || 'Other';
    const existing = byTypeMap.get(key) || { current: 0, previous: 0 };
    existing.current += currentValue;
    existing.previous += previousValue;
    byTypeMap.set(key, existing);
  });

  const byCategory = Array.from(byTypeMap.entries()).map(([name, values]) => ({
    name,
    current_value: values.current,
    prev_month_value: values.previous,
    allocation_pct: currentTotal > 0 ? (values.current / currentTotal) * 100 : 0,
  }));

  const monthlyGrowthHistory = Array.from({ length: 6 }, (_, index) => {
    const targetMonth = subMonths(selectedMonth, 5 - index);
    const previousTarget = subMonths(targetMonth, 1);
    const targetTotal = calculateNetWorth(investments, snapshots, rates, mainCurrency, targetMonth);
    const previousTargetTotal = calculateNetWorth(
      investments,
      snapshots,
      rates,
      mainCurrency,
      previousTarget,
    );

    return {
      period_label: format(targetMonth, 'MMM yyyy'),
      growth_pct: pctChange(previousTargetTotal, targetTotal),
    };
  });

  const data: InvestmentReviewData = {
    total_net_worth: currentTotal,
    net_worth_change_pct: pctChange(previousTotal, currentTotal),
    net_worth_ytd_change_pct: pctChange(ytdBaseline, currentTotal),
    by_category: byCategory.sort((a, b) => b.current_value - a.current_value),
    monthly_growth_history: monthlyGrowthHistory,
  };

  return {
    user_language: userLanguage,
    main_currency: mainCurrency,
    analysis_type: 'investment_review',
    period_label: format(selectedMonth, 'MMMM yyyy'),
    data,
  };
}

export async function buildBudgetOptimizationContext(
  userSettings: UserSettingsInput,
): Promise<FinancialContext> {
  const userId = await getUserId();
  const mainCurrency = resolveMainCurrency(userSettings);
  const userLanguage = resolveLanguage(userSettings);

  const currentMonth = startOfMonth(new Date());
  const historyStart = startOfMonth(subMonths(currentMonth, 11));
  const effectiveHistoryStart = historyStart < APP_START_DATE ? APP_START_DATE : historyStart;

  const [transactionsResult, budgetsResult] = await Promise.all([
    supabase
      .from('transactions')
      .select('amount,payment_date,original_label,edited_label,category_id,categories(id,name,type)')
      .eq('user_id', userId)
      .gte('payment_date', format(effectiveHistoryStart, 'yyyy-MM-dd'))
      .lt('payment_date', format(addMonths(currentMonth, 1), 'yyyy-MM-dd')),
    supabase
      .from('budgets')
      .select('category_id,expected_amount,categories(id,name,type)')
      .eq('user_id', userId),
  ]);

  if (transactionsResult.error) throw transactionsResult.error;
  if (budgetsResult.error) throw budgetsResult.error;

  const transactions = (transactionsResult.data || []) as TxRow[];
  const budgets = (budgetsResult.data || []) as BudgetRow[];

  const monthKeys: string[] = [];
  for (let i = 0; i < 12; i += 1) {
    const month = startOfMonth(subMonths(currentMonth, i));
    if (month >= startOfMonth(effectiveHistoryStart)) {
      monthKeys.unshift(format(month, 'yyyy-MM-dd'));
    }
  }

  const categoryNames = new Map<string, string>();
  const budgetMap = new Map<string, number>();
  const spendingByCategory = new Map<string, Record<string, number>>();

  budgets.forEach((budget) => {
    if (budget.categories?.type === 'income') return;
    categoryNames.set(budget.category_id, budget.categories?.name || 'Uncategorized');
    budgetMap.set(budget.category_id, budget.expected_amount);
  });

  transactions.forEach((tx) => {
    if (!tx.category_id || tx.categories?.type === 'income') return;
    const month = format(startOfMonth(new Date(tx.payment_date)), 'yyyy-MM-dd');
    if (!monthKeys.includes(month)) return;

    categoryNames.set(tx.category_id, tx.categories?.name || 'Uncategorized');
    const existing = spendingByCategory.get(tx.category_id) || {};
    existing[month] = (existing[month] || 0) + Math.abs(Number(tx.amount || 0));
    spendingByCategory.set(tx.category_id, existing);
  });

  const categoryRows = Array.from(categoryNames.entries()).map(([categoryId, name]) => {
    const monthlyValues = monthKeys.map((month) => spendingByCategory.get(categoryId)?.[month] || 0);
    const avg3 = mean(monthlyValues.slice(-3));
    const avg6 = monthlyValues.length >= 6 ? mean(monthlyValues.slice(-6)) : null;
    const avg12 = monthlyValues.length >= 12 ? mean(monthlyValues.slice(-12)) : null;

    const avgForCv = mean(monthlyValues);
    const cv = avgForCv === 0 ? 0 : standardDeviation(monthlyValues) / avgForCv;
    const volatility: BudgetOptimizationData['categories'][number]['volatility'] =
      cv < 0.15 ? 'stable' : cv < 0.35 ? 'moderate' : 'volatile';

    const split = Math.max(1, Math.floor(monthlyValues.length / 2));
    const firstHalfAvg = mean(monthlyValues.slice(0, split));
    const secondHalfAvg = mean(monthlyValues.slice(split));
    const trendChange = pctChange(firstHalfAvg, secondHalfAvg);
    const trend: BudgetOptimizationData['categories'][number]['trend'] =
      trendChange > 5 ? 'increasing' : trendChange < -5 ? 'decreasing' : 'stable';

    return {
      name,
      current_budget: budgetMap.get(categoryId) ?? null,
      avg_actual_3m: avg3,
      avg_actual_6m: avg6,
      avg_actual_12m: avg12,
      volatility,
      trend,
    };
  });

  const data: BudgetOptimizationData = {
    months_of_history: monthKeys.length,
    categories: categoryRows.sort((a, b) => b.avg_actual_3m - a.avg_actual_3m),
  };

  return {
    user_language: userLanguage,
    main_currency: mainCurrency,
    analysis_type: 'budget_optimization',
    period_label: `Last ${monthKeys.length} months`,
    data,
  };
}
