import { useState, useEffect, useCallback, useMemo } from 'react';
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { 
  Upload, 
  FileSpreadsheet, 
  Check, 
  AlertCircle, 
  Download, 
  Trash2,
  AlertTriangle,
  X,
  Plus,
  Zap,
  Sparkles,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useImport, ImportRow } from '@/hooks/useImport';
import { useImportSources } from '@/hooks/useImportSources';
import { useCategories } from '@/hooks/useCategories';
import { useImportRules } from '@/hooks/useImportRules';
import { ImportRulesManager } from '@/components/import/ImportRulesManager';
import { format } from 'date-fns';
import { APP_START_DATE_STRING } from '@/constants/app';

export default function Import() {
  const [step, setStep] = useState<'upload' | 'validation' | 'complete'>('upload');
  const [parsedData, setParsedData] = useState<ImportRow[]>([]);
  const [editableData, setEditableData] = useState<ImportRow[]>([]);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [currentFilename, setCurrentFilename] = useState('');
  const [importResult, setImportResult] = useState({ imported: 0 });
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [newSourceName, setNewSourceName] = useState('');
  const [showNewSource, setShowNewSource] = useState(false);
  const [showRulesManager, setShowRulesManager] = useState(false);
  const [rulesApplied, setRulesApplied] = useState(false);
  
  const { toast } = useToast();
  const { 
    loading, 
    importBatches, 
    parseFile, 
    checkDuplicates,
    applyRules,
    importTransactions, 
    fetchImportBatches,
    deleteImportBatch,
    generateTemplate 
  } = useImport();
  const { sources, createSource, loading: sourcesLoading } = useImportSources();
  const { categories, activeCategories, loading: categoriesLoading } = useCategories();
  const { rules, loading: rulesLoading } = useImportRules();

  // Build category maps for rule application
  const categoryIdToName = useMemo(() => {
    const map: Record<string, string> = {};
    categories.forEach(cat => {
      map[cat.id] = cat.name;
    });
    return map;
  }, [categories]);

  const categoryNameToId = useMemo(() => {
    const map: Record<string, string> = {};
    categories.forEach(cat => {
      map[cat.name.toLowerCase().trim()] = cat.id;
    });
    return map;
  }, [categories]);

  useEffect(() => {
    fetchImportBatches();
  }, [fetchImportBatches]);

  // Sort data: auto-rejected first, then duplicates, then errors, then valid
  const sortedEditableData = useMemo(() => {
    return [...editableData].sort((a, b) => {
      // Auto-rejected first (they'll be greyed out)
      if (a.autoRejected && !b.autoRejected) return -1;
      if (!a.autoRejected && b.autoRejected) return 1;
      // Database duplicates next (unless auto-accepted)
      const aDup = a.isDuplicate && !a.autoAccepted;
      const bDup = b.isDuplicate && !b.autoAccepted;
      if (aDup && !bDup) return -1;
      if (!aDup && bDup) return 1;
      // File duplicates next
      if (a.isDuplicateInFile && !b.isDuplicateInFile) return -1;
      if (!a.isDuplicateInFile && b.isDuplicateInFile) return 1;
      // Errors next
      if (!a.isValid && b.isValid) return -1;
      if (a.isValid && !b.isValid) return 1;
      return 0;
    });
  }, [editableData]);

  // Get original index for selection
  const getOriginalIndex = useCallback((sortedIndex: number) => {
    const sortedRow = sortedEditableData[sortedIndex];
    return editableData.findIndex(r => r === sortedRow);
  }, [sortedEditableData, editableData]);

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
      
      // Apply import rules automatically
      const enabledRules = rules.filter(r => r.enabled);
      let processedRows = withDuplicates;
      
      if (enabledRules.length > 0) {
        processedRows = applyRules(withDuplicates, enabledRules, categoryIdToName);
        setRulesApplied(true);
        
        // Count rule applications
        const ruleApplications = processedRows.filter(r => r.appliedRule).length;
        if (ruleApplications > 0) {
          toast({
            title: 'Rules applied',
            description: `${ruleApplications} transactions categorized automatically`,
          });
        }
      }
      
      setParsedData(processedRows);
      setEditableData(processedRows);
      
      // Select all valid, non-rejected rows by default
      const validIndices = new Set(
        processedRows
          .map((row, idx) => (
            row.isValid && 
            !row.autoRejected && 
            (!row.isDuplicate || row.autoAccepted) && 
            !row.isDuplicateInFile 
              ? idx 
              : -1
          ))
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
  }, [parseFile, checkDuplicates, applyRules, rules, categoryIdToName, toast]);

  const updateRow = (originalIndex: number, field: 'label' | 'category', value: string | undefined) => {
    setEditableData(prev => {
      const updated = [...prev];
      if (field === 'label') {
        updated[originalIndex] = { ...updated[originalIndex], label: value || '' };
      } else if (field === 'category') {
        updated[originalIndex] = { ...updated[originalIndex], category: value };
      }
      
      // Revalidate
      const row = updated[originalIndex];
      const errors: string[] = [];
      if (!row.date) errors.push('Invalid date');
      if (!row.label) errors.push('Label is required');
      
      updated[originalIndex].errors = errors;
      updated[originalIndex].isValid = errors.length === 0;
      
      return updated;
    });
  };

  const toggleRow = (originalIndex: number) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (next.has(originalIndex)) {
        next.delete(originalIndex);
      } else {
        next.add(originalIndex);
      }
      return next;
    });
  };

  const selectAllValid = () => {
    const validIndices = editableData
      .map((row, idx) => (row.isValid && !row.isDuplicate ? idx : -1))
      .filter(idx => idx >= 0);
    setSelectedRows(new Set(validIndices));
  };

  const deselectAll = () => {
    setSelectedRows(new Set());
  };

  const handleCreateSource = async () => {
    if (!newSourceName.trim()) return;
    
    const result = await createSource(newSourceName);
    if (result.error) {
      toast({
        variant: 'destructive',
        title: 'Failed to create source',
        description: result.error,
      });
    } else if (result.data) {
      setSelectedSourceId(result.data.id);
      setNewSourceName('');
      setShowNewSource(false);
    }
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
    
    // Collect applied rule IDs for stats update
    const appliedRuleIds = rowsToImport
      .filter(r => r.appliedRule)
      .map(r => r.appliedRule!.id);
    
    const result = await importTransactions(
      rowsToImport, 
      currentFilename, 
      categoryNameToId, 
      selectedSourceId,
      appliedRuleIds
    );
    
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
    setSelectedSourceId(null);
    setRulesApplied(false);
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

  const handleDownloadTemplate = () => {
    const categoryData = categories.map(c => ({
      name: c.name,
      type: c.type,
      color: c.color,
    }));
    generateTemplate(categoryData);
  };

  const validCount = editableData.filter(r => r.isValid && !r.isDuplicate && !r.isDuplicateInFile && !r.autoRejected).length;
  const errorCount = editableData.filter(r => !r.isValid).length;
  const dbDuplicateCount = editableData.filter(r => r.isDuplicate && !r.autoAccepted).length;
  const fileDuplicateCount = editableData.filter(r => r.isDuplicateInFile).length;
  const autoAcceptedCount = editableData.filter(r => r.autoAccepted).length;
  const autoRejectedCount = editableData.filter(r => r.autoRejected).length;
  const ruleCategorizedCount = editableData.filter(r => r.appliedRule && r.categoryId).length;
  const selectedCount = selectedRows.size;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">Import Transactions</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowRulesManager(true)}>
            <Zap className="mr-2 h-4 w-4" />
            Import Rules {rules.length > 0 && `(${rules.length})`}
          </Button>
          <Button variant="outline" onClick={handleDownloadTemplate}>
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
              Required columns: date, label, value. Optional: category.
              <br />
              <span className="text-muted-foreground">Note: Only transactions from {APP_START_DATE_STRING} onwards are allowed.</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Source selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Import Source (optional)</label>
              <div className="flex gap-2">
                <Select 
                  value={selectedSourceId || '__none__'} 
                  onValueChange={(v) => setSelectedSourceId(v === '__none__' ? null : v)}
                >
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Select source..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No source</SelectItem>
                    {sources.map(source => (
                      <SelectItem key={source.id} value={source.id}>
                        {source.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => setShowNewSource(!showNewSource)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              
              {showNewSource && (
                <div className="flex gap-2">
                  <Input
                    value={newSourceName}
                    onChange={(e) => setNewSourceName(e.target.value)}
                    placeholder="e.g., Boursorama, Revolut, BNP..."
                    className="w-64"
                  />
                  <Button onClick={handleCreateSource} disabled={!newSourceName.trim()}>
                    Add Source
                  </Button>
                </div>
              )}
            </div>

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
              {selectedSourceId && sources.find(s => s.id === selectedSourceId) && (
                <> • Source: {sources.find(s => s.id === selectedSourceId)?.name}</>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Summary badges */}
            <div className="flex flex-wrap gap-2">
              <Badge variant="default" className="bg-emerald-600">
                {validCount} Valid
              </Badge>
              {ruleCategorizedCount > 0 && (
                <Badge variant="secondary" className="bg-violet-100 text-violet-800">
                  <Sparkles className="mr-1 h-3 w-3" />
                  {ruleCategorizedCount} Auto-categorized
                </Badge>
              )}
              {autoAcceptedCount > 0 && (
                <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">
                  {autoAcceptedCount} Auto-accepted
                </Badge>
              )}
              {autoRejectedCount > 0 && (
                <Badge variant="secondary" className="bg-red-100 text-red-800">
                  {autoRejectedCount} Auto-rejected
                </Badge>
              )}
              {errorCount > 0 && (
                <Badge variant="destructive">
                  {errorCount} Errors
                </Badge>
              )}
              {dbDuplicateCount > 0 && (
                <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                  {dbDuplicateCount} DB Duplicates
                </Badge>
              )}
              {fileDuplicateCount > 0 && (
                <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                  {fileDuplicateCount} File Duplicates
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

            {/* Data table - only label and category are editable */}
            <TooltipProvider>
            <ScrollArea className="h-[400px] rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Import</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Label</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead>Category</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedEditableData.map((row, sortedIdx) => {
                    const originalIdx = getOriginalIndex(sortedIdx);
                    
                    // Determine row styling based on status
                    const getRowClassName = () => {
                      if (row.autoRejected) return 'bg-red-50/50 dark:bg-red-950/10 opacity-60';
                      if (row.isDuplicate && !row.autoAccepted) return 'bg-amber-50 dark:bg-amber-950/20';
                      if (row.isDuplicateInFile) return 'bg-orange-50 dark:bg-orange-950/20';
                      if (!row.isValid) return 'bg-red-50 dark:bg-red-950/20';
                      if (row.appliedRule) return 'bg-violet-50/50 dark:bg-violet-950/10';
                      return '';
                    };
                    
                    return (
                      <TableRow 
                        key={sortedIdx} 
                        className={getRowClassName()}
                      >
                        <TableCell>
                          <Checkbox 
                            checked={selectedRows.has(originalIdx)}
                            onCheckedChange={() => toggleRow(originalIdx)}
                            disabled={!row.isValid || row.autoRejected}
                          />
                        </TableCell>
                        <TableCell>
                          {row.autoRejected ? (
                            <Badge variant="destructive" className="bg-red-100 text-red-800">
                              <X className="mr-1 h-3 w-3" />
                              Auto-rejected
                            </Badge>
                          ) : row.autoAccepted ? (
                            <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">
                              <Check className="mr-1 h-3 w-3" />
                              Auto-accepted
                            </Badge>
                          ) : row.isDuplicate ? (
                            <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                              <AlertTriangle className="mr-1 h-3 w-3" />
                              DB Duplicate
                            </Badge>
                          ) : row.isDuplicateInFile ? (
                            <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                              <AlertTriangle className="mr-1 h-3 w-3" />
                              File Dup #{row.duplicateIndex}
                            </Badge>
                          ) : !row.isValid ? (
                            <Badge variant="destructive">
                              <X className="mr-1 h-3 w-3" />
                              {row.errors[0]}
                            </Badge>
                          ) : row.appliedRule ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="secondary" className="bg-violet-100 text-violet-800 cursor-help">
                                  <Sparkles className="mr-1 h-3 w-3" />
                                  Rule applied
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Rule: {row.appliedRule.name}</p>
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <Badge variant="default" className="bg-emerald-600">
                              <Check className="mr-1 h-3 w-3" />
                              Valid
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {row.date}
                        </TableCell>
                        <TableCell>
                          <Input
                            value={row.label}
                            onChange={(e) => updateRow(originalIdx, 'label', e.target.value)}
                            className={`h-8 ${!row.label ? 'border-destructive' : ''}`}
                            placeholder="Transaction label"
                          />
                        </TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">
                          {row.value.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Select 
                            value={row.category || '__none__'} 
                            onValueChange={(v) => updateRow(originalIdx, 'category', v === '__none__' ? undefined : v)}
                          >
                            <SelectTrigger className="h-8 w-36">
                              <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">None</SelectItem>
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
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
            </TooltipProvider>

            {/* Info boxes */}
            {rulesApplied && ruleCategorizedCount > 0 && (
              <div className="flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 p-3 text-sm dark:border-violet-900 dark:bg-violet-950">
                <Sparkles className="h-4 w-4 text-violet-600" />
                <span>
                  {ruleCategorizedCount} transaction(s) were automatically categorized by import rules.
                  {autoAcceptedCount > 0 && ` ${autoAcceptedCount} duplicate(s) were auto-accepted.`}
                  {autoRejectedCount > 0 && ` ${autoRejectedCount} duplicate(s) were auto-rejected.`}
                </span>
              </div>
            )}
            {dbDuplicateCount > 0 && (
              <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <span>{dbDuplicateCount} duplicate(s) already exist in your database. They are shown first and deselected by default.</span>
              </div>
            )}
            
            {fileDuplicateCount > 0 && (
              <div className="flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm dark:border-orange-900 dark:bg-orange-950">
                <AlertCircle className="h-4 w-4 text-orange-600" />
                <span>{fileDuplicateCount} duplicate(s) found within this file. If you import them, they'll be renamed with a number suffix.</span>
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
        <DialogContent className="max-w-3xl">
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
                    <TableHead>Import Date</TableHead>
                    <TableHead>Date Range</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Filename</TableHead>
                    <TableHead className="text-right">Rows</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {importBatches.map(batch => (
                    <TableRow key={batch.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(batch.imported_at), 'MMM dd, yyyy HH:mm')}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {batch.date_from && batch.date_to ? (
                          <>
                            {format(new Date(batch.date_from), 'MMM dd')} - {format(new Date(batch.date_to), 'MMM dd, yyyy')}
                          </>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        {batch.import_sources?.name ? (
                          <Badge variant="outline">{batch.import_sources.name}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[150px] truncate font-mono text-sm">
                        {batch.filename}
                      </TableCell>
                      <TableCell className="text-right">{batch.row_count}</TableCell>
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

      {/* Import Rules Manager */}
      <ImportRulesManager
        open={showRulesManager}
        onClose={() => setShowRulesManager(false)}
        importRows={editableData}
      />
    </div>
  );
}
