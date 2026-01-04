import { useState, useEffect, useMemo } from 'react';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Search, Filter, Calendar as CalendarIcon, Check, AlertCircle, Pencil, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTransactions, TransactionFilters } from '@/hooks/useTransactions';
import { useCategories } from '@/hooks/useCategories';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function Transactions() {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [completionFilter, setCompletionFilter] = useState<'all' | 'complete' | 'incomplete'>('all');
  const [dateFrom, setDateFrom] = useState<Date>(startOfMonth(new Date()));
  const [dateTo, setDateTo] = useState<Date>(endOfMonth(new Date()));
  const [minAmount, setMinAmount] = useState<string>('');
  const [maxAmount, setMaxAmount] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editCategoryId, setEditCategoryId] = useState<string | null>(null);
  
  const { toast } = useToast();

  const filters: TransactionFilters = useMemo(() => ({
    categoryId: categoryFilter !== 'all' ? categoryFilter : undefined,
    dateFrom,
    dateTo,
    completionStatus: completionFilter,
    minAmount: minAmount ? parseFloat(minAmount) : undefined,
    maxAmount: maxAmount ? parseFloat(maxAmount) : undefined,
  }), [categoryFilter, dateFrom, dateTo, completionFilter, minAmount, maxAmount]);

  const { 
    transactions, 
    loading, 
    completeCount, 
    incompleteCount,
    updateTransaction 
  } = useTransactions(filters);
  
  const { categories, activeCategories, loading: categoriesLoading } = useCategories();

  // Filter by search term
  const filteredTransactions = useMemo(() => {
    if (!searchTerm) return transactions;
    const term = searchTerm.toLowerCase();
    return transactions.filter(tx => {
      const label = tx.edited_label || tx.original_label;
      return label.toLowerCase().includes(term) || 
             tx.categories?.name?.toLowerCase().includes(term);
    });
  }, [transactions, searchTerm]);

  const startEdit = (tx: typeof transactions[0]) => {
    setEditingId(tx.id);
    setEditLabel(tx.edited_label || tx.original_label);
    setEditCategoryId(tx.category_id);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditLabel('');
    setEditCategoryId(null);
  };

  const saveEdit = async (id: string) => {
    const tx = transactions.find(t => t.id === id);
    if (!tx) return;
    
    const updates: { edited_label?: string; category_id?: string | null } = {};
    
    // Only set edited_label if it changed from original
    if (editLabel !== tx.original_label) {
      updates.edited_label = editLabel;
    } else {
      updates.edited_label = null; // Clear if back to original
    }
    
    if (editCategoryId !== tx.category_id) {
      updates.category_id = editCategoryId;
    }
    
    const result = await updateTransaction(id, updates);
    
    if (result.error) {
      toast({
        variant: 'destructive',
        title: 'Failed to update',
        description: result.error,
      });
    } else {
      toast({
        title: 'Transaction updated',
      });
    }
    
    cancelEdit();
  };

  const quickSetCategory = async (txId: string, categoryId: string) => {
    const result = await updateTransaction(txId, { category_id: categoryId });
    if (result.error) {
      toast({
        variant: 'destructive',
        title: 'Failed to set category',
        description: result.error,
      });
    }
  };

  const completionRate = transactions.length > 0 
    ? Math.round((completeCount / transactions.length) * 100) 
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold text-foreground">Transactions</h1>
        <div className="flex items-center gap-2">
          <Badge variant={incompleteCount > 0 ? 'destructive' : 'default'}>
            {completionRate}% Complete
          </Badge>
          <Button asChild>
            <Link to="/import">Import</Link>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search transactions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Category */}
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger>
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {activeCategories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    <div className="flex items-center gap-2">
                      <div 
                        className="h-3 w-3 rounded-full" 
                        style={{ backgroundColor: cat.color }}
                      />
                      {cat.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Completion Status */}
            <Select value={completionFilter} onValueChange={(v) => setCompletionFilter(v as typeof completionFilter)}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="complete">Complete</SelectItem>
                <SelectItem value="incomplete">Incomplete</SelectItem>
              </SelectContent>
            </Select>

            {/* Date Range */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(dateFrom, 'MMM dd')} - {format(dateTo, 'MMM dd')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={{ from: dateFrom, to: dateTo }}
                  onSelect={(range) => {
                    if (range?.from) setDateFrom(range.from);
                    if (range?.to) setDateTo(range.to);
                  }}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Amount range */}
          <div className="mt-4 flex gap-4">
            <div className="flex items-center gap-2">
              <Label className="whitespace-nowrap text-sm">Min €</Label>
              <Input
                type="number"
                value={minAmount}
                onChange={(e) => setMinAmount(e.target.value)}
                className="w-24"
                placeholder="0"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label className="whitespace-nowrap text-sm">Max €</Label>
              <Input
                type="number"
                value={maxAmount}
                onChange={(e) => setMaxAmount(e.target.value)}
                className="w-24"
                placeholder="∞"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Transactions ({filteredTransactions.length})</span>
            {incompleteCount > 0 && (
              <span className="text-sm font-normal text-destructive">
                <AlertCircle className="mr-1 inline h-4 w-4" />
                {incompleteCount} missing category
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-12 text-center text-muted-foreground">Loading...</div>
          ) : filteredTransactions.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-muted-foreground">No transactions found.</p>
              <Button className="mt-4" asChild>
                <Link to="/import">Import your first transactions</Link>
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Label</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="w-16">Status</TableHead>
                    <TableHead className="w-16">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.map((tx) => {
                    const isEditing = editingId === tx.id;
                    const displayLabel = tx.edited_label || tx.original_label;
                    const isComplete = tx.category_id !== null;
                    
                    return (
                      <TableRow key={tx.id} className={!isComplete ? 'bg-amber-50/50 dark:bg-amber-950/20' : ''}>
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(tx.payment_date), 'MMM dd, yyyy')}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <Input
                              value={editLabel}
                              onChange={(e) => setEditLabel(e.target.value)}
                              className="h-8"
                            />
                          ) : (
                            <div>
                              <span className="font-medium">{displayLabel}</span>
                              {tx.edited_label && (
                                <span className="ml-2 text-xs text-muted-foreground">
                                  (edited)
                                </span>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <Select 
                              value={editCategoryId || '__none__'} 
                              onValueChange={(v) => setEditCategoryId(v === '__none__' ? null : v)}
                            >
                              <SelectTrigger className="h-8 w-40">
                                <SelectValue placeholder="Select..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">None</SelectItem>
                                {activeCategories.map(cat => (
                                  <SelectItem key={cat.id} value={cat.id}>
                                    <div className="flex items-center gap-2">
                                      <div 
                                        className="h-3 w-3 rounded-full" 
                                        style={{ backgroundColor: cat.color }}
                                      />
                                      {cat.name}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : tx.categories ? (
                            <Badge 
                              style={{ 
                                backgroundColor: `${tx.categories.color}20`,
                                color: tx.categories.color,
                                borderColor: tx.categories.color
                              }}
                              className="border"
                            >
                              <div 
                                className="mr-1.5 h-2 w-2 rounded-full" 
                                style={{ backgroundColor: tx.categories.color }}
                              />
                              {tx.categories.name}
                            </Badge>
                          ) : (
                            <Select onValueChange={(v) => quickSetCategory(tx.id, v)}>
                              <SelectTrigger className="h-7 w-32 border-dashed text-muted-foreground">
                                <SelectValue placeholder="Set category" />
                              </SelectTrigger>
                              <SelectContent>
                                {activeCategories.map(cat => (
                                  <SelectItem key={cat.id} value={cat.id}>
                                    <div className="flex items-center gap-2">
                                      <div 
                                        className="h-3 w-3 rounded-full" 
                                        style={{ backgroundColor: cat.color }}
                                      />
                                      {cat.name}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </TableCell>
                        <TableCell className={cn(
                          "text-right font-medium whitespace-nowrap",
                          tx.amount > 0 ? 'text-emerald-600' : 'text-foreground'
                        )}>
                          {tx.amount > 0 ? '+' : ''}€{Math.abs(tx.amount).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          {isComplete ? (
                            <Check className="h-4 w-4 text-emerald-500" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-amber-500" />
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <div className="flex gap-1">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-7 w-7"
                                onClick={() => saveEdit(tx.id)}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-7 w-7"
                                onClick={cancelEdit}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-7 w-7"
                              onClick={() => startEdit(tx)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
