import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Upload, FileSpreadsheet, Check, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ColumnMapping {
  paymentDate: string;
  paymentId: string;
  amount: string;
  category: string;
}

export default function Import() {
  const [file, setFile] = useState<File | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({
    paymentDate: '',
    paymentId: '',
    amount: '',
    category: '',
  });
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'complete'>('upload');
  const { toast } = useToast();

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.xlsx') && !selectedFile.name.endsWith('.xls')) {
        toast({
          variant: 'destructive',
          title: 'Invalid file type',
          description: 'Please upload an Excel file (.xlsx or .xls)',
        });
        return;
      }
      
      setFile(selectedFile);
      // Simulate reading columns from file
      setColumns(['Date', 'ID', 'Amount', 'Description', 'Category', 'Notes']);
      setStep('mapping');
    }
  }, [toast]);

  const handleImport = () => {
    if (!mapping.paymentDate || !mapping.paymentId || !mapping.amount) {
      toast({
        variant: 'destructive',
        title: 'Missing required mappings',
        description: 'Please map Date, Payment ID, and Amount columns',
      });
      return;
    }
    
    // Simulate import
    toast({
      title: 'Import started',
      description: 'Processing your transactions...',
    });
    
    setTimeout(() => {
      setStep('complete');
      toast({
        title: 'Import complete!',
        description: '42 transactions imported successfully',
      });
    }, 1500);
  };

  const resetImport = () => {
    setFile(null);
    setColumns([]);
    setMapping({ paymentDate: '', paymentId: '', amount: '', category: '' });
    setStep('upload');
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-foreground">Import Transactions</h1>

      {step === 'upload' && (
        <Card>
          <CardHeader>
            <CardTitle>Upload Excel File</CardTitle>
            <CardDescription>
              Upload an .xlsx file containing your financial transactions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <label 
              htmlFor="file-upload"
              className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/50 p-12 transition-colors hover:border-primary hover:bg-muted"
            >
              <Upload className="mb-4 h-12 w-12 text-muted-foreground" />
              <span className="mb-2 text-lg font-medium">Drop your file here or click to browse</span>
              <span className="text-sm text-muted-foreground">Supports .xlsx and .xls files</span>
              <input
                id="file-upload"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </CardContent>
        </Card>
      )}

      {step === 'mapping' && file && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Map Columns
            </CardTitle>
            <CardDescription>
              File: {file.name} • Match your file columns to the required fields
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Payment Date *</Label>
                <Select value={mapping.paymentDate} onValueChange={(v) => setMapping({ ...mapping, paymentDate: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    {columns.map((col) => (
                      <SelectItem key={col} value={col}>{col}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Payment ID *</Label>
                <Select value={mapping.paymentId} onValueChange={(v) => setMapping({ ...mapping, paymentId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    {columns.map((col) => (
                      <SelectItem key={col} value={col}>{col}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Amount *</Label>
                <Select value={mapping.amount} onValueChange={(v) => setMapping({ ...mapping, amount: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    {columns.map((col) => (
                      <SelectItem key={col} value={col}>{col}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Category (optional)</Label>
                <Select value={mapping.category} onValueChange={(v) => setMapping({ ...mapping, category: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {columns.map((col) => (
                      <SelectItem key={col} value={col}>{col}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <span>Negative amounts are treated as expenses, positive as income</span>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={resetImport}>
                Cancel
              </Button>
              <Button onClick={handleImport}>
                Import Transactions
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'complete' && (
        <Card>
          <CardContent className="flex flex-col items-center py-12">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900">
              <Check className="h-8 w-8 text-emerald-600" />
            </div>
            <h2 className="mb-2 text-xl font-bold">Import Complete!</h2>
            <p className="mb-6 text-muted-foreground">42 transactions have been imported successfully</p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={resetImport}>
                Import More
              </Button>
              <Button asChild>
                <a href="/transactions">View Transactions</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
