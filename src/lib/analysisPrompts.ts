import type {
  BudgetOptimizationData,
  FinancialContext,
  InvestmentReviewData,
  MonthlyReviewData,
} from '@/types/analysis';

const formatMoney = (value: number | null): string => {
  if (value === null) return 'n/a';
  return Number(value.toFixed(2)).toLocaleString();
};

const formatPct = (value: number): string => `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;

function asMonthlyData(data: FinancialContext['data']): MonthlyReviewData {
  return data as MonthlyReviewData;
}

function asInvestmentData(data: FinancialContext['data']): InvestmentReviewData {
  return data as InvestmentReviewData;
}

function asBudgetData(data: FinancialContext['data']): BudgetOptimizationData {
  return data as BudgetOptimizationData;
}

export function buildMonthlyReviewPrompt(context: FinancialContext): string {
  const data = asMonthlyData(context.data);

  const categories = data.categories
    .map((category) => {
      const budgetText = category.budget === null ? 'no budget' : formatMoney(category.budget);
      const prevMonthText =
        category.prev_month_actual === null ? 'n/a' : formatMoney(category.prev_month_actual);
      const isOverBudget = category.budget !== null && category.actual > category.budget;

      return `- ${category.name}: budget ${budgetText}, actual ${formatMoney(category.actual)}, prev month ${prevMonthText}${isOverBudget ? ' [OVER BUDGET]' : ''}`;
    })
    .join('\n');

  const topExpenses = data.top_5_expenses
    .map(
      (expense, index) =>
        `${index + 1}. ${expense.description} — ${expense.category} — ${formatMoney(expense.amount)}`,
    )
    .join('\n');

  return `MONTHLY FINANCIAL REVIEW — ${context.period_label}
Currency: ${context.main_currency} | Language: ${context.user_language}

SUMMARY
- Total income: ${formatMoney(data.total_income)}
- Total expenses: ${formatMoney(data.total_expenses)}
- Savings: ${formatMoney(data.savings_amount)} (${data.savings_rate_pct.toFixed(1)}% of income)
- vs. previous month: expenses changed by ${formatPct(data.expense_change_pct)}

CATEGORY BREAKDOWN
${categories || '- No category activity available'}

TOP 5 EXPENSES THIS MONTH
${topExpenses || '- No expenses registered'}

NET WORTH
- Current: ${formatMoney(data.net_worth_current)}
- Previous month: ${formatMoney(data.net_worth_prev_month)}

Please provide:
1. A summary of what happened financially this month
2. The main drivers of any significant changes
3. 2–3 specific and actionable recommendations for next month`;
}

export function buildInvestmentReviewPrompt(context: FinancialContext): string {
  const data = asInvestmentData(context.data);

  const categoryRows = data.by_category
    .map((category) => {
      const prev = category.prev_month_value === null ? 'n/a' : formatMoney(category.prev_month_value);
      return `- ${category.name}: current ${formatMoney(category.current_value)}, previous ${prev}, allocation ${category.allocation_pct.toFixed(1)}%`;
    })
    .join('\n');

  const growthRows = data.monthly_growth_history
    .map((item) => `- ${item.period_label}: ${formatPct(item.growth_pct)}`)
    .join('\n');

  return `INVESTMENT REVIEW — ${context.period_label}
Currency: ${context.main_currency} | Language: ${context.user_language}

PORTFOLIO SUMMARY
- Total net worth: ${formatMoney(data.total_net_worth)}
- Monthly change: ${formatPct(data.net_worth_change_pct)}
- Year-to-date change: ${formatPct(data.net_worth_ytd_change_pct)}

ALLOCATION BY CATEGORY
${categoryRows || '- No portfolio categories available'}

MONTHLY GROWTH HISTORY (LAST 6 MONTHS)
${growthRows || '- Not enough history available'}

Please provide:
1. A summary of portfolio performance for this period
2. The main drivers behind positive or negative movements
3. 2–3 actionable next steps to improve allocation and risk balance`;
}

export function buildBudgetOptimizationPrompt(context: FinancialContext): string {
  const data = asBudgetData(context.data);

  const categoryRows = data.categories
    .map((category) => {
      const budget = category.current_budget === null ? 'no budget' : formatMoney(category.current_budget);
      const avg6 = category.avg_actual_6m === null ? 'n/a' : formatMoney(category.avg_actual_6m);
      const avg12 = category.avg_actual_12m === null ? 'n/a' : formatMoney(category.avg_actual_12m);
      return `- ${category.name}: current budget ${budget}, avg 3m ${formatMoney(category.avg_actual_3m)}, avg 6m ${avg6}, avg 12m ${avg12}, volatility ${category.volatility}, trend ${category.trend}`;
    })
    .join('\n');

  return `BUDGET OPTIMIZATION REVIEW — ${context.period_label}
Currency: ${context.main_currency} | Language: ${context.user_language}

DATA COVERAGE
- Months of history available: ${data.months_of_history}

CATEGORY INSIGHTS
${categoryRows || '- No category history available'}

Please provide:
1. Which budgets appear unrealistic (too high or too low) based on historical behavior
2. Which categories are the most unstable and why this matters
3. 3 concrete budget adjustments for the next month`;
}
