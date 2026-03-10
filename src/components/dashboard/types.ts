import { ReactNode } from "react";

export interface CategoryProgressItem {
  id: string;
  name: string;
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
  alerts: CategoryProgressItem[];
}

export interface MonthlyInvestmentEvolution {
  current: number;
  lastMonth: number;
  pctChange: number;
}

export interface MonthlyInvestmentRateRow {
  id: string;
  name: string;
  currency: string;
  monthRates: number[];
}

export interface InvestmentForecastItem {
  years: number;
  projectedTotal: number;
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
  Investments: number;
  Emergency: number;
  Current: number;
  total: number;
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
