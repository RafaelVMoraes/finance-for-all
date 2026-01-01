import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  Wallet, 
  PiggyBank,
  TrendingUp,
  AlertTriangle
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  // Placeholder data - will be replaced with real data
  const summary = {
    expectedIncome: 5000,
    actualIncome: 4800,
    totalExpenses: 3200,
    fixedExpenses: 1800,
    variableExpenses: 1400,
    estimatedSavings: 1600,
  };

  const topCategories = [
    { name: 'Housing', spent: 1200, color: 'hsl(var(--chart-1))' },
    { name: 'Food', spent: 600, color: 'hsl(var(--chart-2))' },
    { name: 'Transport', spent: 400, color: 'hsl(var(--chart-3))' },
  ];

  const alerts = [
    { category: 'Food', message: 'Close to budget limit (85%)' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <div className="text-sm text-muted-foreground">
          January 2026
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Income
            </CardTitle>
            <ArrowUpRight className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{summary.actualIncome.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              of €{summary.expectedIncome.toLocaleString()} expected
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
            <div className="text-2xl font-bold">€{summary.totalExpenses.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Fixed: €{summary.fixedExpenses} | Variable: €{summary.variableExpenses}
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
            <div className="text-2xl font-bold">€{summary.estimatedSavings.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              This month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Investments
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-chart-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€12,500</div>
            <p className="text-xs text-muted-foreground">
              Total value
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
                Alerts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {alerts.map((alert, i) => (
                <div 
                  key={i}
                  className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950"
                >
                  <div>
                    <p className="font-medium text-foreground">{alert.category}</p>
                    <p className="text-sm text-muted-foreground">{alert.message}</p>
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
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top Expenses</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {topCategories.map((cat) => (
              <div key={cat.name} className="flex items-center gap-3">
                <div 
                  className="h-3 w-3 rounded-full" 
                  style={{ backgroundColor: cat.color }}
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{cat.name}</span>
                    <span className="text-muted-foreground">€{cat.spent}</span>
                  </div>
                  <div className="mt-1 h-2 w-full rounded-full bg-muted">
                    <div 
                      className="h-2 rounded-full" 
                      style={{ 
                        width: `${(cat.spent / summary.totalExpenses) * 100}%`,
                        backgroundColor: cat.color 
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
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
            <Link to="/investments">Update Investments</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
