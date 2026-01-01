import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Pencil, Check } from 'lucide-react';

export default function Budget() {
  const [editingIncome, setEditingIncome] = useState(false);
  const [expectedIncome, setExpectedIncome] = useState(5000);
  const [tempIncome, setTempIncome] = useState(expectedIncome);

  // Placeholder data
  const budgetItems = [
    { categoryId: '1', category: 'Housing', expected: 1200, spent: 1200, type: 'fixed', color: '#6366f1' },
    { categoryId: '2', category: 'Utilities', expected: 150, spent: 89.99, type: 'fixed', color: '#8b5cf6' },
    { categoryId: '3', category: 'Food', expected: 400, spent: 340, type: 'variable', color: '#ec4899' },
    { categoryId: '4', category: 'Transport', expected: 200, spent: 145, type: 'variable', color: '#f59e0b' },
    { categoryId: '5', category: 'Entertainment', expected: 150, spent: 80, type: 'variable', color: '#10b981' },
  ];

  const totalExpected = budgetItems.reduce((sum, item) => sum + item.expected, 0);
  const totalSpent = budgetItems.reduce((sum, item) => sum + item.spent, 0);
  const estimatedSavings = expectedIncome - totalExpected;
  const actualSavings = expectedIncome - totalSpent;

  const handleSaveIncome = () => {
    setExpectedIncome(tempIncome);
    setEditingIncome(false);
  };

  const getStatusColor = (spent: number, expected: number) => {
    const percent = (spent / expected) * 100;
    if (percent >= 100) return 'text-destructive';
    if (percent >= 85) return 'text-amber-500';
    return 'text-emerald-500';
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-foreground">Budget Planning</h1>

      {/* Income & Savings Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
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
                />
                <Button size="sm" onClick={handleSaveIncome}>
                  <Check className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">€{expectedIncome.toLocaleString()}</span>
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

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Planned Expenses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{totalExpected.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Spent: €{totalSpent.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Estimated Savings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              €{estimatedSavings.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Actual: €{actualSavings.toFixed(2)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Budget by Category */}
      <Card>
        <CardHeader>
          <CardTitle>Budget by Category</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {budgetItems.map((item) => {
            const percent = Math.min((item.spent / item.expected) * 100, 100);
            const difference = item.expected - item.spent;
            
            return (
              <div key={item.categoryId} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div 
                      className="h-3 w-3 rounded-full" 
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="font-medium">{item.category}</span>
                    <span className="text-xs text-muted-foreground">({item.type})</span>
                  </div>
                  <div className="text-right">
                    <span className={getStatusColor(item.spent, item.expected)}>
                      €{item.spent.toFixed(2)}
                    </span>
                    <span className="text-muted-foreground"> / €{item.expected}</span>
                  </div>
                </div>
                <Progress value={percent} className="h-2" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{percent.toFixed(0)}% used</span>
                  <span className={difference >= 0 ? 'text-emerald-500' : 'text-destructive'}>
                    {difference >= 0 ? '+' : ''}€{difference.toFixed(2)} remaining
                  </span>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
