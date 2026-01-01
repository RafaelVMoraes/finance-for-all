// Core finance types

export type CategoryType = 'fixed' | 'variable' | 'income';
export type Currency = 'EUR' | 'USD' | 'BRL';
export type Frequency = 'monthly' | 'average';

export interface Transaction {
  id: string;
  userId: string;
  paymentDate: string;
  paymentId: string;
  amount: number;
  originalCategory: string | null;
  userCategoryId: string | null;
  createdAt: string;
}

export interface Category {
  id: string;
  userId: string;
  name: string;
  type: CategoryType;
  color: string;
  archived: boolean;
  createdAt: string;
}

export interface Budget {
  id: string;
  userId: string;
  categoryId: string;
  expectedAmount: number;
  frequency: Frequency;
  createdAt: string;
}

export interface MonthlySettings {
  id: string;
  userId: string;
  expectedIncome: number;
  createdAt: string;
}

export interface Investment {
  id: string;
  userId: string;
  name: string;
  investmentType: string;
  currency: Currency;
  initialAmount: number;
  monthlyContribution: number;
  createdAt: string;
}

export interface InvestmentSnapshot {
  id: string;
  investmentId: string;
  month: string;
  totalValue: number;
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
}

export interface MonthSummary {
  expectedIncome: number;
  actualIncome: number;
  totalExpenses: number;
  fixedExpenses: number;
  variableExpenses: number;
  estimatedSavings: number;
  actualSavings: number;
}

export interface CategorySummary {
  category: Category;
  spent: number;
  budgeted: number;
  percentUsed: number;
}
