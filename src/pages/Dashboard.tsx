import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  PiggyBank,
  TrendingUp,
  AlertTriangle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useBudgets } from '@/hooks/useBudgets';
import { useCategories } from '@/hooks/useCategories';
import { useTransactions } from '@/hooks/useTransactions';
import { format, startOfMonth, endOfMonth } from 'date-fns';

export default function Dashboard() {
  const { monthlySettings, budgets, loading: budgetsLoading } = useBudgets();
  const { activeCategories, loading: categoriesLoading } = useCategories();
  const { transactions, incompleteCount, loading: transactionsLoading } = useTransactions({
    dateFrom: startOfMonth(new Date()),
    dateTo: endOfMonth(new Date()),
  });

  // Calculate spent per category
  const spentByCategory = useMemo(() => {
    const result: Record<string, number> = {};
    transactions.forEach(tx => {
      if (tx.category_id && tx.amount < 0) {
        result[tx.category_id] = (result[tx.category_id] || 0) + Math.abs(tx.amount);
      }
    });
    return result;
  }, [transactions]);

  // Calculate income
  const actualIncome = useMemo(() => {
    return transactions
      .filter(tx => tx.amount > 0)
      .reduce((sum, tx) => sum + tx.amount, 0);
  }, [transactions]);

  // Calculate totals
  const getBudgetAmount = (categoryId: string) => {
    const budget = budgets.find(b => b.category_id === categoryId);
    return budget?.expected_amount || 0;
  };

  const { fixedCategories, variableCategories } = useMemo(() => {
    const fixed = activeCategories.filter(c => c.type === 'fixed');
    const variable = activeCategories.filter(c => c.type === 'variable');
    return { fixedCategories: fixed, variableCategories: variable };
  }, [activeCategories]);

  const expectedIncome = monthlySettings?.expected_income || 0;
  const totalExpenses = transactions.filter(tx => tx.amount < 0).reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
  const fixedExpenses = fixedCategories.reduce((sum, cat) => sum + (spentByCategory[cat.id] || 0), 0);
  const variableExpenses = variableCategories.reduce((sum, cat) => sum + (spentByCategory[cat.id] || 0), 0);
  const actualSavings = actualIncome - totalExpenses;

  // Top spending categories
  const topCategories = useMemo(() => {
    return activeCategories
      .filter(c => c.type !== 'income')
      .map(cat => ({
        ...cat,
        spent: spentByCategory[cat.id] || 0,
        budget: getBudgetAmount(cat.id),
      }))
      .filter(c => c.spent > 0)
      .sort((a, b) => b.spent - a.spent)
      .slice(0, 5);
  }, [activeCategories, spentByCategory, budgets]);

  // Budget alerts
  const alerts = useMemo(() => {
    return activeCategories
      .filter(c => c.type !== 'income')
      .map(cat => {
        const spent = spentByCategory[cat.id] || 0;
        const budget = getBudgetAmount(cat.id);
        const percent = budget > 0 ? (spent / budget) * 100 : 0;
        return { category: cat.name, percent, spent, budget };
      })
      .filter(a => a.percent >= 85 && a.budget > 0)
      .sort((a, b) => b.percent - a.percent);
  }, [activeCategories, spentByCategory, budgets]);

  const loading = budgetsLoading || categoriesLoading || transactionsLoading;
  const currentMonth = format(new Date(), 'MMMM yyyy');

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <div className="text-sm text-muted-foreground">
          {currentMonth}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Income
            </CardTitle>
            <ArrowUpRight className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{actualIncome.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              of €{expectedIncome.toLocaleString()} expected
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Expenses
            </CardTitle>
            <ArrowDownRight className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{totalExpenses.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Fixed: €{fixedExpenses.toFixed(0)} | Variable: €{variableExpenses.toFixed(0)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Savings
            </CardTitle>
            <PiggyBank className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${actualSavings >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
              €{actualSavings.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              This month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Transactions
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-chart-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{transactions.length}</div>
            <p className="text-xs text-muted-foreground">
              {incompleteCount > 0 ? (
                <span className="text-amber-600">{incompleteCount} need category</span>
              ) : (
                'All categorized'
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Alerts */}
        {alerts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Budget Alerts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {alerts.map((alert, i) => (
                <div 
                  key={i}
                  className={`flex items-center justify-between rounded-lg border p-3 ${
                    alert.percent >= 100 
                      ? 'border-destructive/50 bg-destructive/10' 
                      : 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950'
                  }`}
                >
                  <div>
                    <p className="font-medium text-foreground">{alert.category}</p>
                    <p className="text-sm text-muted-foreground">
                      €{alert.spent.toFixed(0)} of €{alert.budget.toFixed(0)} ({alert.percent.toFixed(0)}%)
                    </p>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/budget">Review</Link>
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Top Categories */}
        <Card className={alerts.length === 0 ? 'lg:col-span-2' : ''}>
          <CardHeader>
            <CardTitle className="text-lg">Top Expenses</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {topCategories.length === 0 ? (
              <p className="py-4 text-center text-muted-foreground">
                No expenses this month yet
              </p>
            ) : (
              topCategories.map((cat) => (
                <div key={cat.id} className="flex items-center gap-3">
                  <div 
                    className="h-3 w-3 rounded-full flex-shrink-0" 
                    style={{ backgroundColor: cat.color }}
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{cat.name}</span>
                      <span className="text-muted-foreground">€{cat.spent.toFixed(0)}</span>
                    </div>
                    <Progress 
                      value={cat.budget > 0 ? Math.min((cat.spent / cat.budget) * 100, 100) : 0}
                      className="mt-1 h-2"
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/import">Import Transactions</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/categories">Manage Categories</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/budget">Adjust Budget</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/transactions">View Transactions</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
