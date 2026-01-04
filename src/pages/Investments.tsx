import { useState, useMemo } from 'react';
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
import { 
  Plus, 
  TrendingUp, 
  Wallet, 
  PiggyBank, 
  Landmark, 
  Pencil, 
  Trash2, 
  Check, 
  X,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useInvestments } from '@/hooks/useInvestments';
import { useToast } from '@/hooks/use-toast';
import { format, startOfMonth, subMonths, addMonths } from 'date-fns';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Area, AreaChart, Legend } from 'recharts';

type Currency = 'EUR' | 'USD' | 'BRL';
type InvestmentType = 'Investments' | 'Emergency savings' | 'Current account';

const INVESTMENT_TYPES: InvestmentType[] = ['Investments', 'Emergency savings', 'Current account'];

const currencySymbols: Record<Currency, string> = {
  EUR: '€',
  USD: '$',
  BRL: 'R$',
};

const typeIcons: Record<InvestmentType, React.ReactNode> = {
  'Investments': <TrendingUp className="h-4 w-4" />,
  'Emergency savings': <PiggyBank className="h-4 w-4" />,
  'Current account': <Landmark className="h-4 w-4" />,
};

const typeColors: Record<InvestmentType, string> = {
  'Investments': 'bg-emerald-500',
  'Emergency savings': 'bg-amber-500',
  'Current account': 'bg-blue-500',
};

export default function Investments() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [newInvestment, setNewInvestment] = useState({
    name: '',
    investmentType: 'Investments' as InvestmentType,
    currency: 'EUR' as Currency,
    value: 0,
  });
  const [updatingValueId, setUpdatingValueId] = useState<string | null>(null);
  const [tempValue, setTempValue] = useState(0);

  const { toast } = useToast();
  const { 
    investments, 
    snapshots, 
    loading, 
    createInvestment, 
    updateInvestment, 
    deleteInvestment, 
    addSnapshot,
    refetch 
  } = useInvestments();

  const currentMonthStr = format(startOfMonth(selectedMonth), 'yyyy-MM-dd');

  // Navigate months
  const navigateMonth = (direction: 'prev' | 'next') => {
    setSelectedMonth(prev => direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1));
  };

  // Get value for an investment for a specific month
  const getValueForMonth = (investmentId: string, month: string) => {
    const snapshot = snapshots.find(s => s.investment_id === investmentId && s.month === month);
    return snapshot?.total_value;
  };

  // Get current month value or latest snapshot
  const getCurrentValue = (investmentId: string) => {
    const investment = investments.find(i => i.id === investmentId);
    const snapshot = snapshots
      .filter(s => s.investment_id === investmentId)
      .sort((a, b) => b.month.localeCompare(a.month))[0];
    return snapshot?.total_value || investment?.initial_amount || 0;
  };

  // Calculate totals by type
  const totalsByType = useMemo(() => {
    const result: Record<InvestmentType, number> = {
      'Investments': 0,
      'Emergency savings': 0,
      'Current account': 0,
    };
    investments.forEach(inv => {
      const value = getCurrentValue(inv.id);
      const type = inv.investment_type as InvestmentType;
      if (result[type] !== undefined) {
        result[type] += value;
      }
    });
    return result;
  }, [investments, snapshots]);

  const totalValue = Object.values(totalsByType).reduce((a, b) => a + b, 0);

  // Calculate month-over-month change
  const previousMonthStr = format(subMonths(startOfMonth(selectedMonth), 1), 'yyyy-MM-dd');
  const monthlyChange = useMemo(() => {
    let currentTotal = 0;
    let previousTotal = 0;
    investments.forEach(inv => {
      currentTotal += getValueForMonth(inv.id, currentMonthStr) || 0;
      previousTotal += getValueForMonth(inv.id, previousMonthStr) || 0;
    });
    if (previousTotal === 0) return null;
    return ((currentTotal - previousTotal) / previousTotal) * 100;
  }, [investments, snapshots, currentMonthStr, previousMonthStr]);

  // Chart data - last 12 months
  const chartData = useMemo(() => {
    const months: string[] = [];
    for (let i = 11; i >= 0; i--) {
      months.push(format(subMonths(new Date(), i), 'yyyy-MM-dd'));
    }

    return months.map(month => {
      const data: Record<string, number | string> = { month: format(new Date(month), 'MMM yyyy') };
      let investmentsTotal = 0;
      let emergencyTotal = 0;
      let currentAccountTotal = 0;

      investments.forEach(inv => {
        const value = getValueForMonth(inv.id, month) || 0;
        const type = inv.investment_type as InvestmentType;
        if (type === 'Investments') investmentsTotal += value;
        else if (type === 'Emergency savings') emergencyTotal += value;
        else if (type === 'Current account') currentAccountTotal += value;
      });

      data.investments = investmentsTotal;
      data.emergency = emergencyTotal;
      data.current = currentAccountTotal;
      data.total = investmentsTotal + emergencyTotal + currentAccountTotal;

      return data;
    });
  }, [investments, snapshots]);

  const handleCreateInvestment = async () => {
    if (!newInvestment.name || !newInvestment.investmentType) {
      toast({ variant: 'destructive', title: 'Please fill all required fields' });
      return;
    }

    const result = await createInvestment(
      newInvestment.name,
      newInvestment.investmentType,
      newInvestment.currency,
      newInvestment.value,
      0
    );

    if (result.error) {
      toast({ variant: 'destructive', title: 'Failed to create', description: result.error });
    } else {
      // Add initial snapshot
      if (result.data && newInvestment.value > 0) {
        await addSnapshot(result.data.id, currentMonthStr, newInvestment.value);
      }
      toast({ title: 'Investment added' });
      setIsDialogOpen(false);
      setNewInvestment({ name: '', investmentType: 'Investments', currency: 'EUR', value: 0 });
    }
  };

  const handleDeleteInvestment = async (id: string) => {
    const result = await deleteInvestment(id);
    if (result.error) {
      toast({ variant: 'destructive', title: 'Failed to delete', description: result.error });
    } else {
      toast({ title: 'Investment deleted' });
    }
  };

  const startUpdateValue = (investmentId: string) => {
    setUpdatingValueId(investmentId);
    setTempValue(getValueForMonth(investmentId, currentMonthStr) || getCurrentValue(investmentId));
  };

  const saveValue = async () => {
    if (!updatingValueId) return;
    const result = await addSnapshot(updatingValueId, currentMonthStr, tempValue);
    if (result.error) {
      toast({ variant: 'destructive', title: 'Failed to update', description: result.error });
    } else {
      toast({ title: 'Value updated for ' + format(selectedMonth, 'MMMM yyyy') });
    }
    setUpdatingValueId(null);
  };

  const chartConfig = {
    investments: { label: 'Investments', color: 'hsl(var(--chart-1))' },
    emergency: { label: 'Emergency', color: 'hsl(var(--chart-2))' },
    current: { label: 'Current Account', color: 'hsl(var(--chart-3))' },
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">Loading investments...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">Investments</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Asset
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Asset</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Label</Label>
                <Input
                  id="name"
                  value={newInvestment.name}
                  onChange={(e) => setNewInvestment({ ...newInvestment, name: e.target.value })}
                  placeholder="e.g., S&P 500 ETF, Emergency Fund"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <Select 
                  value={newInvestment.investmentType} 
                  onValueChange={(value: InvestmentType) => setNewInvestment({ ...newInvestment, investmentType: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INVESTMENT_TYPES.map(type => (
                      <SelectItem key={type} value={type}>
                        <div className="flex items-center gap-2">
                          {typeIcons[type]}
                          {type}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Select 
                    value={newInvestment.currency} 
                    onValueChange={(value: Currency) => setNewInvestment({ ...newInvestment, currency: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EUR">EUR (€)</SelectItem>
                      <SelectItem value="USD">USD ($)</SelectItem>
                      <SelectItem value="BRL">BRL (R$)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="value">Current Value</Label>
                  <Input
                    id="value"
                    type="number"
                    value={newInvestment.value}
                    onChange={(e) => setNewInvestment({ ...newInvestment, value: Number(e.target.value) })}
                  />
                </div>
              </div>
              <Button className="w-full" onClick={handleCreateInvestment}>
                Add Asset
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Month Selector */}
      <div className="flex items-center justify-center gap-2">
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

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Wallet className="h-4 w-4" />
              Total Net Worth
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{totalValue.toLocaleString()}</div>
            {monthlyChange !== null && (
              <p className={`text-xs ${monthlyChange >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                {monthlyChange >= 0 ? '+' : ''}{monthlyChange.toFixed(1)}% vs last month
              </p>
            )}
          </CardContent>
        </Card>

        <Card className={typeColors['Investments'].replace('bg-', 'border-') + '/30'}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              Investments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{totalsByType['Investments'].toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card className={typeColors['Emergency savings'].replace('bg-', 'border-') + '/30'}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <PiggyBank className="h-4 w-4" />
              Emergency Savings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{totalsByType['Emergency savings'].toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card className={typeColors['Current account'].replace('bg-', 'border-') + '/30'}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Landmark className="h-4 w-4" />
              Current Account
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{totalsByType['Current account'].toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      {/* Evolution Chart */}
      {investments.length > 0 && chartData.some(d => (d.total as number) > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Net Worth Evolution</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <AreaChart data={chartData}>
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

      {/* Assets List */}
      <Card>
        <CardHeader>
          <CardTitle>Your Assets</CardTitle>
        </CardHeader>
        <CardContent>
          {investments.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              No assets yet. Add your first investment, savings account, or current account.
            </p>
          ) : (
            <div className="space-y-3">
              {investments.map((inv) => {
                const currentValue = getValueForMonth(inv.id, currentMonthStr) || getCurrentValue(inv.id);
                const type = inv.investment_type as InvestmentType;
                const isUpdating = updatingValueId === inv.id;

                return (
                  <div 
                    key={inv.id}
                    className="flex items-center justify-between rounded-lg border p-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`rounded-full p-2 ${typeColors[type]} text-primary-foreground`}>
                        {typeIcons[type]}
                      </div>
                      <div>
                        <p className="font-medium">{inv.name}</p>
                        <p className="text-xs text-muted-foreground">{type} • {inv.currency}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isUpdating ? (
                        <>
                          <Input
                            type="number"
                            value={tempValue}
                            onChange={(e) => setTempValue(Number(e.target.value))}
                            className="h-8 w-28"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveValue();
                              if (e.key === 'Escape') setUpdatingValueId(null);
                            }}
                          />
                          <Button size="sm" variant="ghost" onClick={saveValue}>
                            <Check className="h-4 w-4 text-emerald-600" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setUpdatingValueId(null)}>
                            <X className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <span className="text-lg font-bold">
                            {currencySymbols[inv.currency]}{currentValue.toLocaleString()}
                          </span>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-8 w-8 p-0"
                            onClick={() => startUpdateValue(inv.id)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-8 w-8 p-0 text-destructive"
                            onClick={() => handleDeleteInvestment(inv.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
