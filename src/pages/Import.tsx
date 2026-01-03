import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
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
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Upload, 
  FileSpreadsheet, 
  Check, 
  AlertCircle, 
  Download, 
  Trash2,
  AlertTriangle,
  Eye,
  X
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useImport, ImportRow } from '@/hooks/useImport';
import { useCategories } from '@/hooks/useCategories';
import { format } from 'date-fns';

export default function Import() {
  const [step, setStep] = useState<'upload' | 'validation' | 'preview' | 'complete'>('upload');
  const [parsedData, setParsedData] = useState<ImportRow[]>([]);
  const [editableData, setEditableData] = useState<ImportRow[]>([]);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [reviewBatchId, setReviewBatchId] = useState<string | null>(null);
  const [batchTransactions, setBatchTransactions] = useState<any[]>([]);
  const [currentFilename, setCurrentFilename] = useState('');
  const [importResult, setImportResult] = useState({ imported: 0 });
  
  const { toast } = useToast();
  const { 
    loading, 
    importBatches, 
    parseFile, 
    checkDuplicates, 
    importTransactions, 
    fetchImportBatches,
    deleteImportBatch,
    generateTemplate 
  } = useImport();
  const { categories, activeCategories, loading: categoriesLoading } = useCategories();

  useEffect(() => {
    fetchImportBatches();
  }, [fetchImportBatches]);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
    if (!selectedFile.name.endsWith('.xlsx') && !selectedFile.name.endsWith('.xls')) {
      toast({
        variant: 'destructive',
        title: 'Invalid file type',
        description: 'Please upload an Excel file (.xlsx or .xls)',
      });
      return;
    }
    
    setCurrentFilename(selectedFile.name);
    
    try {
      const result = await parseFile(selectedFile);
      const withDuplicates = await checkDuplicates(result.rows);
      setParsedData(withDuplicates);
      setEditableData(withDuplicates);
      
      // Select all valid, non-duplicate rows by default
      const validIndices = new Set(
        withDuplicates
          .map((row, idx) => (row.isValid && !row.isDuplicate ? idx : -1))
          .filter(idx => idx >= 0)
      );
      setSelectedRows(validIndices);
      
      setStep('validation');
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Failed to parse file',
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }, [parseFile, checkDuplicates, toast]);

  const updateRow = (index: number, field: keyof ImportRow, value: any) => {
    setEditableData(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      
      // Revalidate
      const errors: string[] = [];
      if (!updated[index].date) errors.push('Invalid date');
      if (!updated[index].label) errors.push('Label is required');
      if (updated[index].value === 0 && typeof updated[index].value !== 'number') {
        errors.push('Invalid value');
      }
      
      updated[index].errors = errors;
      updated[index].isValid = errors.length === 0;
      
      return updated;
    });
  };

  const toggleRow = (index: number) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const selectAllValid = () => {
    const validIndices = editableData
      .map((row, idx) => (row.isValid ? idx : -1))
      .filter(idx => idx >= 0);
    setSelectedRows(new Set(validIndices));
  };

  const deselectAll = () => {
    setSelectedRows(new Set());
  };

  const handleImport = async () => {
    const rowsToImport = editableData.filter((_, idx) => selectedRows.has(idx) && editableData[idx].isValid);
    
    if (rowsToImport.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No rows to import',
        description: 'Please select valid rows to import',
      });
      return;
    }
    
    // Build category map
    const categoryMap: Record<string, string> = {};
    categories.forEach(cat => {
      categoryMap[cat.name.toLowerCase()] = cat.id;
    });
    
    const result = await importTransactions(rowsToImport, currentFilename, categoryMap);
    
    if (result.error) {
      toast({
        variant: 'destructive',
        title: 'Import failed',
        description: result.error,
      });
    } else {
      setImportResult({ imported: result.imported || 0 });
      setStep('complete');
      fetchImportBatches();
      toast({
        title: 'Import complete!',
        description: `${result.imported} transactions imported successfully`,
      });
    }
  };

  const resetImport = () => {
    setParsedData([]);
    setEditableData([]);
    setSelectedRows(new Set());
    setCurrentFilename('');
    setStep('upload');
  };

  const handleDeleteBatch = async (batchId: string) => {
    const result = await deleteImportBatch(batchId);
    if (result.error) {
      toast({
        variant: 'destructive',
        title: 'Failed to delete batch',
        description: result.error,
      });
    } else {
      toast({
        title: 'Batch deleted',
        description: 'All related transactions have been removed',
      });
    }
  };

  const validCount = editableData.filter(r => r.isValid).length;
  const errorCount = editableData.filter(r => !r.isValid).length;
  const duplicateCount = editableData.filter(r => r.isDuplicate).length;
  const selectedCount = selectedRows.size;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">Import Transactions</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={generateTemplate}>
            <Download className="mr-2 h-4 w-4" />
            Download Template
          </Button>
          <Button variant="outline" onClick={() => setShowHistoryModal(true)}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Import History
          </Button>
        </div>
      </div>

      {step === 'upload' && (
        <Card>
          <CardHeader>
            <CardTitle>Upload Excel File</CardTitle>
            <CardDescription>
              Upload an .xlsx file containing your financial transactions. 
              Required columns: date, label, value. Optional: category
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

      {step === 'validation' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Review & Validate Data
            </CardTitle>
            <CardDescription>
              File: {currentFilename} • {editableData.length} rows found
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Summary badges */}
            <div className="flex flex-wrap gap-2">
              <Badge variant="default" className="bg-emerald-600">
                {validCount} Valid
              </Badge>
              {errorCount > 0 && (
                <Badge variant="destructive">
                  {errorCount} Errors
                </Badge>
              )}
              {duplicateCount > 0 && (
                <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                  {duplicateCount} Duplicates
                </Badge>
              )}
              <Badge variant="outline">
                {selectedCount} Selected for import
              </Badge>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={selectAllValid}>
                Select All Valid
              </Button>
              <Button variant="outline" size="sm" onClick={deselectAll}>
                Deselect All
              </Button>
            </div>

            {/* Data table */}
            <ScrollArea className="h-[400px] rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox 
                        checked={selectedCount === validCount && validCount > 0}
                        onCheckedChange={(checked) => checked ? selectAllValid() : deselectAll()}
                      />
                    </TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Label</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Category</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {editableData.map((row, idx) => (
                    <TableRow 
                      key={idx} 
                      className={
                        row.isDuplicate ? 'bg-amber-50 dark:bg-amber-950/20' : 
                        !row.isValid ? 'bg-red-50 dark:bg-red-950/20' : ''
                      }
                    >
                      <TableCell>
                        <Checkbox 
                          checked={selectedRows.has(idx)}
                          onCheckedChange={() => toggleRow(idx)}
                          disabled={!row.isValid}
                        />
                      </TableCell>
                      <TableCell>
                        {row.isDuplicate ? (
                          <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                            <AlertTriangle className="mr-1 h-3 w-3" />
                            Duplicate
                          </Badge>
                        ) : !row.isValid ? (
                          <Badge variant="destructive">
                            <X className="mr-1 h-3 w-3" />
                            Error
                          </Badge>
                        ) : (
                          <Badge variant="default" className="bg-emerald-600">
                            <Check className="mr-1 h-3 w-3" />
                            Valid
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="date"
                          value={row.date}
                          onChange={(e) => updateRow(idx, 'date', e.target.value)}
                          className={`h-8 w-32 ${!row.date ? 'border-destructive' : ''}`}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={row.label}
                          onChange={(e) => updateRow(idx, 'label', e.target.value)}
                          className={`h-8 ${!row.label ? 'border-destructive' : ''}`}
                          placeholder="Transaction label"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          value={row.value}
                          onChange={(e) => updateRow(idx, 'value', parseFloat(e.target.value))}
                          className="h-8 w-28"
                        />
                      </TableCell>
                      <TableCell>
                        <Select 
                          value={row.category || ''} 
                          onValueChange={(v) => updateRow(idx, 'category', v || undefined)}
                        >
                          <SelectTrigger className="h-8 w-36">
                            <SelectValue placeholder="Select..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">None</SelectItem>
                            {activeCategories.map(cat => (
                              <SelectItem key={cat.id} value={cat.name}>
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
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            {/* Info box */}
            {duplicateCount > 0 && (
              <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <span>{duplicateCount} duplicate(s) detected based on date + label + value. They are deselected by default.</span>
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={resetImport}>
                Cancel
              </Button>
              <Button onClick={handleImport} disabled={selectedCount === 0 || loading}>
                {loading ? 'Importing...' : `Import ${selectedCount} Transactions`}
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
            <p className="mb-6 text-muted-foreground">{importResult.imported} transactions have been imported successfully</p>
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

      {/* Import History Modal */}
      <Dialog open={showHistoryModal} onOpenChange={setShowHistoryModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import History</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[400px]">
            {importBatches.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">No imports yet</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Filename</TableHead>
                    <TableHead>Rows</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {importBatches.map(batch => (
                    <TableRow key={batch.id}>
                      <TableCell>
                        {format(new Date(batch.imported_at), 'MMM dd, yyyy HH:mm')}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{batch.filename}</TableCell>
                      <TableCell>{batch.row_count}</TableCell>
                      <TableCell>
                        <Badge variant={batch.status === 'completed' ? 'default' : 'secondary'}>
                          {batch.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleDeleteBatch(batch.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowHistoryModal(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
