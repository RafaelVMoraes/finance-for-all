import { ReactNode } from "react";

export interface CategoryProgressItem {
  id: string;
  name: string;
  color?: string;
  spent: number;
  budget: number;
  percent: number;
}

export interface WeeklyDataItem {
  week: string;
  spent: number;
  budget: number;
  delta: number;
  deltaLabel: string;
}

export interface MonthlyViewData {
  actualIncome: number;
  expectedIncome: number;
  expectedExpenses: number;
  totalExpenses: number;
  expectedSavings: number;
  actualSavings: number;
  remainingBudget: number;
  categoryProgress: CategoryProgressItem[];
  weeklyData: WeeklyDataItem[];
  monthlyCategoryBudgetProgress: YearlyCategoryProgress[];
  expenseHeatmap: ExpenseHeatmapDay[];
  topExpenses: TopExpenseItem[];
  monthlyInvestmentGrowthByCategory: MonthlyInvestmentGrowthByCategoryItem[];
}

export interface MonthlyInvestmentEvolution {
  current: number;
  lastMonth: number;
  pctChange: number;
}

export interface YearlyBudgetRealityRow {
  month: string;
  actualIncome: number;
  actualExpenses: number;
  actualSavings: number;
  incomePct: number;
  expensesPct: number;
  savingsPct: number;
}

export interface YearlyCategoryProgress {
  id: string;
  name: string;
  spent: number;
  annualBudget: number;
  consumedPct: number;
  allowedByNow: number;
  spentWithinAllowed: number;
  overspent: number;
  elapsedRatio: number;
}

export interface YearPeriodItem {
  key: string;
  monthLabel: string;
}

export interface InvestmentEvolutionItem {
  month: string;
  Investments: number | null;
  Emergency: number | null;
  Current: number | null;
}

export interface MonthlyInvestmentGrowthItem {
  month: string;
  growthPct: number | null;
  cumulativePct?: number | null;
  monthPct?: number | null;
}

export interface TopExpenseItem {
  id: string;
  name: string;
  amount: number;
  categoryName: string;
  categoryColor: string;
}

export interface ExpenseHeatmapDay {
  date: string;
  label: string;
  total: number;
  variableTotal: number;
  hasTransactions: boolean;
  hasFixedOnly: boolean;
  categories: Array<{ name: string; amount: number; color: string; type: string }>;
}

export interface MonthlyInvestmentGrowthByCategoryItem {
  month: string;
  hasData: boolean;
  [category: string]: string | number | boolean | null;
}

export interface InvestmentProjectionItem {
  label: string;
  months: number;
  value: number;
}

export interface YearlyViewData {
  chartData: Array<Record<string, number | string>>;
  monthlyStats: Array<{ key: string; income: number; expenses: number }>;
  budgetVsReality: YearlyBudgetRealityRow[];
  yearlyCategoryBudgetProgress: YearlyCategoryProgress[];
  expenseCategoryRows: Array<{ id: string; name: string; values: number[] }>;
  totalIncome: number;
  totalExpenses: number;
  totalSavings: number;
  monthsWithData: number;
}

export interface YearlyIncomeExpenseTooltipProps {
  active?: boolean;
  payload?: Array<{
    dataKey?: string;
    value?: number;
    payload?: Record<string, number>;
  }>;
  label?: string;
}

export type YearlyTooltipRenderer = (props: YearlyIncomeExpenseTooltipProps) => ReactNode;
