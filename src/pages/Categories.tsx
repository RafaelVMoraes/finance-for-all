import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Pencil,
  Archive,
  Check,
  X,
  ArchiveRestore,
  ArrowLeft,
} from "lucide-react";
import {
  CATEGORY_ICON_LABELS,
  CATEGORY_ICON_OPTIONS,
  getCategoryIcon,
  type CategoryIconName,
} from "@/lib/categoryIcons";
import { useCategories, PRESET_COLORS, Category } from "@/hooks/useCategories";
import { useBudgets } from "@/hooks/useBudgets";
import { useUserSettings, Currency } from "@/hooks/useUserSettings";
import { useToast } from "@/hooks/use-toast";
import { CategoryType } from "@/types/finance";
import { Link } from "react-router-dom";
import { useI18n } from "@/i18n/I18nProvider";

type BudgetDistribution = "even" | "front" | "back" | "custom";

const DISTRIBUTION_OPTIONS: {
  value: BudgetDistribution;
  label: string;
  description: string;
}[] = [
  { value: "even", label: "Even", description: "Spread equally across weeks" },
  {
    value: "front",
    label: "Front-loaded",
    description: "More spending early in month",
  },
  {
    value: "back",
    label: "Back-loaded",
    description: "More spending late in month",
  },
  { value: "custom", label: "Custom", description: "Define your own pattern" },
];

export default function Categories() {
  const { t } = useI18n();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    type: "variable" as CategoryType,
    color: PRESET_COLORS[0],
    budget: 0,
    distribution: "even" as BudgetDistribution,
    icon: "shopping-basket" as CategoryIconName,
  });

  const {
    categories,
    activeCategories,
    loading: categoriesLoading,
    canAddMore,
    createCategory,
    updateCategory,
  } = useCategories();
  const { budgets, upsertBudget, loading: budgetsLoading } = useBudgets();
  const { mainCurrency, currencySymbol, updateMainCurrency } =
    useUserSettings();
  const { toast } = useToast();

  const loading = categoriesLoading || budgetsLoading;
  const archivedCategories = categories.filter((c) => c.archived);

  const getBudgetAmount = useCallback(
    (categoryId: string) => {
      const budget = budgets.find((b) => b.category_id === categoryId);
      return budget?.expected_amount || 0;
    },
    [budgets],
  );

  const getBudgetDistribution = useCallback(
    (categoryId: string): BudgetDistribution => {
      const budget = budgets.find((b) => b.category_id === categoryId);
      const distribution = (
        budget as { distribution?: BudgetDistribution } | undefined
      )?.distribution;
      return distribution || "even";
    },
    [budgets],
  );

  const handleCreateCategory = async () => {
    if (!formData.name.trim()) {
      toast({
        variant: "destructive",
        title: "Name required",
        description: "Please enter a category name",
      });
      return;
    }

    const result = await createCategory(
      formData.name,
      formData.type,
      formData.color,
      formData.icon,
    );

    if (result.error) {
      toast({
        variant: "destructive",
        title: "Failed to create category",
        description: result.error,
      });
    } else if (result.data) {
      // Set budget if provided
      if (formData.budget > 0) {
        await upsertBudget(
          result.data.id,
          formData.budget,
          formData.distribution,
        );
      }
      toast({
        title: "Category created",
        description: `${formData.name} has been added`,
      });
      setIsDialogOpen(false);
      setFormData({
        name: "",
        type: "variable",
        color: PRESET_COLORS[0],
        budget: 0,
        distribution: "even",
        icon: "shopping-basket",
      });
    }
  };

  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setFormData({
      name: cat.name,
      type: cat.type,
      color: cat.color,
      budget: getBudgetAmount(cat.id),
      distribution: getBudgetDistribution(cat.id),
      icon: (cat.icon as CategoryIconName) || "shopping-basket",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormData({
      name: "",
      type: "variable",
      color: PRESET_COLORS[0],
      budget: 0,
      distribution: "even",
      icon: "shopping-basket",
    });
  };

  const saveEdit = async (id: string) => {
    if (!formData.name.trim()) {
      toast({
        variant: "destructive",
        title: "Name required",
      });
      return;
    }

    const result = await updateCategory(id, {
      name: formData.name,
      type: formData.type,
      color: formData.color,
      icon: formData.icon,
    });

    if (result.error) {
      toast({
        variant: "destructive",
        title: "Failed to update",
        description: result.error,
      });
    } else {
      // Update budget
      await upsertBudget(id, formData.budget, formData.distribution);
      toast({ title: "Category updated" });
    }

    cancelEdit();
  };

  const toggleArchive = async (cat: Category) => {
    const result = await updateCategory(cat.id, { archived: !cat.archived });

    if (result.error) {
      toast({
        variant: "destructive",
        title: "Failed to update",
        description: result.error,
      });
    } else {
      toast({
        title: cat.archived ? "Category restored" : "Category archived",
      });
    }
  };

  const typeColors = {
    fixed: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    variable:
      "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    income:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  };

  const getNextColor = () => {
    const usedColors = new Set(activeCategories.map((c) => c.color));
    return PRESET_COLORS.find((c) => !usedColors.has(c)) || PRESET_COLORS[0];
  };

  const openCreateDialog = () => {
    setFormData({
      name: "",
      type: "variable",
      color: getNextColor(),
      budget: 0,
      distribution: "even",
      icon: "shopping-basket",
    });
    setIsDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">{t("categories.loading")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/budget">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <h1 className="text-xl font-bold text-foreground sm:text-2xl lg:text-3xl">
                {t("categories.title")}
              </h1>
              <Select
                value={mainCurrency}
                onValueChange={(v: string) => updateMainCurrency(v as Currency)}
              >
                <SelectTrigger className="h-9 w-[138px] text-xs sm:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EUR">€ EUR</SelectItem>
                  <SelectItem value="BRL">R$ BRL</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-sm text-muted-foreground">
              {t("categories.categoriesUsed", {
                used: activeCategories.length,
                total: 15,
              })}
            </p>
          </div>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={openCreateDialog}
              disabled={!canAddMore}
              className="w-full md:w-auto"
            >
              <Plus className="mr-2 h-4 w-4" />
              New Category
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Category</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="e.g., Groceries"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value: CategoryType) =>
                    setFormData({ ...formData, type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Fixed Expense</SelectItem>
                    <SelectItem value="variable">Variable Expense</SelectItem>
                    <SelectItem value="income">Income</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFormData({ ...formData, color })}
                      className={`h-8 w-8 rounded-full border-2 transition-all ${
                        formData.color === color
                          ? "border-foreground scale-110"
                          : "border-transparent hover:scale-105"
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Icon</Label>
                <Select
                  value={formData.icon}
                  onValueChange={(value: CategoryIconName) =>
                    setFormData({ ...formData, icon: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_ICON_OPTIONS.map((iconName) => {
                      const Icon = getCategoryIcon(iconName);
                      return (
                        <SelectItem key={iconName} value={iconName}>
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            {CATEGORY_ICON_LABELS[iconName]}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="budget">Monthly Budget</Label>
                <Input
                  id="budget"
                  type="number"
                  value={formData.budget}
                  onChange={(e) =>
                    setFormData({ ...formData, budget: Number(e.target.value) })
                  }
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label>Weekly Distribution</Label>
                <Select
                  value={formData.distribution}
                  onValueChange={(value: BudgetDistribution) =>
                    setFormData({ ...formData, distribution: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DISTRIBUTION_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        <div>
                          <span className="font-medium">{opt.label}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            - {opt.description}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={handleCreateCategory}>
                Create Category
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {!canAddMore && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-900 dark:bg-amber-950">
          <p className="font-medium text-amber-800 dark:text-amber-200">
            Maximum categories reached
          </p>
          <p className="text-amber-700 dark:text-amber-300">
            You can have up to 15 active categories. Archive unused ones to add
            more.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {activeCategories.map((cat) => {
          const isEditing = editingId === cat.id;
          const budgetAmount = getBudgetAmount(cat.id);
          const distribution = getBudgetDistribution(cat.id);

          return (
            <Card key={cat.id} className="relative">
              <CardHeader className="pb-2">
                {isEditing ? (
                  <div className="space-y-3">
                    <textarea
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      className="min-h-[64px] w-full resize-y rounded-md border bg-background px-3 py-2 text-sm font-medium leading-snug"
                    />
                    <Select
                      value={formData.type}
                      onValueChange={(v: CategoryType) =>
                        setFormData({ ...formData, type: v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixed">Fixed</SelectItem>
                        <SelectItem value="variable">Variable</SelectItem>
                        <SelectItem value="income">Income</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="flex flex-wrap gap-1">
                      {PRESET_COLORS.slice(0, 8).map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setFormData({ ...formData, color })}
                          className={`h-6 w-6 rounded-full border-2 ${
                            formData.color === color
                              ? "border-foreground"
                              : "border-transparent"
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                    <Select
                      value={formData.icon}
                      onValueChange={(value: CategoryIconName) =>
                        setFormData({ ...formData, icon: value })
                      }
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORY_ICON_OPTIONS.map((iconName) => {
                          const Icon = getCategoryIcon(iconName);
                          return (
                            <SelectItem key={iconName} value={iconName}>
                              <div className="flex items-center gap-2">
                                <Icon className="h-4 w-4" />
                                {CATEGORY_ICON_LABELS[iconName]}
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    <div className="space-y-1">
                      <Label className="text-xs">
                        Budget ({currencySymbol})
                      </Label>
                      <Input
                        type="number"
                        value={formData.budget}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            budget: Number(e.target.value),
                          })
                        }
                        className="h-8"
                      />
                    </div>
                    <Select
                      value={formData.distribution}
                      onValueChange={(v: BudgetDistribution) =>
                        setFormData({ ...formData, distribution: v })
                      }
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DISTRIBUTION_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-full"
                      style={{
                        backgroundColor: `${cat.color}20`,
                        color: cat.color,
                      }}
                    >
                      {(() => {
                        const Icon = getCategoryIcon(cat.icon);
                        return <Icon className="h-4 w-4" />;
                      })()}
                    </div>
                    <CardTitle className="text-sm leading-snug break-words whitespace-normal">
                      {cat.name}
                    </CardTitle>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                {!isEditing && (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <Badge className={typeColors[cat.type]}>{cat.type}</Badge>
                      <span className="text-sm font-medium">
                        {currencySymbol}
                        {budgetAmount.toLocaleString()}/mo
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t("categories.distribution")}:{" "}
                      {DISTRIBUTION_OPTIONS.find(
                        (d) => d.value === distribution,
                      )?.label || t("categories.even")}
                    </p>
                  </>
                )}
                <div className="mt-2 flex gap-1 justify-end">
                  {isEditing ? (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => saveEdit(cat.id)}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={cancelEdit}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => startEdit(cat)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => toggleArchive(cat)}
                      >
                        <Archive className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Archived Categories */}
      {archivedCategories.length > 0 && (
        <div className="space-y-4">
          <Button
            variant="ghost"
            onClick={() => setShowArchived(!showArchived)}
            className="text-muted-foreground"
          >
            {showArchived ? "Hide" : "Show"} Archived (
            {archivedCategories.length})
          </Button>

          {showArchived && (
            <div className="grid grid-cols-2 gap-3 opacity-60 lg:grid-cols-3">
              {archivedCategories.map((cat) => (
                <Card key={cat.id} className="relative">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-8 w-8 items-center justify-center rounded-full"
                        style={{
                          backgroundColor: `${cat.color}20`,
                          color: cat.color,
                        }}
                      >
                        {(() => {
                          const Icon = getCategoryIcon(cat.icon);
                          return <Icon className="h-4 w-4" />;
                        })()}
                      </div>
                      <CardTitle className="text-lg line-through">
                        {cat.name}
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <Badge variant="secondary">Archived</Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => toggleArchive(cat)}
                      >
                        <ArchiveRestore className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {activeCategories.length === 0 && !loading && (
        <div className="py-12 text-center">
          <p className="text-muted-foreground">No categories yet.</p>
          <Button className="mt-4" onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Create your first category
          </Button>
        </div>
      )}
    </div>
  );
}
