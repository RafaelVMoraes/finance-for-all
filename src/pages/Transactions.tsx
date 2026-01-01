import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Badge } from '@/components/ui/badge';
import { Search, Filter } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Transactions() {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Placeholder data
  const transactions = [
    { id: '1', date: '2026-01-15', paymentId: 'PAY001', amount: -120.50, category: 'Food', type: 'variable' },
    { id: '2', date: '2026-01-14', paymentId: 'PAY002', amount: -1200, category: 'Housing', type: 'fixed' },
    { id: '3', date: '2026-01-13', paymentId: 'PAY003', amount: 4800, category: 'Salary', type: 'income' },
    { id: '4', date: '2026-01-12', paymentId: 'PAY004', amount: -45.00, category: 'Transport', type: 'variable' },
    { id: '5', date: '2026-01-10', paymentId: 'PAY005', amount: -89.99, category: 'Utilities', type: 'fixed' },
  ];

  const categories = ['Food', 'Housing', 'Transport', 'Utilities', 'Salary'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">Transactions</h1>
        <Button asChild>
          <Link to="/import">Import</Link>
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="flex flex-wrap gap-4 pt-6">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search transactions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[180px]">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat.toLowerCase()}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-muted-foreground">No transactions yet.</p>
              <Button className="mt-4" asChild>
                <Link to="/import">Import your first transactions</Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Payment ID</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell>{new Date(tx.date).toLocaleDateString()}</TableCell>
                    <TableCell className="font-mono text-sm">{tx.paymentId}</TableCell>
                    <TableCell>{tx.category}</TableCell>
                    <TableCell>
                      <Badge variant={
                        tx.type === 'income' ? 'default' : 
                        tx.type === 'fixed' ? 'secondary' : 'outline'
                      }>
                        {tx.type}
                      </Badge>
                    </TableCell>
                    <TableCell className={`text-right font-medium ${
                      tx.amount > 0 ? 'text-emerald-600' : 'text-foreground'
                    }`}>
                      {tx.amount > 0 ? '+' : ''}€{Math.abs(tx.amount).toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
