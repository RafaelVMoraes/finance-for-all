export interface MonthlySnapshot {
  period_label: string;
  year: number;
  month: number;
  total_income: number;
  total_expenses: number;
  savings: number;
}

export interface CategorySnapshot {
  name: string;
  month: number;
  year: number;
  actual: number;
  budget: number | null;
}

export interface DailyExpense {
  date: string;
  amount: number;
  category: string;
  is_fixed: boolean;
}

export interface SpendingMomentumResult {
  ma_7day: number;
  ma_30day: number;
  ratio: number;
  is_accelerating: boolean;
  acceleration_pct: number;
  status: 'accelerating' | 'normal' | 'decelerating';
}

export interface CategoryStabilityResult {
  category: string;
  mean: number;
  std_dev: number;
  cv: number;
  stability: 'stable' | 'moderate' | 'volatile';
  months_of_data: number;
}

export interface ExpenseStabilityResult {
  overall_cv: number;
  overall_stability: 'stable' | 'moderate' | 'volatile';
  by_category: CategoryStabilityResult[];
  most_volatile_category: string | null;
  most_stable_category: string | null;
}

export interface ExpenseForecastResult {
  days_passed: number;
  days_in_period: number;
  current_expenses: number;
  fixed_expenses_total: number;
  variable_expenses_so_far: number;
  projected_variable: number;
  projected_total: number;
  budget_total: number | null;
  projected_vs_budget: number | null;
  will_exceed_budget: boolean | null;
  excess_amount: number | null;
  low_confidence: boolean;
}

export interface CategoryOptimizationResult {
  category: string;
  avg_actual: number;
  current_budget: number | null;
  budget_gap: number | null;
  overspend_frequency_pct: number;
  potential_saving: number;
  recommendation: 'reduce_budget' | 'increase_budget' | 'set_budget' | 'on_track';
  priority_score: number;
}

export interface CategoryOptimizationReport {
  results: CategoryOptimizationResult[];
  top_opportunity: string | null;
  total_potential_saving: number;
  months_of_history: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function toUtcDateKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${date.getUTCDate()}`.padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function parseIsoDateToUtcMs(isoDate: string): number {
  return new Date(`${isoDate}T00:00:00.000Z`).getTime();
}

function utcDayDiffInclusive(startMs: number, endMs: number): number {
  if (endMs < startMs) {
    return 0;
  }

  return Math.floor((endMs - startMs) / DAY_MS) + 1;
}

function stabilityFromCv(cv: number): 'stable' | 'moderate' | 'volatile' {
  if (cv < 0.15) {
    return 'stable';
  }

  if (cv < 0.35) {
    return 'moderate';
  }

  return 'volatile';
}

function sumDailyTotalsInWindow(
  dailyTotalsByDate: Map<string, number>,
  referenceMs: number,
  days: number,
): number {
  let total = 0;

  for (let offset = 0; offset < days; offset += 1) {
    const dayMs = referenceMs - offset * DAY_MS;
    const dayKey = toUtcDateKey(new Date(dayMs));
    total += dailyTotalsByDate.get(dayKey) ?? 0;
  }

  return total;
}

export function calculateSpendingMomentum(
  dailyExpenses: DailyExpense[],
  referenceDate: Date,
): SpendingMomentumResult {
  const referenceMs = parseIsoDateToUtcMs(toUtcDateKey(referenceDate));

  const variableExpenses = dailyExpenses.filter(
    (expense) => !expense.is_fixed && parseIsoDateToUtcMs(expense.date) <= referenceMs,
  );

  const earliestMs = variableExpenses.reduce<number | null>((min, expense) => {
    const expenseMs = parseIsoDateToUtcMs(expense.date);

    if (min === null || expenseMs < min) {
      return expenseMs;
    }

    return min;
  }, null);

  const daysAvailable = earliestMs === null ? 0 : utcDayDiffInclusive(earliestMs, referenceMs);

  const dailyTotalsByDate = new Map<string, number>();
  for (const expense of variableExpenses) {
    const current = dailyTotalsByDate.get(expense.date) ?? 0;
    dailyTotalsByDate.set(expense.date, current + expense.amount);
  }

  const ma7Divisor = Math.min(7, daysAvailable);
  const ma30Divisor = Math.min(30, daysAvailable);

  const ma7Sum = ma7Divisor > 0 ? sumDailyTotalsInWindow(dailyTotalsByDate, referenceMs, ma7Divisor) : 0;
  const ma30Sum =
    ma30Divisor > 0 ? sumDailyTotalsInWindow(dailyTotalsByDate, referenceMs, ma30Divisor) : 0;

  const ma_7day = ma7Divisor > 0 ? ma7Sum / ma7Divisor : 0;
  const ma_30day = ma30Divisor > 0 ? ma30Sum / ma30Divisor : 0;
  const ratio = ma_30day === 0 ? 1 : ma_7day / ma_30day;
  const acceleration_pct = (ratio - 1) * 100;

  const canClassifyAcceleration = daysAvailable >= 14;
  const is_accelerating = daysAvailable >= 7 && ratio > 1.2;

  let status: 'accelerating' | 'normal' | 'decelerating' = 'normal';
  if (canClassifyAcceleration) {
    if (ratio > 1.2) {
      status = 'accelerating';
    } else if (ratio < 0.8) {
      status = 'decelerating';
    }
  }

  return {
    ma_7day,
    ma_30day,
    ratio,
    is_accelerating,
    acceleration_pct,
    status,
  };
}

export function calculateExpenseStability(
  categorySnapshots: CategorySnapshot[],
  monthlySnapshots: MonthlySnapshot[],
): ExpenseStabilityResult {
  const byCategoryMap = groupBy(categorySnapshots, (snapshot) => snapshot.name);

  const by_category: CategoryStabilityResult[] = [];

  for (const [category, snapshots] of byCategoryMap.entries()) {
    if (snapshots.length < 2) {
      continue;
    }

    const values = snapshots.map((snapshot) => snapshot.actual);
    const categoryMean = mean(values);
    const categoryStdDev = stdDev(values);
    const cv = categoryMean === 0 ? 0 : categoryStdDev / categoryMean;

    by_category.push({
      category,
      mean: categoryMean,
      std_dev: categoryStdDev,
      cv,
      stability: stabilityFromCv(cv),
      months_of_data: snapshots.length,
    });
  }

  by_category.sort((a, b) => b.cv - a.cv);

  const monthlyExpenseValues = monthlySnapshots.map((snapshot) => snapshot.total_expenses);
  const overall_cv = coefficientOfVariation(monthlyExpenseValues);
  const overall_stability = stabilityFromCv(overall_cv);

  return {
    overall_cv,
    overall_stability,
    by_category,
    most_volatile_category: by_category.length > 0 ? by_category[0].category : null,
    most_stable_category: by_category.length > 0 ? by_category[by_category.length - 1].category : null,
  };
}

export function calculateExpenseForecast(
  dailyExpenses: DailyExpense[],
  periodStart: Date,
  periodEnd: Date,
  categoryBudgets: Array<{ name: string; budget: number; is_fixed: boolean }>,
  referenceDate: Date,
): ExpenseForecastResult {
  const periodStartMs = parseIsoDateToUtcMs(toUtcDateKey(periodStart));
  const periodEndMs = parseIsoDateToUtcMs(toUtcDateKey(periodEnd));
  const referenceMs = parseIsoDateToUtcMs(toUtcDateKey(referenceDate));
  const anchorMs = Math.min(referenceMs, periodEndMs);

  const days_in_period = utcDayDiffInclusive(periodStartMs, periodEndMs);
  const days_passed = Math.max(1, utcDayDiffInclusive(periodStartMs, anchorMs));

  const periodExpensesToDate = dailyExpenses.filter((expense) => {
    const expenseMs = parseIsoDateToUtcMs(expense.date);
    return expenseMs >= periodStartMs && expenseMs <= anchorMs;
  });

  const current_expenses = periodExpensesToDate.reduce((sum, expense) => sum + expense.amount, 0);
  const fixed_expenses_total = periodExpensesToDate
    .filter((expense) => expense.is_fixed)
    .reduce((sum, expense) => sum + expense.amount, 0);
  const variable_expenses_so_far = current_expenses - fixed_expenses_total;

  const periodComplete = days_passed >= days_in_period;
  const projected_variable = periodComplete
    ? variable_expenses_so_far
    : (variable_expenses_so_far / days_passed) * days_in_period;
  const projected_total = periodComplete ? current_expenses : fixed_expenses_total + projected_variable;

  const budget_total = categoryBudgets.length > 0
    ? categoryBudgets.reduce((sum, categoryBudget) => sum + categoryBudget.budget, 0)
    : null;

  const projected_vs_budget = budget_total === null ? null : projected_total - budget_total;
  const will_exceed_budget = budget_total === null ? null : projected_total > budget_total;
  const excess_amount = projected_vs_budget === null ? null : Math.max(0, projected_vs_budget);

  return {
    days_passed,
    days_in_period,
    current_expenses,
    fixed_expenses_total,
    variable_expenses_so_far,
    projected_variable,
    projected_total,
    budget_total,
    projected_vs_budget,
    will_exceed_budget,
    excess_amount,
    low_confidence: days_passed < 3,
  };
}

export function calculateCategoryOptimization(
  categorySnapshots: CategorySnapshot[],
  categoryBudgets: Array<{ name: string; budget: number | null }>,
): CategoryOptimizationReport {
  const snapshotsByCategory = groupBy(categorySnapshots, (snapshot) => snapshot.name);
  const budgetsByCategory = new Map(categoryBudgets.map((budget) => [budget.name, budget.budget]));

  const distinctMonths = new Set(categorySnapshots.map((snapshot) => `${snapshot.year}-${snapshot.month}`));
  const months_of_history = distinctMonths.size;

  const results: CategoryOptimizationResult[] = [];

  for (const [category, snapshots] of snapshotsByCategory.entries()) {
    if (snapshots.length < 2) {
      continue;
    }

    const values = snapshots.map((snapshot) => snapshot.actual);
    const avg_actual = mean(values);
    const current_budget = budgetsByCategory.get(category) ?? null;
    const budget_gap = current_budget === null ? null : avg_actual - current_budget;

    const overspend_frequency_pct =
      current_budget === null || current_budget <= 0
        ? 0
        : (snapshots.filter((snapshot) => snapshot.actual > current_budget).length / snapshots.length) * 100;

    const potential_saving =
      current_budget === null || avg_actual <= current_budget
        ? 0
        : (avg_actual - current_budget) * snapshots.length;

    const consistentlyUnderBudgetBy15Pct =
      current_budget !== null &&
      snapshots.length >= 3 &&
      snapshots.every((snapshot) => snapshot.actual < current_budget * 0.85);

    const consistentlyOverBudget =
      current_budget !== null && snapshots.every((snapshot) => snapshot.actual > current_budget);

    let recommendation: 'reduce_budget' | 'increase_budget' | 'set_budget' | 'on_track' = 'on_track';
    if (current_budget === null) {
      recommendation = 'set_budget';
    } else if (consistentlyUnderBudgetBy15Pct) {
      recommendation = 'reduce_budget';
    } else if (consistentlyOverBudget) {
      recommendation = 'increase_budget';
    }

    let priority_score = 0;
    if (current_budget === null) {
      priority_score = avg_actual > 0 ? 40 : 0;
    } else {
      const normalizedGap = avg_actual === 0 ? 0 : Math.abs(budget_gap ?? avg_actual) / avg_actual;
      priority_score = clamp(normalizedGap * overspend_frequency_pct, 0, 100);
    }

    results.push({
      category,
      avg_actual,
      current_budget,
      budget_gap,
      overspend_frequency_pct,
      potential_saving,
      recommendation,
      priority_score,
    });
  }

  results.sort((a, b) => b.priority_score - a.priority_score);

  return {
    results,
    top_opportunity: results.length > 0 ? results[0].category : null,
    total_potential_saving: results.reduce((sum, result) => sum + result.potential_saving, 0),
    months_of_history,
  };
}

function mean(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stdDev(values: number[]): number {
  if (values.length < 2) {
    return 0;
  }

  const avg = mean(values);
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function coefficientOfVariation(values: number[]): number {
  const avg = mean(values);
  if (avg === 0) {
    return 0;
  }

  return stdDev(values) / avg;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function groupBy<T>(arr: T[], keyFn: (item: T) => string): Map<string, T[]> {
  const grouped = new Map<string, T[]>();

  for (const item of arr) {
    const key = keyFn(item);
    const existing = grouped.get(key) ?? [];
    existing.push(item);
    grouped.set(key, existing);
  }

  return grouped;
}

export const analytics = {
  spendingMomentum: calculateSpendingMomentum,
  expenseStability: calculateExpenseStability,
  expenseForecast: calculateExpenseForecast,
  categoryOptimization: calculateCategoryOptimization,
};
