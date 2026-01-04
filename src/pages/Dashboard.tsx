import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  PiggyBank,
  TrendingUp,
  AlertTriangle,
  Calendar,
  Target
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useBudgets } from '@/hooks/useBudgets';
import { useCategories } from '@/hooks/useCategories';
import { useTransactions } from '@/hooks/useTransactions';
import { useInvestments } from '@/hooks/useInvestments';
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, startOfWeek, endOfWeek, eachWeekOfInterval, subMonths, eachMonthOfInterval } from 'date-fns';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, LineChart, Line, AreaChart, Area, Cell, ResponsiveContainer } from 'recharts';

export default function Dashboard() {
  const [view, setView] = useState<'monthly' | 'yearly'>('monthly');
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();

  const { monthlySettings, budgets, loading: budgetsLoading } = useBudgets();
  const { activeCategories, loading: categoriesLoading } = useCategories();
  
  // Monthly data
  const { transactions: monthlyTransactions, incompleteCount, loading: transactionsLoading } = useTransactions({
    dateFrom: startOfMonth(currentDate),
    dateTo: endOfMonth(currentDate),
  });

  // Yearly data
  const { transactions: yearlyTransactions } = useTransactions({
    dateFrom: startOfYear(currentDate),
    dateTo: endOfYear(currentDate),
  });

  const { investments, snapshots, totalValue: investmentValue } = useInvestments();

  // Calculate spent per category (monthly)
  const spentByCategory = useMemo(() => {
    const result: Record<string, number> = {};
    monthlyTransactions.forEach(tx => {
      if (tx.category_id && tx.amount < 0) {
        result[tx.category_id] = (result[tx.category_id] || 0) + Math.abs(tx.amount);
      }
    });
    return result;
  }, [monthlyTransactions]);

  // Calculate income
  const actualIncome = useMemo(() => {
    return monthlyTransactions
      .filter(tx => tx.amount > 0)
      .reduce((sum, tx) => sum + tx.amount, 0);
  }, [monthlyTransactions]);

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
  const totalExpenses = monthlyTransactions.filter(tx => tx.amount < 0).reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
  const fixedExpenses = fixedCategories.reduce((sum, cat) => sum + (spentByCategory[cat.id] || 0), 0);
  const variableExpenses = variableCategories.reduce((sum, cat) => sum + (spentByCategory[cat.id] || 0), 0);
  const actualSavings = actualIncome - totalExpenses;

  const totalBudgetedFixed = fixedCategories.reduce((sum, cat) => sum + getBudgetAmount(cat.id), 0);
  const totalBudgetedVariable = variableCategories.reduce((sum, cat) => sum + getBudgetAmount(cat.id), 0);
  const expectedSavings = expectedIncome - totalBudgetedFixed - totalBudgetedVariable;
  const remainingBudget = expectedIncome - totalExpenses;

  // Weekly spending data for current month
  const weeklyData = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const weeks = eachWeekOfInterval({ start: monthStart, end: monthEnd }, { weekStartsOn: 1 });
    
    return weeks.map((weekStart, idx) => {
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
      const weekExpenses = monthlyTransactions
        .filter(tx => {
          const txDate = new Date(tx.payment_date);
          return tx.amount < 0 && txDate >= weekStart && txDate <= weekEnd;
        })
        .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
      
      const weeklyBudget = (totalBudgetedFixed + totalBudgetedVariable) / weeks.length;
      
      return {
        week: `Week ${idx + 1}`,
        spent: weekExpenses,
        budget: weeklyBudget,
      };
    });
  }, [monthlyTransactions, totalBudgetedFixed, totalBudgetedVariable]);

  // Category progress data
  const categoryProgress = useMemo(() => {
    return activeCategories
      .filter(c => c.type !== 'income')
      .map(cat => ({
        ...cat,
        spent: spentByCategory[cat.id] || 0,
        budget: getBudgetAmount(cat.id),
        percent: getBudgetAmount(cat.id) > 0 
          ? ((spentByCategory[cat.id] || 0) / getBudgetAmount(cat.id)) * 100 
          : 0,
      }))
      .filter(c => c.budget > 0)
      .sort((a, b) => b.percent - a.percent);
  }, [activeCategories, spentByCategory, budgets]);

  // Overspending categories (>85%)
  const overspendingCategories = categoryProgress.filter(c => c.percent >= 85);

  // Budget alerts
  const alerts = overspendingCategories.slice(0, 3);

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

  // Yearly data calculations
  const yearlyStats = useMemo(() => {
    const months = eachMonthOfInterval({ start: startOfYear(currentDate), end: endOfYear(currentDate) });
    
    return months.map(month => {
      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);
      
      const monthTx = yearlyTransactions.filter(tx => {
        const txDate = new Date(tx.payment_date);
        return txDate >= monthStart && txDate <= monthEnd;
      });

      const income = monthTx.filter(tx => tx.amount > 0).reduce((sum, tx) => sum + tx.amount, 0);
      const expenses = monthTx.filter(tx => tx.amount < 0).reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
      
      let fixedExp = 0;
      let variableExp = 0;
      monthTx.forEach(tx => {
        if (tx.amount < 0 && tx.category_id) {
          const cat = activeCategories.find(c => c.id === tx.category_id);
          if (cat?.type === 'fixed') fixedExp += Math.abs(tx.amount);
          else if (cat?.type === 'variable') variableExp += Math.abs(tx.amount);
        }
      });

      return {
        month: format(month, 'MMM'),
        income,
        fixed: fixedExp,
        variable: variableExp,
        savings: income - expenses,
      };
    });
  }, [yearlyTransactions, activeCategories]);

  // Category stability (std dev)
  const categoryStability = useMemo(() => {
    const monthlySpending: Record<string, number[]> = {};
    
    yearlyTransactions.forEach(tx => {
      if (tx.amount < 0 && tx.category_id) {
        const monthKey = format(new Date(tx.payment_date), 'yyyy-MM');
        if (!monthlySpending[tx.category_id]) {
          monthlySpending[tx.category_id] = [];
        }
        const existingMonth = monthlySpending[tx.category_id].findIndex((_, i) => i.toString() === monthKey);
        // Simplified: just accumulate
      }
    });

    return activeCategories
      .filter(c => c.type !== 'income')
      .map(cat => {
        const monthlyAmounts = yearlyStats.map(m => {
          const monthTx = yearlyTransactions.filter(tx => 
            tx.category_id === cat.id && 
            tx.amount < 0 &&
            format(new Date(tx.payment_date), 'MMM') === m.month
          );
          return monthTx.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
        }).filter(v => v > 0);

        const avg = monthlyAmounts.length > 0 
          ? monthlyAmounts.reduce((a, b) => a + b, 0) / monthlyAmounts.length 
          : 0;
        
        const variance = monthlyAmounts.length > 1
          ? monthlyAmounts.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / monthlyAmounts.length
          : 0;
        
        const stdDev = Math.sqrt(variance);
        const cv = avg > 0 ? (stdDev / avg) * 100 : 0; // Coefficient of variation

        return { ...cat, avg, stdDev, cv, isVolatile: cv > 30 };
      })
      .filter(c => c.avg > 0)
      .sort((a, b) => b.cv - a.cv);
  }, [yearlyTransactions, activeCategories, yearlyStats]);

  // Investment evolution data
  const investmentEvolution = useMemo(() => {
    const months: string[] = [];
    for (let i = 11; i >= 0; i--) {
      months.push(format(subMonths(currentDate, i), 'yyyy-MM-dd'));
    }

    return months.map(month => {
      let investmentsTotal = 0;
      let emergencyTotal = 0;
      let currentAccountTotal = 0;

      investments.forEach(inv => {
        const snapshot = snapshots
          .filter(s => s.investment_id === inv.id && s.month <= month)
          .sort((a, b) => b.month.localeCompare(a.month))[0];
        const value = snapshot?.total_value || 0;
        
        if (inv.investment_type === 'Investments') investmentsTotal += value;
        else if (inv.investment_type === 'Emergency savings') emergencyTotal += value;
        else if (inv.investment_type === 'Current account') currentAccountTotal += value;
      });

      return {
        month: format(new Date(month), 'MMM'),
        investments: investmentsTotal,
        emergency: emergencyTotal,
        current: currentAccountTotal,
        total: investmentsTotal + emergencyTotal + currentAccountTotal,
      };
    });
  }, [investments, snapshots]);

  const loading = budgetsLoading || categoriesLoading || transactionsLoading;
  const currentMonth = format(currentDate, 'MMMM yyyy');

  const chartConfig = {
    spent: { label: 'Spent', color: 'hsl(var(--chart-1))' },
    budget: { label: 'Budget', color: 'hsl(var(--chart-2))' },
    income: { label: 'Income', color: 'hsl(var(--chart-1))' },
    fixed: { label: 'Fixed', color: 'hsl(var(--chart-2))' },
    variable: { label: 'Variable', color: 'hsl(var(--chart-3))' },
    savings: { label: 'Savings', color: 'hsl(var(--chart-4))' },
    investments: { label: 'Investments', color: 'hsl(var(--chart-1))' },
    emergency: { label: 'Emergency', color: 'hsl(var(--chart-2))' },
    current: { label: 'Current', color: 'hsl(var(--chart-3))' },
  };

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
        <Tabs value={view} onValueChange={(v) => setView(v as 'monthly' | 'yearly')}>
          <TabsList>
            <TabsTrigger value="monthly" className="gap-2">
              <Calendar className="h-4 w-4" />
              Monthly
            </TabsTrigger>
            <TabsTrigger value="yearly" className="gap-2">
              <Target className="h-4 w-4" />
              Yearly
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {view === 'monthly' ? (
        // ========== MONTHLY VIEW ==========
        <div className="space-y-6">
          <div className="text-sm text-muted-foreground">{currentMonth}</div>

          {/* Top KPIs */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
                  Expected Savings
                </CardTitle>
                <PiggyBank className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${expectedSavings >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                  €{expectedSavings.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  Actual: €{actualSavings.toFixed(0)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Remaining Budget
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-chart-4" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${remainingBudget >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                  €{remainingBudget.toLocaleString()}
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
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{monthlyTransactions.length}</div>
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
            {/* Weekly Spending Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Weekly Spending</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[200px] w-full">
                  <BarChart data={weeklyData}>
                    <XAxis dataKey="week" tickLine={false} axisLine={false} />
                    <YAxis tickFormatter={(v) => `€${v}`} tickLine={false} axisLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="spent" fill="hsl(var(--chart-1))" radius={4} />
                    <Bar dataKey="budget" fill="hsl(var(--chart-2))" radius={4} opacity={0.3} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

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
                      <div className="flex items-center gap-2">
                        <div 
                          className="h-3 w-3 rounded-full" 
                          style={{ backgroundColor: alert.color }}
                        />
                        <div>
                          <p className="font-medium text-foreground">{alert.name}</p>
                          <p className="text-sm text-muted-foreground">
                            €{alert.spent.toFixed(0)} of €{alert.budget.toFixed(0)} ({alert.percent.toFixed(0)}%)
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Category Progress */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Category Progress</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {categoryProgress.length === 0 ? (
                <p className="py-4 text-center text-muted-foreground">
                  No budgets set yet
                </p>
              ) : (
                categoryProgress.slice(0, 8).map((cat) => (
                  <div key={cat.id} className="flex items-center gap-3">
                    <div 
                      className="h-3 w-3 rounded-full flex-shrink-0" 
                      style={{ backgroundColor: cat.color }}
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{cat.name}</span>
                        <span className="text-muted-foreground">
                          €{cat.spent.toFixed(0)} / €{cat.budget.toFixed(0)}
                        </span>
                      </div>
                      <Progress 
                        value={Math.min(cat.percent, 100)}
                        className={`mt-1 h-2 ${
                          cat.percent >= 100 ? 'bg-destructive/20' : 
                          cat.percent >= 85 ? 'bg-amber-100' : ''
                        }`}
                      />
                    </div>
                    <Badge variant={cat.percent >= 100 ? 'destructive' : cat.percent >= 85 ? 'secondary' : 'outline'}>
                      {cat.percent.toFixed(0)}%
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

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
      ) : (
        // ========== YEARLY VIEW ==========
        <div className="space-y-6">
          <div className="text-sm text-muted-foreground">{currentYear}</div>

          {/* Annual Financial Overview */}
          <Card>
            <CardHeader>
              <CardTitle>Annual Financial Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[300px] w-full">
                <BarChart data={yearlyStats}>
                  <XAxis dataKey="month" tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={(v) => `€${v.toLocaleString()}`} tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="income" stackId="a" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="fixed" stackId="b" fill="hsl(var(--chart-2))" />
                  <Bar dataKey="variable" stackId="b" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Savings Trend */}
            <Card>
              <CardHeader>
                <CardTitle>Monthly Savings</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[200px] w-full">
                  <AreaChart data={yearlyStats}>
                    <XAxis dataKey="month" tickLine={false} axisLine={false} />
                    <YAxis tickFormatter={(v) => `€${v}`} tickLine={false} axisLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area 
                      type="monotone" 
                      dataKey="savings" 
                      stroke="hsl(var(--chart-4))" 
                      fill="hsl(var(--chart-4))" 
                      fillOpacity={0.3}
                    />
                  </AreaChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Category Stability */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Category Stability
                  <Badge variant="outline" className="text-xs font-normal">Volatility</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {categoryStability.length === 0 ? (
                  <p className="py-4 text-center text-muted-foreground">
                    Not enough data yet
                  </p>
                ) : (
                  categoryStability.slice(0, 5).map((cat) => (
                    <div key={cat.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div 
                          className="h-3 w-3 rounded-full" 
                          style={{ backgroundColor: cat.color }}
                        />
                        <span className="font-medium">{cat.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          Avg: €{cat.avg.toFixed(0)}
                        </span>
                        <Badge variant={cat.isVolatile ? 'destructive' : 'secondary'}>
                          {cat.isVolatile ? 'Volatile' : 'Stable'}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* Investment Evolution */}
          {investments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Net Worth Evolution</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[300px] w-full">
                  <AreaChart data={investmentEvolution}>
                    <XAxis dataKey="month" tickLine={false} axisLine={false} />
                    <YAxis tickFormatter={(v) => `€${v.toLocaleString()}`} tickLine={false} axisLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area 
                      type="monotone" 
                      dataKey="investments" 
                      stackId="1" 
                      stroke="hsl(var(--chart-1))" 
                      fill="hsl(var(--chart-1))" 
                      fillOpacity={0.6}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="emergency" 
                      stackId="1" 
                      stroke="hsl(var(--chart-2))" 
                      fill="hsl(var(--chart-2))" 
                      fillOpacity={0.6}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="current" 
                      stackId="1" 
                      stroke="hsl(var(--chart-3))" 
                      fill="hsl(var(--chart-3))" 
                      fillOpacity={0.6}
                    />
                  </AreaChart>
                </ChartContainer>
              </CardContent>
            </Card>
          )}

          {/* Yearly Summary Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Income ({currentYear})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  €{yearlyStats.reduce((sum, m) => sum + m.income, 0).toLocaleString()}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Expenses ({currentYear})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  €{yearlyStats.reduce((sum, m) => sum + m.fixed + m.variable, 0).toLocaleString()}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Savings ({currentYear})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${
                  yearlyStats.reduce((sum, m) => sum + m.savings, 0) >= 0 
                    ? 'text-emerald-600' 
                    : 'text-destructive'
                }`}>
                  €{yearlyStats.reduce((sum, m) => sum + m.savings, 0).toLocaleString()}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Net Worth
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  €{investmentValue.toLocaleString()}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
