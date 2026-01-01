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
import { Plus, TrendingUp, Wallet } from 'lucide-react';
import { Currency } from '@/types/finance';

export default function Investments() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newInvestment, setNewInvestment] = useState({
    name: '',
    investmentType: '',
    currency: 'EUR' as Currency,
    initialAmount: 0,
    monthlyContribution: 0,
  });

  // Placeholder data
  const investments = [
    { id: '1', name: 'S&P 500 ETF', type: 'ETF', currency: 'USD', initialAmount: 5000, monthlyContribution: 200, currentValue: 5800 },
    { id: '2', name: 'Emergency Fund', type: 'Savings', currency: 'EUR', initialAmount: 3000, monthlyContribution: 100, currentValue: 3200 },
    { id: '3', name: 'Bitcoin', type: 'Crypto', currency: 'EUR', initialAmount: 1000, monthlyContribution: 50, currentValue: 1500 },
    { id: '4', name: 'Real Estate Fund', type: 'REIT', currency: 'BRL', initialAmount: 10000, monthlyContribution: 0, currentValue: 11200 },
  ];

  const totalValue = investments.reduce((sum, inv) => sum + inv.currentValue, 0);
  const totalInvested = investments.reduce((sum, inv) => sum + inv.initialAmount, 0);
  const totalGain = totalValue - totalInvested;

  const currencySymbols: Record<Currency, string> = {
    EUR: '€',
    USD: '$',
    BRL: 'R$',
  };

  const handleCreateInvestment = () => {
    console.log('Creating investment:', newInvestment);
    setIsDialogOpen(false);
    setNewInvestment({
      name: '',
      investmentType: '',
      currency: 'EUR',
      initialAmount: 0,
      monthlyContribution: 0,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">Investments</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Investment
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Investment</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={newInvestment.name}
                  onChange={(e) => setNewInvestment({ ...newInvestment, name: e.target.value })}
                  placeholder="e.g., S&P 500 ETF"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <Input
                  id="type"
                  value={newInvestment.investmentType}
                  onChange={(e) => setNewInvestment({ ...newInvestment, investmentType: e.target.value })}
                  placeholder="e.g., ETF, Stocks, Crypto"
                />
              </div>
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
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="initial">Initial Amount</Label>
                  <Input
                    id="initial"
                    type="number"
                    value={newInvestment.initialAmount}
                    onChange={(e) => setNewInvestment({ ...newInvestment, initialAmount: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="monthly">Monthly Contribution</Label>
                  <Input
                    id="monthly"
                    type="number"
                    value={newInvestment.monthlyContribution}
                    onChange={(e) => setNewInvestment({ ...newInvestment, monthlyContribution: Number(e.target.value) })}
                  />
                </div>
              </div>
              <Button className="w-full" onClick={handleCreateInvestment}>
                Add Investment
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Wallet className="h-4 w-4" />
              Total Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{totalValue.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Invested
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{totalInvested.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              Total Gain/Loss
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalGain >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
              {totalGain >= 0 ? '+' : ''}€{totalGain.toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Investments List */}
      <div className="grid gap-4 md:grid-cols-2">
        {investments.map((inv) => {
          const gain = inv.currentValue - inv.initialAmount;
          const gainPercent = ((gain / inv.initialAmount) * 100).toFixed(1);
          
          return (
            <Card key={inv.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{inv.name}</CardTitle>
                  <Badge variant="secondary">{inv.type}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Current Value</span>
                  <span className="text-xl font-bold">
                    {currencySymbols[inv.currency as Currency]}{inv.currentValue.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Initial</span>
                  <span>{currencySymbols[inv.currency as Currency]}{inv.initialAmount.toLocaleString()}</span>
                </div>
                {inv.monthlyContribution > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Monthly</span>
                    <span>{currencySymbols[inv.currency as Currency]}{inv.monthlyContribution}/mo</span>
                  </div>
                )}
                <div className="flex items-center justify-between border-t border-border pt-3">
                  <span className="text-muted-foreground">Gain/Loss</span>
                  <span className={`font-medium ${gain >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                    {gain >= 0 ? '+' : ''}{currencySymbols[inv.currency as Currency]}{gain.toLocaleString()} ({gainPercent}%)
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
