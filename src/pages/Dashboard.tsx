import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { useMonthlySummary, useYearlySummary, useInvestmentSummary } from '@/hooks/useDashboardData';
import { format, subMonths } from 'date-fns';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, AreaChart, Area } from 'recharts';

export default function Dashboard() {
  const [view, setView] = useState<'monthly' | 'yearly'>('monthly');
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();

  // Use optimized RPC-based hooks - single query per widget
  const { data: monthlySummary, loading: monthlyLoading, error: monthlyError } = useMonthlySummary(currentDate);
  const { data: yearlySummary, loading: yearlyLoading, error: yearlyError } = useYearlySummary(currentYear);
  const { data: investmentSummary, loading: investmentLoading } = useInvestmentSummary();
  const { monthlySettings, budgets, loading: budgetsLoading } = useBudgets();

  // Compute budget amounts from budgets (already loaded)
  const getBudgetAmount = (categoryId: string) => {
    const budget = budgets.find(b => b.category_id === categoryId);
    return budget?.expected_amount || 0;
  };

  // Derive monthly view data from aggregated summary
  const monthlyViewData = useMemo(() => {
    if (!monthlySummary) return null;

    const categorySpending = monthlySummary.category_spending || [];
    const fixedCategories = categorySpending.filter(c => c.type === 'fixed');
    const variableCategories = categorySpending.filter(c => c.type === 'variable');
    
    const fixedExpenses = fixedCategories.reduce((sum, c) => sum + Number(c.spent), 0);
    const variableExpenses = variableCategories.reduce((sum, c) => sum + Number(c.spent), 0);
    const expectedIncome = monthlySettings?.expected_income || 0;
    const actualIncome = monthlySummary.total_income;
    const totalExpenses = monthlySummary.total_expenses;
    const actualSavings = actualIncome - totalExpenses;

    const totalBudgetedFixed = fixedCategories.reduce((sum, cat) => sum + getBudgetAmount(cat.id), 0);
    const totalBudgetedVariable = variableCategories.reduce((sum, cat) => sum + getBudgetAmount(cat.id), 0);
    const expectedSavings = expectedIncome - totalBudgetedFixed - totalBudgetedVariable;
    const remainingBudget = expectedIncome - totalExpenses;

    // Category progress
    const categoryProgress = categorySpending
      .filter(c => c.type !== 'income')
      .map(cat => {
        const budget = getBudgetAmount(cat.id);
        const spent = Number(cat.spent);
        return {
          ...cat,
          spent,
          budget,
          percent: budget > 0 ? (spent / budget) * 100 : 0,
        };
      })
      .filter(c => c.budget > 0)
      .sort((a, b) => b.percent - a.percent);

    // Weekly data
    const weeklySpending = monthlySummary.weekly_spending || [];
    const weeklyData = weeklySpending.map((w, idx) => ({
      week: `Week ${idx + 1}`,
      spent: Number(w.spent),
      budget: (totalBudgetedFixed + totalBudgetedVariable) / Math.max(weeklySpending.length, 1),
    }));

    const overspendingCategories = categoryProgress.filter(c => c.percent >= 85);

    return {
      actualIncome,
      expectedIncome,
      totalExpenses,
      fixedExpenses,
      variableExpenses,
      expectedSavings,
      actualSavings,
      remainingBudget,
      transactionCount: monthlySummary.transaction_count,
      incompleteCount: monthlySummary.incomplete_count,
      categoryProgress,
      weeklyData,
      alerts: overspendingCategories.slice(0, 3),
    };
  }, [monthlySummary, monthlySettings, budgets]);

  // Derive yearly view data
  const yearlyViewData = useMemo(() => {
    if (!yearlySummary) return null;

    const monthlyData = yearlySummary.monthly_data || [];
    const yearlyStats = monthlyData.map(m => ({
      month: m.month_name,
      income: Number(m.income),
      fixed: Number(m.fixed_expenses),
      variable: Number(m.variable_expenses),
      savings: Number(m.savings),
    }));

    // Category stability calculation
    const categoryMonthly = yearlySummary.category_monthly_spending || [];
    const categoryGroups: Record<string, { spent: number[] }> = {};
    
    categoryMonthly.forEach(cm => {
      if (!categoryGroups[cm.id]) {
        categoryGroups[cm.id] = { spent: [] };
      }
      categoryGroups[cm.id].spent.push(Number(cm.spent));
    });

    const categoryStability = Object.entries(categoryGroups).map(([id, data]) => {
      const catInfo = categoryMonthly.find(cm => cm.id === id);
      const amounts = data.spent.filter(v => v > 0);
      const avg = amounts.length > 0 ? amounts.reduce((a, b) => a + b, 0) / amounts.length : 0;
      const variance = amounts.length > 1
        ? amounts.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / amounts.length
        : 0;
      const stdDev = Math.sqrt(variance);
      const cv = avg > 0 ? (stdDev / avg) * 100 : 0;

      return {
        id,
        name: catInfo?.name || '',
        color: catInfo?.color || '#6366f1',
        type: catInfo?.type || 'variable',
        avg,
        stdDev,
        cv,
        isVolatile: cv > 30,
      };
    })
    .filter(c => c.avg > 0)
    .sort((a, b) => b.cv - a.cv);

    return {
      yearlyStats,
      categoryStability,
      totalIncome: Number(yearlySummary.total_income),
      totalExpenses: Number(yearlySummary.total_expenses),
      totalSavings: Number(yearlySummary.total_income) - Number(yearlySummary.total_expenses),
    };
  }, [yearlySummary]);

  // Investment evolution data
  const investmentEvolution = useMemo(() => {
    if (!investmentSummary?.investments) return [];

    const months: string[] = [];
    for (let i = 11; i >= 0; i--) {
      months.push(format(subMonths(currentDate, i), 'yyyy-MM-dd'));
    }

    return months.map(month => {
      let investmentsTotal = 0;
      let emergencyTotal = 0;
      let currentAccountTotal = 0;

      investmentSummary.investments.forEach(inv => {
        const snapshot = inv.snapshots
          ?.filter(s => s.month <= month)
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
  }, [investmentSummary]);

  const loading = (view === 'monthly' ? monthlyLoading : yearlyLoading) || budgetsLoading;
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

  // Handle errors gracefully
  if (monthlyError || yearlyError) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-destructive">Failed to load dashboard data. Please try again.</p>
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

      {view === 'monthly' && monthlyViewData ? (
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
                <div className="text-2xl font-bold">€{monthlyViewData.actualIncome.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">
                  of €{monthlyViewData.expectedIncome.toLocaleString()} expected
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
                <div className="text-2xl font-bold">€{monthlyViewData.totalExpenses.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">
                  Fixed: €{monthlyViewData.fixedExpenses.toFixed(0)} | Variable: €{monthlyViewData.variableExpenses.toFixed(0)}
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
                <div className={`text-2xl font-bold ${monthlyViewData.expectedSavings >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                  €{monthlyViewData.expectedSavings.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  Actual: €{monthlyViewData.actualSavings.toFixed(0)}
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
                <div className={`text-2xl font-bold ${monthlyViewData.remainingBudget >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                  €{monthlyViewData.remainingBudget.toLocaleString()}
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
                <div className="text-2xl font-bold">{monthlyViewData.transactionCount}</div>
                <p className="text-xs text-muted-foreground">
                  {monthlyViewData.incompleteCount > 0 ? (
                    <span className="text-amber-600">{monthlyViewData.incompleteCount} need category</span>
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
                {monthlyViewData.weeklyData.length > 0 ? (
                  <ChartContainer config={chartConfig} className="h-[200px] w-full">
                    <BarChart data={monthlyViewData.weeklyData}>
                      <XAxis dataKey="week" tickLine={false} axisLine={false} />
                      <YAxis tickFormatter={(v) => `€${v}`} tickLine={false} axisLine={false} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="spent" fill="hsl(var(--chart-1))" radius={4} />
                      <Bar dataKey="budget" fill="hsl(var(--chart-2))" radius={4} opacity={0.3} />
                    </BarChart>
                  </ChartContainer>
                ) : (
                  <p className="py-8 text-center text-muted-foreground">No spending data yet</p>
                )}
              </CardContent>
            </Card>

            {/* Alerts */}
            {monthlyViewData.alerts.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    Budget Alerts
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {monthlyViewData.alerts.map((alert, i) => (
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
              {monthlyViewData.categoryProgress.length === 0 ? (
                <p className="py-4 text-center text-muted-foreground">
                  No budgets set yet
                </p>
              ) : (
                monthlyViewData.categoryProgress.slice(0, 8).map((cat) => (
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
      ) : view === 'yearly' && yearlyViewData ? (
        // ========== YEARLY VIEW ==========
        <div className="space-y-6">
          <div className="text-sm text-muted-foreground">{currentYear}</div>

          {/* Annual Financial Overview */}
          <Card>
            <CardHeader>
              <CardTitle>Annual Financial Overview</CardTitle>
            </CardHeader>
            <CardContent>
              {yearlyViewData.yearlyStats.length > 0 ? (
                <ChartContainer config={chartConfig} className="h-[300px] w-full">
                  <BarChart data={yearlyViewData.yearlyStats}>
                    <XAxis dataKey="month" tickLine={false} axisLine={false} />
                    <YAxis tickFormatter={(v) => `€${v.toLocaleString()}`} tickLine={false} axisLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="income" stackId="a" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="fixed" stackId="b" fill="hsl(var(--chart-2))" />
                    <Bar dataKey="variable" stackId="b" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              ) : (
                <p className="py-8 text-center text-muted-foreground">No data for this year yet</p>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Savings Trend */}
            <Card>
              <CardHeader>
                <CardTitle>Monthly Savings</CardTitle>
              </CardHeader>
              <CardContent>
                {yearlyViewData.yearlyStats.length > 0 ? (
                  <ChartContainer config={chartConfig} className="h-[200px] w-full">
                    <AreaChart data={yearlyViewData.yearlyStats}>
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
                ) : (
                  <p className="py-8 text-center text-muted-foreground">No savings data yet</p>
                )}
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
                {yearlyViewData.categoryStability.length === 0 ? (
                  <p className="py-4 text-center text-muted-foreground">
                    Not enough data yet
                  </p>
                ) : (
                  yearlyViewData.categoryStability.slice(0, 5).map((cat) => (
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
          {investmentEvolution.some(m => m.total > 0) && (
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
                  €{yearlyViewData.totalIncome.toLocaleString()}
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
                  €{yearlyViewData.totalExpenses.toLocaleString()}
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
                <div className={`text-2xl font-bold ${yearlyViewData.totalSavings >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                  €{yearlyViewData.totalSavings.toLocaleString()}
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
                  €{(investmentSummary?.total_value || 0).toLocaleString()}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        <div className="flex h-64 items-center justify-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      )}
    </div>
  );
}
