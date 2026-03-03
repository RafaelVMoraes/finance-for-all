import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Search, Filter, Calendar as CalendarIcon, Check, AlertCircle, Pencil, X, Plus, Trash2, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format, endOfMonth, isBefore, isSameDay, parseISO, startOfMonth } from 'date-fns';
import { useTransactions, type TransactionFilters } from '@/hooks/useTransactions';
import { useCategories } from '@/hooks/useCategories';
import { useToast } from '@/hooks/use-toast';
import { useUserSettings } from '@/hooks/useUserSettings';
import { APP_START_DATE, APP_START_DATE_STRING } from '@/constants/app';
import { cn } from '@/lib/utils';
import { getCategoryIcon } from '@/lib/categoryIcons';
import { useIsMobile } from '@/hooks/use-mobile';

export default function Transactions() {
  const isMobile = useIsMobile();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [completionFilter, setCompletionFilter] = useState<'all' | 'complete' | 'incomplete'>('all');
  const [dateFrom, setDateFrom] = useState<Date>(() => {
    const start = startOfMonth(new Date());
    return isBefore(start, APP_START_DATE) ? APP_START_DATE : start;
  });
  const [dateTo, setDateTo] = useState<Date>(endOfMonth(new Date()));
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editCategoryId, setEditCategoryId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newDate, setNewDate] = useState<Date | undefined>(new Date());
  const [newLabel, setNewLabel] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newCategoryId, setNewCategoryId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { toast } = useToast();
  const { currencySymbol } = useUserSettings();

  const filters: TransactionFilters = useMemo(() => ({
    categoryId: categoryFilter !== 'all' ? categoryFilter : undefined,
    dateFrom,
    dateTo,
    completionStatus: completionFilter,
    minAmount: minAmount ? parseFloat(minAmount) : undefined,
    maxAmount: maxAmount ? parseFloat(maxAmount) : undefined,
  }), [categoryFilter, completionFilter, dateFrom, dateTo, minAmount, maxAmount]);

  const { transactions, loading, completeCount, incompleteCount, createTransaction, updateTransaction, deleteTransaction } = useTransactions(filters);
  const { activeCategories } = useCategories();

  const filteredTransactions = useMemo(() => {
    if (!searchTerm) return transactions;
    const term = searchTerm.toLowerCase();
    return transactions.filter((tx) => {
      const label = tx.edited_label || tx.original_label;
      return label.toLowerCase().includes(term) || tx.categories?.name?.toLowerCase().includes(term);
    });
  }, [transactions, searchTerm]);

  const groupedByDate = useMemo(() => {
    const groups: Record<string, typeof filteredTransactions> = {};
    filteredTransactions.forEach((tx) => {
      if (!groups[tx.payment_date]) groups[tx.payment_date] = [];
      groups[tx.payment_date].push(tx);
    });
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [filteredTransactions]);

  const completionRate = transactions.length > 0 ? Math.round((completeCount / transactions.length) * 100) : 0;

  const quickSetCategory = async (txId: string, categoryId: string) => {
    const result = await updateTransaction(txId, { category_id: categoryId });
    if (result.error) toast({ variant: 'destructive', title: 'Failed to set category', description: result.error });
  };

  const startEdit = (tx: (typeof transactions)[0]) => {
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
    const tx = transactions.find((t) => t.id === id);
    if (!tx) return;
    const updates: { edited_label?: string | null; category_id?: string | null } = {};
    updates.edited_label = editLabel !== tx.original_label ? editLabel : null;
    if (editCategoryId !== tx.category_id) updates.category_id = editCategoryId;
    const result = await updateTransaction(id, updates);
    if (result.error) {
      toast({ variant: 'destructive', title: 'Failed to update', description: result.error });
      return;
    }
    cancelEdit();
  };

  const handleAddTransaction = async () => {
    if (!newDate || !newLabel.trim() || !newAmount) {
      toast({ variant: 'destructive', title: 'Missing fields', description: 'Please fill in date, label, and amount' });
      return;
    }
    const amount = parseFloat(newAmount);
    if (Number.isNaN(amount)) {
      toast({ variant: 'destructive', title: 'Invalid amount', description: 'Please enter a valid number' });
      return;
    }
    const result = await createTransaction({ payment_date: format(newDate, 'yyyy-MM-dd'), label: newLabel.trim(), amount, category_id: newCategoryId });
    if (result.error) {
      toast({ variant: 'destructive', title: 'Failed to add transaction', description: result.error });
      return;
    }
    setNewDate(new Date());
    setNewLabel('');
    setNewAmount('');
    setNewCategoryId(null);
    setShowAddModal(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const result = await deleteTransaction(deleteId);
    if (result.error) toast({ variant: 'destructive', title: 'Failed to delete', description: result.error });
    setDeleteId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-bold sm:text-3xl">Transactions</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={incompleteCount > 0 ? 'destructive' : 'default'}>{completionRate}% Complete</Badge>
          <Button onClick={() => setShowAddModal(true)}><Plus className="mr-2 h-4 w-4" />Add</Button>
          <Button variant="outline" asChild><Link to="/import">Import</Link></Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search transactions" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
            </div>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full"><Filter className="mr-2 h-4 w-4" /><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent className="max-w-[90vw]">
                <SelectItem value="all">All Categories</SelectItem>
                {activeCategories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={completionFilter} onValueChange={(v) => setCompletionFilter(v as typeof completionFilter)}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="complete">Complete</SelectItem>
                <SelectItem value="incomplete">Incomplete</SelectItem>
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start overflow-hidden text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  <span className="truncate">{format(dateFrom, 'MMM dd')} - {format(dateTo, 'MMM dd')}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto max-w-[95vw] p-0" align="start">
                <Calendar
                  mode="range"
                  selected={{ from: dateFrom, to: dateTo }}
                  onSelect={(range) => {
                    if (range?.from) setDateFrom(isBefore(range.from, APP_START_DATE) ? APP_START_DATE : range.from);
                    if (range?.to) setDateTo(range.to);
                  }}
                  disabled={(date) => isBefore(date, APP_START_DATE)}
                  numberOfMonths={isMobile ? 1 : 2}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-2"><Label className="text-sm">Min {currencySymbol}</Label><Input type="number" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} /></div>
            <div className="flex items-center gap-2"><Label className="text-sm">Max {currencySymbol}</Label><Input type="number" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} /></div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Transactions ({filteredTransactions.length})</CardTitle></CardHeader>
        <CardContent>
          {loading ? <div className="py-10 text-center text-muted-foreground">Loading...</div> : groupedByDate.length === 0 ? <div className="py-10 text-center text-muted-foreground">No transactions found.</div> : (
            <div className="space-y-5">
              {groupedByDate.map(([date, items]) => (
                <div key={date} className="space-y-2">
                  <h3 className="text-lg font-semibold">
                    {isSameDay(parseISO(date), new Date()) ? "Aujourd'hui" : format(parseISO(date), 'MMMM dd, yyyy')}
                  </h3>
                  <div className="space-y-2">
                    {items.map((tx) => {
                      const isEditing = editingId === tx.id;
                      const displayLabel = tx.edited_label || tx.original_label;
                      const Icon = getCategoryIcon(tx.categories?.icon);
                      return (
                        <Card key={tx.id} className={cn('border', !tx.category_id && 'border-amber-300')}>
                          <CardContent className="p-3">
                            {isEditing ? (
                              <div className="space-y-2">
                                <Input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} />
                                <Select value={editCategoryId || '__none__'} onValueChange={(v) => setEditCategoryId(v === '__none__' ? null : v)}>
                                  <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
                                  <SelectContent className="max-w-[90vw]">
                                    <SelectItem value="__none__">None</SelectItem>
                                    {activeCategories.map((cat) => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                                <div className="flex justify-end gap-1">
                                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => saveEdit(tx.id)}><Check className="h-4 w-4" /></Button>
                                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={cancelEdit}><X className="h-4 w-4" /></Button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: `${tx.categories?.color || '#64748b'}22`, color: tx.categories?.color || '#64748b' }}>
                                  <Icon className="h-5 w-5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-lg font-semibold">{displayLabel}</p>
                                  <p className="truncate text-sm text-muted-foreground">{tx.categories?.name || 'Uncategorized'}</p>
                                </div>
                                <div className="text-right">
                                  <p className={cn('text-2xl font-semibold', tx.amount > 0 ? 'text-emerald-600' : 'text-foreground')}>
                                    {tx.amount > 0 ? '+' : '-'}{Math.abs(tx.amount).toFixed(2)} {currencySymbol}
                                  </p>
                                  <div className="mt-1 flex justify-end gap-1">
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(tx)}><Pencil className="h-4 w-4" /></Button>
                                    {!tx.category_id && (
                                      <Select onValueChange={(v) => quickSetCategory(tx.id, v)}>
                                        <SelectTrigger className="h-7 w-32 text-xs"><SelectValue placeholder="Set" /></SelectTrigger>
                                        <SelectContent className="max-w-[90vw]">{activeCategories.map((cat) => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}</SelectContent>
                                      </Select>
                                    )}
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(tx.id)}><Trash2 className="h-4 w-4" /></Button>
                                    <ChevronRight className="h-4 w-4 self-center text-muted-foreground" />
                                  </div>
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Transaction</DialogTitle></DialogHeader>
          <div className="space-y-3 py-3">
            <div className="space-y-2">
              <Label>Date</Label>
              <Popover>
                <PopoverTrigger asChild><Button variant="outline" className="w-full justify-start text-left font-normal"><CalendarIcon className="mr-2 h-4 w-4" />{newDate ? format(newDate, 'PPP') : 'Pick a date'}</Button></PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={newDate} onSelect={setNewDate} disabled={(date) => isBefore(date, APP_START_DATE) || date > new Date()} initialFocus /></PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground">Only dates from {APP_START_DATE_STRING} onwards.</p>
            </div>
            <div className="space-y-2"><Label>Label</Label><Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} /></div>
            <div className="space-y-2"><Label>Amount ({currencySymbol})</Label><Input type="number" step="0.01" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} /></div>
            <div className="space-y-2">
              <Label>Category (optional)</Label>
              <Select value={newCategoryId || '__none__'} onValueChange={(v) => setNewCategoryId(v === '__none__' ? null : v)}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent className="max-w-[90vw]"><SelectItem value="__none__">None</SelectItem>{activeCategories.map((cat) => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowAddModal(false)}>Cancel</Button><Button onClick={handleAddTransaction}>Add</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Transaction</AlertDialogTitle><AlertDialogDescription>Are you sure? This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
