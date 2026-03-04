import { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { TrendingDown, TrendingUp, PiggyBank, Pencil } from "lucide-react";
import { useBudgets } from "@/hooks/useBudgets";
import { useCategories } from "@/hooks/useCategories";
import { useBudgetMonthlySummary } from "@/hooks/useBudgetMonthlySummary";
import { useUserSettings } from "@/hooks/useUserSettings";
import { format, startOfMonth } from "date-fns";
import { APP_START_DATE } from "@/constants/app";
import { Link } from "react-router-dom";
import { useI18n } from "@/i18n/I18nProvider";

export default function Budget() {
  const { t } = useI18n();
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  const { budgets, loading: budgetsLoading } = useBudgets({
    month: selectedMonth,
  });
  const { activeCategories, loading: categoriesLoading } = useCategories();
  const {
    categorySpent,
    actualIncome,
    loading: summaryLoading,
  } = useBudgetMonthlySummary(selectedMonth);
  const { currencySymbol } = useUserSettings();

  // Calculate categories by type
  const { fixedCategories, variableCategories, incomeCategories } =
    useMemo(() => {
      const fixed = activeCategories.filter((c) => c.type === "fixed");
      const variable = activeCategories.filter((c) => c.type === "variable");
      const income = activeCategories.filter((c) => c.type === "income");
      return {
        fixedCategories: fixed,
        variableCategories: variable,
        incomeCategories: income,
      };
    }, [activeCategories]);

  const getBudgetAmount = useCallback(
    (categoryId: string) => {
      const budget = budgets.find((b) => b.category_id === categoryId);
      return budget?.expected_amount || 0;
    },
    [budgets],
  );

  // Expected income is now sum of income category budgets
  const expectedIncome = useMemo(
    () =>
      incomeCategories.reduce((sum, cat) => sum + getBudgetAmount(cat.id), 0),
    [incomeCategories, getBudgetAmount],
  );

  const totalFixedBudget = useMemo(
    () =>
      fixedCategories.reduce((sum, cat) => sum + getBudgetAmount(cat.id), 0),
    [fixedCategories, getBudgetAmount],
  );
  const totalVariableBudget = useMemo(
    () =>
      variableCategories.reduce((sum, cat) => sum + getBudgetAmount(cat.id), 0),
    [variableCategories, getBudgetAmount],
  );
  const totalFixedSpent = useMemo(
    () =>
      fixedCategories.reduce(
        (sum, cat) => sum + (categorySpent[cat.id] || 0),
        0,
      ),
    [fixedCategories, categorySpent],
  );
  const totalVariableSpent = useMemo(
    () =>
      variableCategories.reduce(
        (sum, cat) => sum + (categorySpent[cat.id] || 0),
        0,
      ),
    [variableCategories, categorySpent],
  );

  const estimatedSavings =
    expectedIncome - totalFixedBudget - totalVariableBudget;
  const actualSavings = actualIncome - totalFixedSpent - totalVariableSpent;

  const getProgressColor = (spent: number, expected: number) => {
    if (expected === 0) return "bg-muted";
    const pct = (spent / expected) * 100;
    if (pct >= 100) return "bg-destructive";
    if (pct >= 85) return "bg-amber-500";
    return "bg-emerald-500";
  };

  if (budgetsLoading || categoriesLoading || summaryLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">{t("budget.loading")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Month Navigation */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button
          data-tutorial="budget-edit-categories-link"
          asChild
          className="h-10 w-full sm:w-auto"
        >
          <Link to="/categories">
            <Pencil className="mr-2 h-4 w-4" />
            {t("budget.editCategories")}
          </Link>
        </Button>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          <input
            type="month"
            value={format(selectedMonth, "yyyy-MM")}
            onChange={(e) => {
              const parsedDate = startOfMonth(
                new Date(`${e.target.value}-01T00:00:00`),
              );
              if (parsedDate >= APP_START_DATE) {
                setSelectedMonth(parsedDate);
              }
            }}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm sm:w-auto"
          />
        </div>
      </div>

      {/* Income & Savings Overview */}
      <div
        data-tutorial="budget-overview-cards"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        {/* Expected Income */}
        <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20">
          <CardHeader className="pb-1">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-300">
              <TrendingUp className="h-4 w-4" />
              {t("budget.cards.expectedIncome")}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="text-xl font-bold text-amber-700 dark:text-amber-300">
              {currencySymbol}
              {expectedIncome.toLocaleString()}
            </div>
            <p className="text-xs text-amber-600/70 dark:text-amber-400/70">
              {t("budget.cards.real")}: {currencySymbol}
              {actualIncome.toLocaleString()}
            </p>
          </CardContent>
        </Card>

        {/* Fixed Expenses */}
        <Card className="border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20">
          <CardHeader className="pb-1">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-red-700 dark:text-red-300">
              <TrendingDown className="h-4 w-4" />
              {t("budget.cards.fixedExpenses")}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="text-xl font-bold text-red-700 dark:text-red-300">
              {currencySymbol}
              {totalFixedBudget.toLocaleString()}
            </div>
            <p className="text-xs text-red-600/70 dark:text-red-400/70">
              {t("budget.cards.spent")}: {currencySymbol}
              {totalFixedSpent.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        {/* Variable Expenses */}
        <Card className="border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20">
          <CardHeader className="pb-1">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-red-700 dark:text-red-300">
              <TrendingDown className="h-4 w-4" />
              {t("budget.cards.variableExpenses")}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="text-xl font-bold text-red-700 dark:text-red-300">
              {currencySymbol}
              {totalVariableBudget.toLocaleString()}
            </div>
            <p className="text-xs text-red-600/70 dark:text-red-400/70">
              {t("budget.cards.spent")}: {currencySymbol}
              {totalVariableSpent.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        {/* Savings */}
        <Card className="border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20">
          <CardHeader className="pb-1">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
              <PiggyBank className="h-4 w-4" />
              {t("budget.cards.estimatedSavings")}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <div
              className={`text-xl font-bold ${estimatedSavings >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-destructive"}`}
            >
              {currencySymbol}
              {estimatedSavings.toLocaleString()}
            </div>
            <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70">
              {t("budget.cards.actual")}: {currencySymbol}
              {actualSavings.toFixed(2)}
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
              {t("budget.sections.fixedExpensesBudget")}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {fixedCategories.map((cat) => {
              const expected = getBudgetAmount(cat.id);
              const spent = categorySpent[cat.id] || 0;
              const percent =
                expected > 0 ? Math.min((spent / expected) * 100, 100) : 0;
              const remaining = expected - spent;

              return (
                <div
                  key={cat.id}
                  className="space-y-2 rounded-lg border p-4 min-w-0"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span className="min-w-0 break-words text-sm font-medium leading-snug">
                        {cat.name}
                      </span>
                    </div>
                    <span className="shrink-0 text-right font-medium">
                      {currencySymbol}
                      {expected.toFixed(0)}
                    </span>
                  </div>
                  {expected > 0 && (
                    <>
                      <Progress
                        value={percent}
                        className={`h-2 ${getProgressColor(spent, expected)}`}
                      />
                      <div className="flex flex-col gap-1 text-xs sm:flex-row sm:justify-between">
                        <span className="text-muted-foreground">
                          {currencySymbol}
                          {spent.toFixed(2)} {t("budget.spent")} (
                          {percent.toFixed(0)}%)
                        </span>
                        <span
                          className={
                            remaining >= 0
                              ? "text-emerald-600"
                              : "text-destructive"
                          }
                        >
                          {remaining >= 0 ? "+" : ""}
                          {currencySymbol}
                          {remaining.toFixed(2)} {t("budget.remaining")}
                        </span>
                      </div>
                    </>
                  )}
                  {expected === 0 && (
                    <p className="text-xs text-muted-foreground">
                      {t("budget.noBudgetSet")}
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
              {t("budget.sections.variableExpensesBudget")}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {variableCategories.map((cat) => {
              const expected = getBudgetAmount(cat.id);
              const spent = categorySpent[cat.id] || 0;
              const percent =
                expected > 0 ? Math.min((spent / expected) * 100, 100) : 0;
              const remaining = expected - spent;

              return (
                <div
                  key={cat.id}
                  className="space-y-2 rounded-lg border p-4 min-w-0"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span className="min-w-0 break-words text-sm font-medium leading-snug">
                        {cat.name}
                      </span>
                    </div>
                    <span className="shrink-0 text-right font-medium">
                      {currencySymbol}
                      {expected.toFixed(0)}
                    </span>
                  </div>
                  {expected > 0 && (
                    <>
                      <Progress
                        value={percent}
                        className={`h-2 ${getProgressColor(spent, expected)}`}
                      />
                      <div className="flex flex-col gap-1 text-xs sm:flex-row sm:justify-between">
                        <span className="text-muted-foreground">
                          {currencySymbol}
                          {spent.toFixed(2)} {t("budget.spent")} (
                          {percent.toFixed(0)}%)
                        </span>
                        <span
                          className={
                            remaining >= 0
                              ? "text-emerald-600"
                              : "text-destructive"
                          }
                        >
                          {remaining >= 0 ? "+" : ""}
                          {currencySymbol}
                          {remaining.toFixed(2)} {t("budget.remaining")}
                        </span>
                      </div>
                    </>
                  )}
                  {expected === 0 && (
                    <p className="text-xs text-muted-foreground">
                      {t("budget.noBudgetSet")}
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
              {t("budget.sections.expectedIncomeSources")}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {incomeCategories.map((cat) => {
              const expected = getBudgetAmount(cat.id);
              return (
                <div
                  key={cat.id}
                  className="space-y-2 rounded-lg border p-4 min-w-0"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span className="min-w-0 break-words text-sm font-medium leading-snug">
                        {cat.name}
                      </span>
                    </div>
                    <span className="shrink-0 text-right font-medium">
                      {currencySymbol}
                      {expected.toFixed(0)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("budget.includedInActualIncome")}
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
            <p className="text-muted-foreground">
              {t("budget.empty.noCategories")}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {t("budget.empty.createCategoriesFirst")}
            </p>
            <Button className="mt-4" asChild>
              <Link to="/categories">{t("budget.empty.createCategories")}</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
