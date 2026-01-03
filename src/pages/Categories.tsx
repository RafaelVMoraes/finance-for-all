import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Archive, Check, X, ArchiveRestore } from 'lucide-react';
import { useCategories, PRESET_COLORS, Category } from '@/hooks/useCategories';
import { useToast } from '@/hooks/use-toast';
import { CategoryType } from '@/types/finance';

export default function Categories() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    type: 'variable' as CategoryType,
    color: PRESET_COLORS[0],
  });

  const { 
    categories, 
    activeCategories, 
    loading, 
    canAddMore,
    createCategory, 
    updateCategory,
    deleteCategory 
  } = useCategories();
  const { toast } = useToast();

  const archivedCategories = categories.filter(c => c.archived);

  const handleCreateCategory = async () => {
    if (!formData.name.trim()) {
      toast({
        variant: 'destructive',
        title: 'Name required',
        description: 'Please enter a category name',
      });
      return;
    }

    const result = await createCategory(formData.name, formData.type, formData.color);
    
    if (result.error) {
      toast({
        variant: 'destructive',
        title: 'Failed to create category',
        description: result.error,
      });
    } else {
      toast({
        title: 'Category created',
        description: `${formData.name} has been added`,
      });
      setIsDialogOpen(false);
      setFormData({ name: '', type: 'variable', color: PRESET_COLORS[0] });
    }
  };

  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setFormData({
      name: cat.name,
      type: cat.type,
      color: cat.color,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormData({ name: '', type: 'variable', color: PRESET_COLORS[0] });
  };

  const saveEdit = async (id: string) => {
    if (!formData.name.trim()) {
      toast({
        variant: 'destructive',
        title: 'Name required',
      });
      return;
    }

    const result = await updateCategory(id, {
      name: formData.name,
      type: formData.type,
      color: formData.color,
    });

    if (result.error) {
      toast({
        variant: 'destructive',
        title: 'Failed to update',
        description: result.error,
      });
    } else {
      toast({ title: 'Category updated' });
    }
    
    cancelEdit();
  };

  const toggleArchive = async (cat: Category) => {
    const result = await updateCategory(cat.id, { archived: !cat.archived });
    
    if (result.error) {
      toast({
        variant: 'destructive',
        title: 'Failed to update',
        description: result.error,
      });
    } else {
      toast({
        title: cat.archived ? 'Category restored' : 'Category archived',
      });
    }
  };

  const typeColors = {
    fixed: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    variable: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    income: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  };

  // Get next available color
  const getNextColor = () => {
    const usedColors = new Set(activeCategories.map(c => c.color));
    return PRESET_COLORS.find(c => !usedColors.has(c)) || PRESET_COLORS[0];
  };

  const openCreateDialog = () => {
    setFormData({
      name: '',
      type: 'variable',
      color: getNextColor(),
    });
    setIsDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">Loading categories...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Categories</h1>
          <p className="text-sm text-muted-foreground">
            {activeCategories.length}/15 categories used
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog} disabled={!canAddMore}>
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
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Groceries"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <Select 
                  value={formData.type} 
                  onValueChange={(value: CategoryType) => setFormData({ ...formData, type: value })}
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
                          ? 'border-foreground scale-110' 
                          : 'border-transparent hover:scale-105'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  <Input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="h-10 w-14 cursor-pointer p-1"
                  />
                  <Input
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    placeholder="#6366f1"
                    className="flex-1"
                  />
                </div>
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
            You can have up to 15 active categories. Archive unused ones to add more.
          </p>
        </div>
      )}

      {/* Active Categories Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {activeCategories.map((cat) => {
          const isEditing = editingId === cat.id;
          
          return (
            <Card key={cat.id} className="relative">
              <CardHeader className="pb-3">
                {isEditing ? (
                  <div className="space-y-3">
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="font-semibold"
                    />
                    <Select 
                      value={formData.type} 
                      onValueChange={(v: CategoryType) => setFormData({ ...formData, type: v })}
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
                              ? 'border-foreground' 
                              : 'border-transparent'
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div 
                      className="h-4 w-4 rounded-full flex-shrink-0" 
                      style={{ backgroundColor: cat.color }}
                    />
                    <CardTitle className="text-lg">{cat.name}</CardTitle>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  {!isEditing && (
                    <Badge className={typeColors[cat.type]}>
                      {cat.type}
                    </Badge>
                  )}
                  <div className="flex gap-1 ml-auto">
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
            {showArchived ? 'Hide' : 'Show'} Archived ({archivedCategories.length})
          </Button>
          
          {showArchived && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 opacity-60">
              {archivedCategories.map((cat) => (
                <Card key={cat.id} className="relative">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <div 
                        className="h-4 w-4 rounded-full" 
                        style={{ backgroundColor: cat.color }}
                      />
                      <CardTitle className="text-lg line-through">{cat.name}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
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
