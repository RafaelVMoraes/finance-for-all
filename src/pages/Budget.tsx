import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Pencil, Check, X, TrendingDown, TrendingUp, PiggyBank, ChevronLeft, ChevronRight } from 'lucide-react';
import { useBudgets } from '@/hooks/useBudgets';
import { useCategories } from '@/hooks/useCategories';
import { useTransactions } from '@/hooks/useTransactions';
import { useToast } from '@/hooks/use-toast';
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';

export default function Budget() {
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [editingIncome, setEditingIncome] = useState(false);
  const [tempIncome, setTempIncome] = useState(0);
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);
  const [tempBudgetAmount, setTempBudgetAmount] = useState(0);

  const { toast } = useToast();
  const { budgets, monthlySettings, loading: budgetsLoading, upsertBudget, updateExpectedIncome } = useBudgets();
  const { activeCategories, loading: categoriesLoading } = useCategories();
  const { transactions } = useTransactions({
    dateFrom: startOfMonth(selectedMonth),
    dateTo: endOfMonth(selectedMonth),
  });

  // Month navigation
  const navigateMonth = (direction: 'prev' | 'next') => {
    setSelectedMonth(prev => direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1));
  };

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

  // Calculate totals by type
  const { fixedCategories, variableCategories } = useMemo(() => {
    const fixed = activeCategories.filter(c => c.type === 'fixed');
    const variable = activeCategories.filter(c => c.type === 'variable');
    return { fixedCategories: fixed, variableCategories: variable };
  }, [activeCategories]);

  const getBudgetAmount = (categoryId: string) => {
    const budget = budgets.find(b => b.category_id === categoryId);
    return budget?.expected_amount || 0;
  };

  const expectedIncome = monthlySettings?.expected_income || 0;
  
  const totalFixedBudget = fixedCategories.reduce((sum, cat) => sum + getBudgetAmount(cat.id), 0);
  const totalVariableBudget = variableCategories.reduce((sum, cat) => sum + getBudgetAmount(cat.id), 0);
  const totalFixedSpent = fixedCategories.reduce((sum, cat) => sum + (spentByCategory[cat.id] || 0), 0);
  const totalVariableSpent = variableCategories.reduce((sum, cat) => sum + (spentByCategory[cat.id] || 0), 0);
  
  const estimatedSavings = expectedIncome - totalFixedBudget - totalVariableBudget;
  const actualSavings = expectedIncome - totalFixedSpent - totalVariableSpent;

  const handleSaveIncome = async () => {
    const result = await updateExpectedIncome(tempIncome);
    if (result.error) {
      toast({
        variant: 'destructive',
        title: 'Failed to update income',
        description: result.error,
      });
    } else {
      toast({ title: 'Expected income updated' });
    }
    setEditingIncome(false);
  };

  const startEditBudget = (categoryId: string) => {
    setEditingBudgetId(categoryId);
    setTempBudgetAmount(getBudgetAmount(categoryId));
  };

  const cancelEditBudget = () => {
    setEditingBudgetId(null);
    setTempBudgetAmount(0);
  };

  const saveBudget = async () => {
    if (!editingBudgetId) return;
    
    const result = await upsertBudget(editingBudgetId, tempBudgetAmount);
    if (result.error) {
      toast({
        variant: 'destructive',
        title: 'Failed to update budget',
        description: result.error,
      });
    } else {
      toast({ title: 'Budget updated' });
    }
    setEditingBudgetId(null);
    setTempBudgetAmount(0);
  };

  const getProgressColor = (spent: number, expected: number) => {
    if (expected === 0) return 'bg-muted';
    const percent = (spent / expected) * 100;
    if (percent >= 100) return 'bg-destructive';
    if (percent >= 85) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  const CategoryBudgetCard = ({ category }: { category: typeof activeCategories[0] }) => {
    const expected = getBudgetAmount(category.id);
    const spent = spentByCategory[category.id] || 0;
    const percent = expected > 0 ? Math.min((spent / expected) * 100, 100) : 0;
    const remaining = expected - spent;
    const isEditing = editingBudgetId === category.id;

    return (
      <div className="space-y-2 rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div 
              className="h-3 w-3 rounded-full flex-shrink-0" 
              style={{ backgroundColor: category.color }}
            />
            <span className="font-medium">{category.name}</span>
          </div>
          {isEditing ? (
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={tempBudgetAmount}
                onChange={(e) => setTempBudgetAmount(Number(e.target.value))}
                className="h-8 w-24"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveBudget();
                  if (e.key === 'Escape') cancelEditBudget();
                }}
              />
              <Button size="sm" variant="ghost" onClick={saveBudget}>
                <Check className="h-4 w-4 text-emerald-600" />
              </Button>
              <Button size="sm" variant="ghost" onClick={cancelEditBudget}>
                <X className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Budget:</span>
              <span className="font-medium">€{expected.toFixed(0)}</span>
              <Button 
                size="sm" 
                variant="ghost" 
                className="h-6 w-6 p-0"
                onClick={() => startEditBudget(category.id)}
              >
                <Pencil className="h-3 w-3" />
              </Button>
            </div>
          )}
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
            Click the pencil to set a budget
          </p>
        )}
      </div>
    );
  };

  if (budgetsLoading || categoriesLoading) {
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
        <h1 className="text-3xl font-bold text-foreground">Budget Planning</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => navigateMonth('prev')}>
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

      {/* Income & Savings Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Expected Income - Yellow/Mustard */}
        <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-300">
              <TrendingUp className="h-4 w-4" />
              Expected Income
            </CardTitle>
          </CardHeader>
          <CardContent>
            {editingIncome ? (
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={tempIncome}
                  onChange={(e) => setTempIncome(Number(e.target.value))}
                  className="h-9"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveIncome();
                    if (e.key === 'Escape') setEditingIncome(false);
                  }}
                />
                <Button size="sm" onClick={handleSaveIncome}>
                  <Check className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-amber-700 dark:text-amber-300">
                  €{expectedIncome.toLocaleString()}
                </span>
                <Button variant="ghost" size="icon" onClick={() => {
                  setTempIncome(expectedIncome);
                  setEditingIncome(true);
                }}>
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Fixed Expenses - Dark Red */}
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

        {/* Variable Expenses - Dark Red */}
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

        {/* Savings - Green */}
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
            {fixedCategories.map(cat => (
              <CategoryBudgetCard key={cat.id} category={cat} />
            ))}
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
            {variableCategories.map(cat => (
              <CategoryBudgetCard key={cat.id} category={cat} />
            ))}
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
              <a href="/categories">Create Categories</a>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
