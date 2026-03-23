import { useState, useMemo, useCallback } from 'react';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
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
  AlertCircle
} from 'lucide-react';
import { useInvestments } from '@/hooks/useInvestments';
import { useInvestmentTypes } from '@/hooks/useInvestmentTypes';
import { useExchangeRates, Currency } from '@/hooks/useExchangeRates';
import { useUserSettings } from '@/hooks/useUserSettings';
import { useToast } from '@/hooks/use-toast';
import { format, startOfMonth, subMonths, isSameMonth } from 'date-fns';
import { APP_START_DATE } from '@/constants/app';
import {
  ChartContainer,
  ChartTooltip,
} from '@/components/ui/chart';
import { Area, AreaChart, XAxis, YAxis } from 'recharts';
import { useI18n } from '@/i18n/I18nProvider';

const currencySymbols: Record<Currency, string> = {
  EUR: '€',
  USD: '$',
  BRL: 'R$',
};

const iconMap: Record<string, React.ReactNode> = {
  'TrendingUp': <TrendingUp className="h-4 w-4" />,
  'PiggyBank': <PiggyBank className="h-4 w-4" />,
  'Landmark': <Landmark className="h-4 w-4" />,
  'Wallet': <Wallet className="h-4 w-4" />,
};

export default function Investments() {
  const { t } = useI18n();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isTypesDialogOpen, setIsTypesDialogOpen] = useState(false);
  const [isRatesDialogOpen, setIsRatesDialogOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [newInvestment, setNewInvestment] = useState({
    name: '',
    investmentType: '',
    currency: 'EUR' as Currency,
    value: 0,
    startMonth: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
  });
  const [updatingValueId, setUpdatingValueId] = useState<string | null>(null);
  const [tempValue, setTempValue] = useState(0);
  const [newTypeName, setNewTypeName] = useState('');
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [editTypeName, setEditTypeName] = useState('');
  const [rateInputs, setRateInputs] = useState<Record<string, string>>({});

  const { toast } = useToast();
  const { mainCurrency, updateMainCurrency, loading: settingsLoading } = useUserSettings();
  const { types, createType, updateType, deleteType, loading: typesLoading } = useInvestmentTypes();
  const { rates, getRate, hasRatesForMonth, upsertRate, loading: ratesLoading } = useExchangeRates();
  const { 
    investments, 
    snapshots, 
    loading: investmentsLoading, 
    createInvestment, 
    deleteInvestment, 
    addSnapshot,
  } = useInvestments();

  const loading = settingsLoading || typesLoading || ratesLoading || investmentsLoading;
  const currentMonthStr = format(startOfMonth(selectedMonth), 'yyyy-MM-dd');
  const isCurrentMonth = isSameMonth(selectedMonth, new Date());


  // Get value for an investment for a specific month
  const getValueForMonth = useCallback((investmentId: string, month: string) => {
    const snapshot = snapshots.find(s => s.investment_id === investmentId && s.month === month);
    return snapshot;
  }, [snapshots]);

  // Get previous confirmed value
  const getPreviousValue = useCallback((investmentId: string) => {
    const investment = investments.find(i => i.id === investmentId);
    const sortedSnapshots = snapshots
      .filter(s => s.investment_id === investmentId && s.month < currentMonthStr)
      .sort((a, b) => b.month.localeCompare(a.month));
    return sortedSnapshots[0]?.total_value || investment?.initial_amount || 0;
  }, [investments, snapshots, currentMonthStr]);

  // Check if investment is visible for selected month
  const isInvestmentVisibleForMonth = useCallback((investment: typeof investments[0]) => {
    const startMonth = investment.start_month || format(new Date(investment.created_at), 'yyyy-MM-dd');
    return currentMonthStr >= startMonth;
  }, [currentMonthStr]);

  const visibleInvestments = useMemo(() => 
    investments.filter(isInvestmentVisibleForMonth),
    [investments, isInvestmentVisibleForMonth]
  );

  // Convert value to main currency
  const convertToMainCurrency = useCallback((value: number, fromCurrency: Currency) => {
    const { rate } = getRate(fromCurrency, mainCurrency, selectedMonth);
    return value * rate;
  }, [getRate, mainCurrency, selectedMonth]);

  // Calculate totals by type in main currency
  const totalsByType = useMemo(() => {
    const result: Record<string, number> = {};
    types.forEach(t => result[t.name] = 0);
    
    visibleInvestments.forEach(inv => {
      const snapshot = getValueForMonth(inv.id, currentMonthStr);
      const value = snapshot?.total_value ?? getPreviousValue(inv.id);
      const convertedValue = convertToMainCurrency(value, inv.currency as Currency);
      result[inv.investment_type] = (result[inv.investment_type] || 0) + convertedValue;
    });
    
    return result;
  }, [visibleInvestments, types, getValueForMonth, getPreviousValue, convertToMainCurrency, currentMonthStr]);

  const totalValue = Object.values(totalsByType).reduce((a, b) => a + b, 0);

  // Check for unconfirmed values in current month
  const unconfirmedCount = useMemo(() => {
    if (!isCurrentMonth) return 0;
    return visibleInvestments.filter(inv => {
      const snapshot = getValueForMonth(inv.id, currentMonthStr);
      return !snapshot || !(snapshot as any).confirmed;
    }).length;
  }, [visibleInvestments, getValueForMonth, currentMonthStr, isCurrentMonth]);

  // Check if exchange rates are needed
  const needsExchangeRates = useMemo(() => {
    const currencies = new Set(visibleInvestments.map(i => i.currency));
    return currencies.size > 1 || (currencies.size === 1 && !currencies.has(mainCurrency));
  }, [visibleInvestments, mainCurrency]);

  const missingRates = needsExchangeRates && !hasRatesForMonth(selectedMonth);

  // Chart data
  const chartData = useMemo(() => {
    const months: string[] = [];
    for (let i = 11; i >= 0; i--) {
      const monthDate = subMonths(new Date(), i);
      if (monthDate >= APP_START_DATE) {
        months.push(format(startOfMonth(monthDate), 'yyyy-MM-dd'));
      }
    }

    const monthlyData = months.map(month => {
      const data: Record<string, unknown> = { month: format(new Date(month), 'MMM yyyy') };
      const typeTotals: Record<string, number> = {};
      let total = 0;

        types.forEach(type => {
          let typeTotal = 0;
          investments.forEach(inv => {
            if (inv.investment_type === type.name) {
              const startMonth = inv.start_month || format(new Date(inv.created_at), 'yyyy-MM-dd');
            if (month >= startMonth) {
              const snapshot = snapshots.find(s => s.investment_id === inv.id && s.month === month);
              const value = snapshot?.total_value || 0;
              const { rate } = getRate(inv.currency as Currency, mainCurrency, new Date(month));
              typeTotal += value * rate;
            }
          }
        });
        const key = type.name.toLowerCase().replace(/\s/g, '_');
        data[key] = typeTotal;
        typeTotals[key] = typeTotal;
        total += typeTotal;
      });

      data.total = total;
      data.typeTotals = typeTotals;
      return data as Record<string, unknown>;
    });

    const baseTotal = (monthlyData[0]?.total as number) || 0;

    return monthlyData.map((item, index) => {
      const previous = monthlyData[index - 1];
      const previousTotal = (previous?.total as number) || 0;
      const currentTotal = item.total as number;
      const monthlyPct = index === 0 || previousTotal === 0
        ? 0
        : ((currentTotal - previousTotal) / previousTotal) * 100;
      const totalPct = baseTotal === 0 ? 0 : ((currentTotal - baseTotal) / baseTotal) * 100;

      const categoryDeltas: Record<string, number> = {};
      const currentTypes = (item.typeTotals as Record<string, number>) || {};
      const previousTypes = (previous?.typeTotals as Record<string, number>) || {};
      Object.keys(currentTypes).forEach((typeKey) => {
        categoryDeltas[typeKey] = currentTypes[typeKey] - (previousTypes[typeKey] || 0);
      });

      return {
        ...item,
        totalPct,
        monthlyPct,
        categoryDeltas,
      };
    });
  }, [investments, snapshots, types, mainCurrency, getRate]);

  const formatSignedPercent = useCallback((value: number) => {
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
  }, []);

  const formatSignedCurrency = useCallback((value: number) => {
    const sign = value > 0 ? '+' : value < 0 ? '-' : '';
    return `${sign}${currencySymbols[mainCurrency]}${Math.abs(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  }, [mainCurrency]);

  const handleCreateInvestment = async () => {
    if (!newInvestment.name || !newInvestment.investmentType) {
      toast({ variant: 'destructive', title: t('investments.toasts.fillRequiredFields') });
      return;
    }

    const matchedType = types.find(t => t.name === newInvestment.investmentType);
    const result = await createInvestment(
      newInvestment.name,
      newInvestment.investmentType,
      newInvestment.currency,
      newInvestment.value,
      0,
      matchedType?.id || null,
      newInvestment.startMonth
    );

    if (result.error) {
      toast({ variant: 'destructive', title: t('investments.toasts.failedToCreate'), description: result.error });
    } else if (result.data) {
      // Add initial snapshot as confirmed for the start month
      if (newInvestment.value > 0) {
        await addSnapshot(result.data.id, newInvestment.startMonth, newInvestment.value);
      }
      toast({ title: t('investments.toasts.investmentAdded') });
      setIsDialogOpen(false);
      setNewInvestment({ 
        name: '', 
        investmentType: types[0]?.name || '', 
        currency: mainCurrency, 
        value: 0,
        startMonth: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
      });
    }
  };

  const handleDeleteInvestment = async (id: string) => {
    const result = await deleteInvestment(id);
    if (result.error) {
      toast({ variant: 'destructive', title: t('investments.toasts.failedToDelete'), description: result.error });
    } else {
      toast({ title: t('investments.toasts.investmentDeleted') });
    }
  };

  const startUpdateValue = (investmentId: string) => {
    setUpdatingValueId(investmentId);
    const snapshot = getValueForMonth(investmentId, currentMonthStr);
    setTempValue(snapshot?.total_value ?? getPreviousValue(investmentId));
  };

  const saveValue = async (confirm: boolean = true) => {
    if (!updatingValueId) return;
    const result = await addSnapshot(updatingValueId, currentMonthStr, tempValue);
    if (result.error) {
      toast({ variant: 'destructive', title: t('investments.toasts.failedToUpdate'), description: result.error });
    } else {
      toast({ title: confirm ? t('investments.toasts.valueConfirmed') : t('investments.toasts.valueSaved') });
    }
    setUpdatingValueId(null);
  };

  const confirmValue = async (investmentId: string) => {
    const snapshot = getValueForMonth(investmentId, currentMonthStr);
    const value = snapshot?.total_value ?? getPreviousValue(investmentId);
    const result = await addSnapshot(investmentId, currentMonthStr, value);
    if (result.error) {
      toast({ variant: 'destructive', title: t('investments.toasts.failedToConfirm'), description: result.error });
    } else {
      toast({ title: t('investments.toasts.valueConfirmedForMonth', { month: format(selectedMonth, 'MMMM yyyy') }) });
    }
  };

  // Investment Types management
  const handleCreateType = async () => {
    if (!newTypeName.trim()) return;
    const result = await createType(newTypeName);
    if (result.error) {
      toast({ variant: 'destructive', title: t('investments.toasts.failedToCreateType'), description: result.error });
    } else {
      toast({ title: t('investments.toasts.typeCreated') });
      setNewTypeName('');
    }
  };

  const handleUpdateType = async (id: string) => {
    if (!editTypeName.trim()) return;
    const result = await updateType(id, { name: editTypeName });
    if (result.error) {
      toast({ variant: 'destructive', title: t('investments.toasts.failedToUpdateType'), description: result.error });
    } else {
      toast({ title: t('investments.toasts.typeUpdated') });
      setEditingTypeId(null);
    }
  };

  const handleDeleteType = async (id: string) => {
    const hasInvestments = investments.some(i => types.find(t => t.id === id)?.name === i.investment_type);
    if (hasInvestments) {
      toast({ variant: 'destructive', title: t('investments.toasts.cannotDeleteType'), description: t('investments.toasts.typeHasInvestments') });
      return;
    }
    const result = await deleteType(id);
    if (result.error) {
      toast({ variant: 'destructive', title: t('investments.toasts.failedToDeleteType'), description: result.error });
    } else {
      toast({ title: t('investments.toasts.typeDeleted') });
    }
  };

  // Exchange rates management
  const handleSaveRate = async (from: Currency, to: Currency) => {
    const key = `${from}-${to}`;
    const rate = parseFloat(rateInputs[key]);
    if (isNaN(rate) || rate <= 0) {
      toast({ variant: 'destructive', title: t('investments.toasts.invalidRate') });
      return;
    }
    const result = await upsertRate(from, to, rate, selectedMonth);
    if (result.error) {
      toast({ variant: 'destructive', title: t('investments.toasts.failedToSaveRate'), description: result.error });
    } else {
      toast({ title: t('investments.toasts.exchangeRateSaved') });
    }
  };

  const getTypeColor = (typeName: string) => {
    return types.find(t => t.name === typeName)?.color || '#22c55e';
  };

  const getTypeIcon = (typeName: string) => {
    const icon = types.find(t => t.name === typeName)?.icon || 'TrendingUp';
    return iconMap[icon] || <TrendingUp className="h-4 w-4" />;
  };

  const chartConfig = useMemo(() => {
    const config: Record<string, { label: string; color: string }> = {};
    types.forEach((type) => {
      const key = type.name.toLowerCase().replace(/\s/g, '_');
      config[key] = { label: type.name, color: type.color };
    });
    return config;
  }, [types]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">{t('investments.loading')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-[calc(1rem+env(safe-area-inset-bottom))]">
      {/* Header with Currency & Settings */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">{t('investments.title')}</h1>
        <div className="grid w-full grid-cols-4 items-center gap-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-end">
          <Select data-tutorial="investments-main-currency" value={mainCurrency} onValueChange={(v) => updateMainCurrency(v as Currency)}>
            <SelectTrigger className="h-10 w-full text-xs sm:w-28 sm:text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="EUR">{t('investments.currencies.eur')}</SelectItem>
              <SelectItem value="USD">{t('investments.currencies.usd')}</SelectItem>
              <SelectItem value="BRL">{t('investments.currencies.brl')}</SelectItem>
            </SelectContent>
          </Select>
          <Dialog open={isRatesDialogOpen} onOpenChange={setIsRatesDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="h-10 min-w-0 whitespace-nowrap px-2 text-xs sm:px-4 sm:text-sm">{t('investments.rate')}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('investments.rates.dialogTitle', { month: format(selectedMonth, 'MMMM yyyy') })}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                {(['EUR', 'USD', 'BRL'] as Currency[]).filter(c => c !== mainCurrency).map(currency => {
                  const key = `${currency}-${mainCurrency}`;
                  const { rate, isFallback } = getRate(currency, mainCurrency, selectedMonth);
                  return (
                    <div key={currency} className="flex items-center gap-2">
                      <Label className="w-20">{t('investments.rates.unitLabel', { currency })}</Label>
                      <Input
                        type="number"
                        step="0.0001"
                        value={rateInputs[key] ?? rate.toFixed(4)}
                        onChange={(e) => setRateInputs({ ...rateInputs, [key]: e.target.value })}
                        className="w-28"
                      />
                      <span className="text-sm text-muted-foreground">{mainCurrency}</span>
                      <Button size="sm" onClick={() => handleSaveRate(currency, mainCurrency)}>
                        {t('common.save')}
                      </Button>
                      {isFallback && (
                        <Badge variant="outline" className="text-amber-600">{t('investments.rates.fallback')}</Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </DialogContent>
          </Dialog>
          <Dialog data-tutorial="investments-types-assets" open={isTypesDialogOpen} onOpenChange={setIsTypesDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="h-10 min-w-0 whitespace-nowrap px-2 text-xs sm:px-4 sm:text-sm">{t('investments.manageTypes')}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('investments.types.dialogTitle')}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                {types.map(type => (
                  <div key={type.id} className="flex items-center gap-2">
                    {editingTypeId === type.id ? (
                      <>
                        <Input
                          value={editTypeName}
                          onChange={(e) => setEditTypeName(e.target.value)}
                          className="flex-1"
                        />
                        <Button size="sm" variant="ghost" onClick={() => handleUpdateType(type.id)}>
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingTypeId(null)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: type.color }} />
                        <span className="flex-1">{type.name}</span>
                        <Button size="sm" variant="ghost" onClick={() => { setEditingTypeId(type.id); setEditTypeName(type.name); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDeleteType(type.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                ))}
                <div className="flex items-center gap-2 pt-2 border-t">
                  <Input
                    placeholder={t('investments.types.newTypePlaceholder')}
                    value={newTypeName}
                    onChange={(e) => setNewTypeName(e.target.value)}
                    className="flex-1"
                  />
                  <Button size="sm" onClick={handleCreateType}>
                    <Plus className="mr-1 h-4 w-4" /> {t('investments.buttons.add')}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="h-10 min-w-0 px-2 text-xs sm:px-4 sm:text-sm">
                <Plus className="mr-2 h-4 w-4" />
                {t('investments.addAsset')}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('investments.assetDialog.title')}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>{t('investments.fields.label')}</Label>
                  <Input
                    value={newInvestment.name}
                    onChange={(e) => setNewInvestment({ ...newInvestment, name: e.target.value })}
                    placeholder={t('investments.assetDialog.namePlaceholder')}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('investments.fields.type')}</Label>
                  <Select 
                    value={newInvestment.investmentType} 
                    onValueChange={(value) => setNewInvestment({ ...newInvestment, investmentType: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('investments.assetDialog.selectTypePlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {types.map(type => (
                        <SelectItem key={type.id} value={type.name}>
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: type.color }} />
                            {type.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t('investments.fields.currency')}</Label>
                    <Select 
                      value={newInvestment.currency} 
                      onValueChange={(value: Currency) => setNewInvestment({ ...newInvestment, currency: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EUR">{t('investments.currencies.eur')}</SelectItem>
                        <SelectItem value="USD">{t('investments.currencies.usd')}</SelectItem>
                        <SelectItem value="BRL">{t('investments.currencies.brl')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t('investments.fields.startMonth')}</Label>
                    <Input
                      type="month"
                      value={newInvestment.startMonth.slice(0, 7)}
                      min={format(APP_START_DATE, 'yyyy-MM')}
                      onChange={(e) => setNewInvestment({ ...newInvestment, startMonth: e.target.value + '-01' })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t('investments.fields.initialValue')}</Label>
                  <Input
                    type="number"
                    value={newInvestment.value}
                    onChange={(e) => setNewInvestment({ ...newInvestment, value: Number(e.target.value) })}
                  />
                </div>
                <Button className="w-full" onClick={handleCreateInvestment}>
                  {t('investments.addAsset')}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Exchange Rate Alert */}
      {missingRates && (
        <Alert variant="default" className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-700 dark:text-amber-300">
            {t('investments.alerts.missingRates', { month: format(selectedMonth, 'MMMM yyyy') })}{' '}
            <Button variant="link" className="p-0 h-auto" onClick={() => setIsRatesDialogOpen(true)}>
              {t('investments.alerts.updateRates')}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Unconfirmed Values Alert */}
      {isCurrentMonth && unconfirmedCount > 0 && (
        <Alert variant="default" className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-700 dark:text-red-300">
            {t('investments.alerts.unconfirmedAssets', { count: unconfirmedCount, month: format(selectedMonth, 'MMMM yyyy') })}
          </AlertDescription>
        </Alert>
      )}

      {/* Month Selector */}
      <div className="flex w-full max-w-xs items-center gap-2">
        <input
          type="month"
          value={format(selectedMonth, 'yyyy-MM')}
          min={format(APP_START_DATE, 'yyyy-MM')}
          onChange={(e) => {
            const parsedDate = startOfMonth(new Date(`${e.target.value}-01T00:00:00`));
            if (parsedDate >= APP_START_DATE) {
              setSelectedMonth(parsedDate);
            }
          }}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Wallet className="h-4 w-4" />
              {t('investments.summary.totalNetWorth')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {currencySymbols[mainCurrency]}{totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
          </CardContent>
        </Card>

        {types.slice(0, 3).map(type => (
          <Card key={type.id} style={{ borderColor: type.color + '40' }}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                {iconMap[type.icon] || <TrendingUp className="h-4 w-4" />}
                {type.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {currencySymbols[mainCurrency]}{(totalsByType[type.name] || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Evolution Chart */}
      {investments.length > 0 && chartData.some(d => (d.total as number) > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>{t('investments.chart.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <AreaChart data={chartData}>
                <XAxis dataKey="month" tickLine={false} axisLine={false} />
                <YAxis
                  yAxisId="absolute"
                  tickFormatter={(v) => `${currencySymbols[mainCurrency]}${Number(v).toLocaleString()}`}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  yAxisId="percent"
                  orientation="right"
                  tickFormatter={(v) => formatSignedPercent(Number(v))}
                  tickLine={false}
                  axisLine={false}
                />
                <ChartTooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const row = payload[0]?.payload as Record<string, unknown>;
                    const monthlyPct = Number(row.monthlyPct || 0);
                    const categoryDeltas = (row.categoryDeltas as Record<string, number>) || {};

                    return (
                      <div className="grid min-w-[14rem] gap-2 rounded-lg border border-border/50 bg-background px-3 py-2 text-xs shadow-xl">
                        <p className="font-medium">{String(label || '')}</p>
                        <p className="text-muted-foreground">
                          {t('investments.chart.monthlyChange', { percent: formatSignedPercent(monthlyPct) })}
                        </p>
                        <div className="grid gap-1">
                          {types.map((type) => {
                            const key = type.name.toLowerCase().replace(/\s/g, '_');
                            const value = categoryDeltas[key] ?? 0;
                            return (
                              <div key={key} className="flex items-center justify-between gap-3">
                                <span className="truncate text-muted-foreground">{type.name}</span>
                                <span className="font-medium">{formatSignedCurrency(value)}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }}
                />
                {types.map((type) => {
                  const key = type.name.toLowerCase().replace(/\s/g, '_');
                  return (
                    <Area 
                      key={type.id}
                      type="monotone" 
                      dataKey={key}
                      yAxisId="absolute"
                      stackId="1" 
                      stroke={type.color}
                      fill={type.color}
                      fillOpacity={0.6}
                    />
                  );
                })}
                <Area
                  type="monotone"
                  dataKey="totalPct"
                  yAxisId="percent"
                  stroke="transparent"
                  fill="transparent"
                  isAnimationActive={false}
                  legendType="none"
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Assets List */}
      <Card>
        <CardHeader>
          <CardTitle>{t('investments.assets.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          {visibleInvestments.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              {t('investments.assets.empty')}
            </p>
          ) : (
            <div className="space-y-3">
              {visibleInvestments.map((inv) => {
                const snapshot = getValueForMonth(inv.id, currentMonthStr);
                const previousValue = getPreviousValue(inv.id);
                const currentValue = snapshot?.total_value ?? previousValue;
                const isConfirmed = (snapshot as any)?.confirmed ?? false;
                const needsConfirmation = isCurrentMonth && !isConfirmed;
                const isUpdating = updatingValueId === inv.id;
                const convertedValue = convertToMainCurrency(currentValue, inv.currency as Currency);
                const color = getTypeColor(inv.investment_type);

                return (
                  <div 
                    key={inv.id}
                    className={`overflow-hidden rounded-lg border px-3 py-4 sm:p-4 ${
                      needsConfirmation ? 'border-red-300 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20' : ''
                    }`}
                    style={{
                      paddingLeft: 'calc(0.75rem + env(safe-area-inset-left))',
                      paddingRight: 'calc(0.75rem + env(safe-area-inset-right))',
                    }}
                  >
                    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="rounded-full p-2 text-white" style={{ backgroundColor: color }}>
                          {getTypeIcon(inv.investment_type)}
                        </div>
                        <div className="min-w-0">
                          <p className="break-words font-medium">{inv.name}</p>
                          <p className="text-xs text-muted-foreground">{inv.investment_type} • {inv.currency}</p>
                          {needsConfirmation && (
                            <p className="text-xs text-red-600 dark:text-red-400">
                              {t('investments.alerts.updateCurrentMonthValue')}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto sm:flex-nowrap">
                      {isUpdating ? (
                        <>
                          <Input
                            type="number"
                            value={tempValue}
                            onChange={(e) => setTempValue(Number(e.target.value))}
                            className="h-8 w-full min-w-0 flex-1 sm:w-28 sm:flex-none"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveValue(true);
                              if (e.key === 'Escape') setUpdatingValueId(null);
                            }}
                          />
                          <Button size="sm" variant="ghost" onClick={() => saveValue(true)}>
                            <Check className="h-4 w-4 text-emerald-600" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setUpdatingValueId(null)}>
                            <X className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <div className="text-right">
                            {!isConfirmed && snapshot === undefined && (
                              <p className="text-sm text-muted-foreground">
                                {currencySymbols[inv.currency as Currency]}{previousValue.toLocaleString()}
                              </p>
                            )}
                            <p className={`font-semibold ${!isConfirmed && snapshot === undefined ? 'text-muted-foreground' : ''}`}>
                              {currencySymbols[inv.currency as Currency]}{currentValue.toLocaleString()}
                            </p>
                            {inv.currency !== mainCurrency && (
                              <p className="text-xs text-muted-foreground">
                                ≈ {currencySymbols[mainCurrency]}{convertedValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                              </p>
                            )}
                          </div>
                          {needsConfirmation && (
                            <Button size="sm" variant="outline" onClick={() => confirmValue(inv.id)}>
                              <Check className="mr-1 h-4 w-4" /> {t('investments.buttons.confirm')}
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => startUpdateValue(inv.id)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDeleteInvestment(inv.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      </div>
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
