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
import { Plus, Pencil, Archive } from 'lucide-react';
import { CategoryType } from '@/types/finance';

export default function Categories() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newCategory, setNewCategory] = useState({
    name: '',
    type: 'variable' as CategoryType,
    color: '#6366f1',
  });

  // Placeholder data
  const categories = [
    { id: '1', name: 'Housing', type: 'fixed', color: '#6366f1', archived: false },
    { id: '2', name: 'Utilities', type: 'fixed', color: '#8b5cf6', archived: false },
    { id: '3', name: 'Food', type: 'variable', color: '#ec4899', archived: false },
    { id: '4', name: 'Transport', type: 'variable', color: '#f59e0b', archived: false },
    { id: '5', name: 'Entertainment', type: 'variable', color: '#10b981', archived: false },
    { id: '6', name: 'Salary', type: 'income', color: '#22c55e', archived: false },
  ];

  const handleCreateCategory = () => {
    console.log('Creating category:', newCategory);
    setIsDialogOpen(false);
    setNewCategory({ name: '', type: 'variable', color: '#6366f1' });
  };

  const typeColors = {
    fixed: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    variable: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    income: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">Categories</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
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
                  value={newCategory.name}
                  onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                  placeholder="e.g., Groceries"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <Select 
                  value={newCategory.type} 
                  onValueChange={(value: CategoryType) => setNewCategory({ ...newCategory, type: value })}
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
                <Label htmlFor="color">Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="color"
                    type="color"
                    value={newCategory.color}
                    onChange={(e) => setNewCategory({ ...newCategory, color: e.target.value })}
                    className="h-10 w-14 cursor-pointer p-1"
                  />
                  <Input
                    value={newCategory.color}
                    onChange={(e) => setNewCategory({ ...newCategory, color: e.target.value })}
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

      {/* Categories Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {categories.map((cat) => (
          <Card key={cat.id} className="relative">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div 
                  className="h-4 w-4 rounded-full" 
                  style={{ backgroundColor: cat.color }}
                />
                <CardTitle className="text-lg">{cat.name}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <Badge className={typeColors[cat.type as keyof typeof typeColors]}>
                  {cat.type}
                </Badge>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Archive className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
