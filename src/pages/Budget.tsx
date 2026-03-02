import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { TrendingDown, TrendingUp, PiggyBank, ChevronLeft, ChevronRight, Pencil } from 'lucide-react';
import { useBudgets } from '@/hooks/useBudgets';
import { useCategories } from '@/hooks/useCategories';
import { useBudgetMonthlySummary } from '@/hooks/useBudgetMonthlySummary';
import { format, addMonths, subMonths } from 'date-fns';
import { APP_START_DATE } from '@/constants/app';
import { Link } from 'react-router-dom';

export default function Budget() {
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  const { budgets, loading: budgetsLoading } = useBudgets({ month: selectedMonth });
  const { activeCategories, loading: categoriesLoading } = useCategories();
  const {
    categorySpent,
    actualIncome,
    loading: summaryLoading,
  } = useBudgetMonthlySummary(selectedMonth);

  // Month navigation with minimum date check
  const navigateMonth = useCallback((direction: 'prev' | 'next') => {
    const newMonth = direction === 'prev' ? subMonths(selectedMonth, 1) : addMonths(selectedMonth, 1);
    if (newMonth >= APP_START_DATE) {
      setSelectedMonth(newMonth);
    }
  }, [selectedMonth]);

  // Calculate categories by type
  const { fixedCategories, variableCategories, incomeCategories } = useMemo(() => {
    const fixed = activeCategories.filter(c => c.type === 'fixed');
    const variable = activeCategories.filter(c => c.type === 'variable');
    const income = activeCategories.filter(c => c.type === 'income');
    return { fixedCategories: fixed, variableCategories: variable, incomeCategories: income };
  }, [activeCategories]);

  const getBudgetAmount = useCallback((categoryId: string) => {
    const budget = budgets.find(b => b.category_id === categoryId);
    return budget?.expected_amount || 0;
  }, [budgets]);

  // Expected income is now sum of income category budgets
  const expectedIncome = useMemo(() => 
    incomeCategories.reduce((sum, cat) => sum + getBudgetAmount(cat.id), 0),
    [incomeCategories, getBudgetAmount]
  );
  
  const totalFixedBudget = useMemo(() => 
    fixedCategories.reduce((sum, cat) => sum + getBudgetAmount(cat.id), 0), 
    [fixedCategories, getBudgetAmount]
  );
  const totalVariableBudget = useMemo(() => 
    variableCategories.reduce((sum, cat) => sum + getBudgetAmount(cat.id), 0), 
    [variableCategories, getBudgetAmount]
  );
  const totalFixedSpent = useMemo(() => 
    fixedCategories.reduce((sum, cat) => sum + (categorySpent[cat.id] || 0), 0),
    [fixedCategories, categorySpent]
  );
  const totalVariableSpent = useMemo(() => 
    variableCategories.reduce((sum, cat) => sum + (categorySpent[cat.id] || 0), 0),
    [variableCategories, categorySpent]
  );
  
  const estimatedSavings = expectedIncome - totalFixedBudget - totalVariableBudget;
  const actualSavings = actualIncome - totalFixedSpent - totalVariableSpent;

  const getProgressColor = (spent: number, expected: number) => {
    if (expected === 0) return 'bg-muted';
    const pct = (spent / expected) * 100;
    if (pct >= 100) return 'bg-destructive';
    if (pct >= 85) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  if (budgetsLoading || categoriesLoading || summaryLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">Loading budget...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Month Navigation */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">Budget Overview</h1>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => navigateMonth('prev')}
            disabled={subMonths(selectedMonth, 1) < APP_START_DATE}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Badge variant="outline" className="min-w-[140px] justify-center text-sm">
            {format(selectedMonth, 'MMMM yyyy')}
          </Badge>
          <Button variant="outline" size="icon" onClick={() => navigateMonth('next')}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Edit Categories Button */}
      <div className="flex justify-end">
        <Button data-tutorial="budget-edit-categories-link" asChild>
          <Link to="/categories">
            <Pencil className="mr-2 h-4 w-4" />
            Edit Categories & Budgets
          </Link>
        </Button>
      </div>

      {/* Income & Savings Overview */}
      <div data-tutorial="budget-overview-cards" className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Expected Income */}
        <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-300">
              <TrendingUp className="h-4 w-4" />
              Expected Income
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-700 dark:text-amber-300">
              €{expectedIncome.toLocaleString()}
            </div>
            <p className="text-xs text-amber-600/70 dark:text-amber-400/70">
              Real: €{actualIncome.toLocaleString()}
            </p>
          </CardContent>
        </Card>

        {/* Fixed Expenses */}
        <Card className="border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-red-700 dark:text-red-300">
              <TrendingDown className="h-4 w-4" />
              Fixed Expenses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700 dark:text-red-300">
              €{totalFixedBudget.toLocaleString()}
            </div>
            <p className="text-xs text-red-600/70 dark:text-red-400/70">
              Spent: €{totalFixedSpent.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        {/* Variable Expenses */}
        <Card className="border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-red-700 dark:text-red-300">
              <TrendingDown className="h-4 w-4" />
              Variable Expenses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700 dark:text-red-300">
              €{totalVariableBudget.toLocaleString()}
            </div>
            <p className="text-xs text-red-600/70 dark:text-red-400/70">
              Spent: €{totalVariableSpent.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        {/* Savings */}
        <Card className="border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
              <PiggyBank className="h-4 w-4" />
              Estimated Savings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${estimatedSavings >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-destructive'}`}>
              €{estimatedSavings.toLocaleString()}
            </div>
            <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70">
              Actual: €{actualSavings.toFixed(2)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Fixed Expenses by Category */}
      {fixedCategories.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <div className="h-3 w-3 rounded-full bg-blue-500" />
              Fixed Expenses Budget
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {fixedCategories.map(cat => {
              const expected = getBudgetAmount(cat.id);
              const spent = categorySpent[cat.id] || 0;
              const percent = expected > 0 ? Math.min((spent / expected) * 100, 100) : 0;
              const remaining = expected - spent;

              return (
                <div key={cat.id} className="space-y-2 rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div 
                        className="h-3 w-3 rounded-full flex-shrink-0" 
                        style={{ backgroundColor: cat.color }}
                      />
                      <span className="font-medium">{cat.name}</span>
                    </div>
                    <span className="font-medium">€{expected.toFixed(0)}</span>
                  </div>
                  {expected > 0 && (
                    <>
                      <Progress 
                        value={percent} 
                        className={`h-2 ${getProgressColor(spent, expected)}`}
                      />
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">
                          €{spent.toFixed(2)} spent ({percent.toFixed(0)}%)
                        </span>
                        <span className={remaining >= 0 ? 'text-emerald-600' : 'text-destructive'}>
                          {remaining >= 0 ? '+' : ''}€{remaining.toFixed(2)} remaining
                        </span>
                      </div>
                    </>
                  )}
                  {expected === 0 && (
                    <p className="text-xs text-muted-foreground">
                      No budget set
                    </p>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Variable Expenses by Category */}
      {variableCategories.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <div className="h-3 w-3 rounded-full bg-purple-500" />
              Variable Expenses Budget
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {variableCategories.map(cat => {
              const expected = getBudgetAmount(cat.id);
              const spent = categorySpent[cat.id] || 0;
              const percent = expected > 0 ? Math.min((spent / expected) * 100, 100) : 0;
              const remaining = expected - spent;

              return (
                <div key={cat.id} className="space-y-2 rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div 
                        className="h-3 w-3 rounded-full flex-shrink-0" 
                        style={{ backgroundColor: cat.color }}
                      />
                      <span className="font-medium">{cat.name}</span>
                    </div>
                    <span className="font-medium">€{expected.toFixed(0)}</span>
                  </div>
                  {expected > 0 && (
                    <>
                      <Progress 
                        value={percent} 
                        className={`h-2 ${getProgressColor(spent, expected)}`}
                      />
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">
                          €{spent.toFixed(2)} spent ({percent.toFixed(0)}%)
                        </span>
                        <span className={remaining >= 0 ? 'text-emerald-600' : 'text-destructive'}>
                          {remaining >= 0 ? '+' : ''}€{remaining.toFixed(2)} remaining
                        </span>
                      </div>
                    </>
                  )}
                  {expected === 0 && (
                    <p className="text-xs text-muted-foreground">
                      No budget set
                    </p>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Income Categories */}
      {incomeCategories.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <div className="h-3 w-3 rounded-full bg-emerald-500" />
              Expected Income Sources
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {incomeCategories.map(cat => {
              const expected = getBudgetAmount(cat.id);
              return (
                <div key={cat.id} className="space-y-2 rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div 
                        className="h-3 w-3 rounded-full flex-shrink-0" 
                        style={{ backgroundColor: cat.color }}
                      />
                      <span className="font-medium">{cat.name}</span>
                    </div>
                    <span className="font-medium">€{expected.toFixed(0)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Included in monthly actual income
                  </p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {activeCategories.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No categories yet.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Create categories first to set up your budget.
            </p>
            <Button className="mt-4" asChild>
              <Link to="/categories">Create Categories</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
