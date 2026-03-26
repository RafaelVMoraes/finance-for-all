export type AnalysisType =
  | 'monthly_review'
  | 'investment_review'
  | 'budget_optimization';

export interface FinancialContext {
  user_language: string;
  main_currency: string;
  analysis_type: AnalysisType;
  period_label: string;
  data: MonthlyReviewData | InvestmentReviewData | BudgetOptimizationData;
}

export interface MonthlyReviewData {
  total_income: number;
  total_expenses: number;
  savings_amount: number;
  savings_rate_pct: number;
  prev_month_expenses: number;
  expense_change_pct: number;
  categories: Array<{
    name: string;
    budget: number | null;
    actual: number;
    prev_month_actual: number | null;
  }>;
  top_5_expenses: Array<{
    description: string;
    category: string;
    amount: number;
  }>;
  net_worth_current: number | null;
  net_worth_prev_month: number | null;
}

export interface InvestmentReviewData {
  total_net_worth: number;
  net_worth_change_pct: number;
  net_worth_ytd_change_pct: number;
  by_category: Array<{
    name: string;
    current_value: number;
    prev_month_value: number | null;
    allocation_pct: number;
  }>;
  monthly_growth_history: Array<{
    period_label: string;
    growth_pct: number;
  }>;
}

export interface BudgetOptimizationData {
  months_of_history: number;
  categories: Array<{
    name: string;
    current_budget: number | null;
    avg_actual_3m: number;
    avg_actual_6m: number | null;
    avg_actual_12m: number | null;
    volatility: 'stable' | 'moderate' | 'volatile';
    trend: 'increasing' | 'stable' | 'decreasing';
  }>;
}

export interface AnalysisResult {
  analysis_type: AnalysisType;
  period_label: string;
  narrative: string;
  generated_at: string;
  error?: string;
}
