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
import { useImport, ImportRow, ColumnIndices, RawFileData } from '@/hooks/useImport';
import { useImportSources } from '@/hooks/useImportSources';
import { useCategories } from '@/hooks/useCategories';
import { useImportRules } from '@/hooks/useImportRules';
import { useSourceColumnMappings } from '@/hooks/useSourceColumnMappings';
import { ImportRulesManager } from '@/components/import/ImportRulesManager';
import { ColumnMappingDialog } from '@/components/import/ColumnMappingDialog';
import { detectColumnMapping, isTemplateFormat, ColumnMapping } from '@/lib/columnDetection';
import { format } from 'date-fns';
import { APP_START_DATE_STRING } from '@/constants/app';
import { useIsMobile } from '@/hooks/use-mobile';
import { useI18n } from '@/i18n/I18nProvider';

export default function Import() {
  const { t } = useI18n();
  const isMobile = useIsMobile();
  const [step, setStep] = useState<'upload' | 'column-mapping' | 'validation' | 'complete'>('upload');
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
  const [processingState, setProcessingState] = useState<string | null>(null);
  
  // Column mapping state
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [rawFileData, setRawFileData] = useState<RawFileData | null>(null);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({ date: null, label: null, value: null, category: null });
  const [hasHeaders, setHasHeaders] = useState(true);
  
  const { toast } = useToast();
  const { 
    loading, 
    importBatches, 
    readFileRaw,
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
  const { getMapping, saveMapping } = useSourceColumnMappings();

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

  // Sort data
  const sortedEditableData = useMemo(() => {
    return [...editableData].sort((a, b) => {
      if (a.autoRejected && !b.autoRejected) return -1;
      if (!a.autoRejected && b.autoRejected) return 1;
      const aDup = a.isDuplicate && !a.autoAccepted;
      const bDup = b.isDuplicate && !b.autoAccepted;
      if (aDup && !bDup) return -1;
      if (!aDup && bDup) return 1;
      if (a.isDuplicateInFile && !b.isDuplicateInFile) return -1;
      if (!a.isDuplicateInFile && b.isDuplicateInFile) return 1;
      if (!a.isValid && b.isValid) return -1;
      if (a.isValid && !b.isValid) return 1;
      return 0;
    });
  }, [editableData]);

  const getOriginalIndex = useCallback((sortedIndex: number) => {
    const sortedRow = sortedEditableData[sortedIndex];
    return editableData.findIndex(r => r === sortedRow);
  }, [sortedEditableData, editableData]);

  /** Process file after column mapping is confirmed */
  const processFileWithMapping = useCallback(async (file: File, mapping: ColumnMapping, headersPresent = true) => {
    try {
      const raw = rawFileData || await readFileRaw(file);
      const rawHeaders = headersPresent
        ? raw.rawHeaders
        : Array.from({ length: Math.max(...raw.jsonData.map((row) => row.length), 0) }, (_, i) => `Column ${i + 1}`);

      const columnIndices: ColumnIndices = {
        dateIdx: mapping.date ? rawHeaders.findIndex(h => h === mapping.date) : -1,
        labelIdx: mapping.label ? rawHeaders.findIndex(h => h === mapping.label) : -1,
        valueIdx: mapping.value ? rawHeaders.findIndex(h => h === mapping.value) : -1,
        categoryIdx: mapping.category ? rawHeaders.findIndex(h => h === mapping.category) : -1,
        dataStartRow: headersPresent ? 1 : 0,
      };

      if (columnIndices.dateIdx === -1 || columnIndices.labelIdx === -1 || columnIndices.valueIdx === -1) {
        throw new Error('Required columns could not be mapped.');
      }

      const result = await parseFile(file, columnIndices);
      const withDuplicates = await checkDuplicates(result.rows);
      
      const enabledRules = rules.filter(r => r.enabled);
      let processedRows = withDuplicates;
      
      if (enabledRules.length > 0) {
        processedRows = applyRules(withDuplicates, enabledRules, categoryIdToName);
        setRulesApplied(true);
        
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
      setProcessingState(null);
      toast({
        variant: 'destructive',
        title: 'Failed to parse file',
        description: err instanceof Error ? err.message : 'Unknown error',
      });
      setStep('upload');
    }
  }, [rawFileData, readFileRaw, parseFile, checkDuplicates, applyRules, rules, categoryIdToName, toast]);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
    const fileName = selectedFile.name.toLowerCase();
    if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls') && !fileName.endsWith('.csv') && !fileName.endsWith('.txt') && !fileName.endsWith('.pdf')) {
      toast({
        variant: 'destructive',
        title: 'Invalid file type',
        description: 'Please upload a supported file (.xlsx, .xls, .csv, .txt, or .pdf)',
      });
      return;
    }
    
    setCurrentFilename(selectedFile.name);
    setPendingFile(selectedFile);
    
    try {
      if (fileName.endsWith('.pdf')) {
        setProcessingState('Processing PDF...');
        const result = await parseFile(selectedFile);
        setProcessingState('Parsing transactions...');
        const withDuplicates = await checkDuplicates(result.rows);

        const enabledRules = rules.filter(r => r.enabled);
        const processedRows = enabledRules.length > 0
          ? applyRules(withDuplicates, enabledRules, categoryIdToName)
          : withDuplicates;

        setParsedData(processedRows);
        setEditableData(processedRows);

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
        setProcessingState(null);

        if (result.rows.length === 0) {
          throw new Error('Unable to detect transactions in this PDF');
        }

        if (result.hasErrors) {
          toast({
            title: 'PDF partially parsed',
            description: 'Some lines could not be parsed and were skipped.',
          });
        }

        return;
      }

      const raw = await readFileRaw(selectedFile);
      setRawFileData(raw);

      // Check if we have a saved mapping for this source
      if (selectedSourceId) {
        const savedMapping = await getMapping(selectedSourceId);
        if (savedMapping) {
          // Verify saved mapping columns exist in this file
          const headersSet = new Set(raw.rawHeaders);
          const allExist = 
            (savedMapping.date && headersSet.has(savedMapping.date)) &&
            (savedMapping.label && headersSet.has(savedMapping.label)) &&
            (savedMapping.value && headersSet.has(savedMapping.value));
          
          if (allExist) {
            // Use saved mapping directly
            toast({ title: 'Using saved column mapping', description: `Mapping from source loaded automatically` });
            await processFileWithMapping(selectedFile, savedMapping, true);
            return;
          }
        }
      }

      // Check if template format
      if (isTemplateFormat(raw.headers)) {
        // Standard template — process directly
        await processFileWithMapping(selectedFile, {
          date: raw.rawHeaders[raw.headers.findIndex(h => h === 'date' || h === 'data')],
          label: raw.rawHeaders[raw.headers.findIndex(h => h === 'label' || h === 'description' || h === 'descricao')],
          value: raw.rawHeaders[raw.headers.findIndex(h => h === 'value' || h === 'amount' || h === 'valor')],
          category: raw.headers.findIndex(h => h === 'category' || h === 'categoria') >= 0
            ? raw.rawHeaders[raw.headers.findIndex(h => h === 'category' || h === 'categoria')]
            : null,
        });
        return;
      }

      // Non-template: auto-detect and show mapping dialog
      const sampleRows = raw.jsonData.slice(1, 11);
      const detected = detectColumnMapping(raw.rawHeaders, sampleRows);
      setHasHeaders(true);
      setColumnMapping(detected);
      setStep('column-mapping');
    } catch (err) {
      setProcessingState(null);
      toast({
        variant: 'destructive',
        title: 'Failed to read file',
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }, [readFileRaw, getMapping, selectedSourceId, processFileWithMapping, parseFile, checkDuplicates, rules, applyRules, categoryIdToName, toast]);

  const handleColumnMappingConfirm = useCallback(async (mapping: ColumnMapping, saveForSource: boolean) => {
    if (!pendingFile) return;
    
    if (saveForSource && selectedSourceId) {
      await saveMapping(selectedSourceId, mapping);
      toast({ title: 'Column mapping saved', description: 'Will be used automatically for future imports from this source.' });
    }
    
    await processFileWithMapping(pendingFile, mapping, hasHeaders);
  }, [pendingFile, selectedSourceId, saveMapping, processFileWithMapping, toast, hasHeaders]);

  const handleColumnMappingCancel = useCallback(() => {
    setPendingFile(null);
    setRawFileData(null);
    setColumnMapping({ date: null, label: null, value: null, category: null });
    setHasHeaders(true);
    setStep('upload');
  }, []);

  const updateRow = (originalIndex: number, field: 'label' | 'category', value: string | undefined) => {
    setEditableData(prev => {
      const updated = [...prev];
      if (field === 'label') {
        updated[originalIndex] = { ...updated[originalIndex], label: value || '' };
      } else if (field === 'category') {
        updated[originalIndex] = { ...updated[originalIndex], category: value };
      }
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
      if (next.has(originalIndex)) next.delete(originalIndex);
      else next.add(originalIndex);
      return next;
    });
  };

  const selectAllValid = () => {
    const validIndices = editableData
      .map((row, idx) => (
        row.isValid && !row.autoRejected && (!row.isDuplicate || row.autoAccepted) && !row.isDuplicateInFile 
          ? idx : -1
      ))
      .filter(idx => idx >= 0);
    setSelectedRows(new Set(validIndices));
  };

  const deselectAll = () => setSelectedRows(new Set());

  const handleCreateSource = async () => {
    if (!newSourceName.trim()) return;
    const result = await createSource(newSourceName);
    if (result.error) {
      toast({ variant: 'destructive', title: 'Failed to create source', description: result.error });
    } else if (result.data) {
      setSelectedSourceId(result.data.id);
      setNewSourceName('');
      setShowNewSource(false);
    }
  };

  const handleImport = async () => {
    const rowsToImport = editableData.filter((_, idx) => selectedRows.has(idx) && editableData[idx].isValid);
    if (rowsToImport.length === 0) {
      toast({ variant: 'destructive', title: 'No rows to import', description: 'Please select valid rows to import' });
      return;
    }
    
    // Auto-generate import name: SOURCE (dd/mm - dd/mm)
    let importName = currentFilename;
    const dates = rowsToImport.map(r => r.date).filter(Boolean).sort();
    if (dates.length > 0) {
      const dateFrom = dates[0];
      const dateTo = dates[dates.length - 1];
      const fromFormatted = format(new Date(dateFrom), 'dd/MM');
      const toFormatted = format(new Date(dateTo), 'dd/MM');
      
      const sourceName = selectedSourceId 
        ? sources.find(s => s.id === selectedSourceId)?.name || ''
        : '';
      const prefix = sourceName ? sourceName.substring(0, 4).toUpperCase() : currentFilename.substring(0, 4).toUpperCase();
      importName = `${prefix} (${fromFormatted} - ${toFormatted})`;
    }
    
    const appliedRuleIds = rowsToImport.filter(r => r.appliedRule).map(r => r.appliedRule!.id);
    const result = await importTransactions(rowsToImport, importName, categoryNameToId, selectedSourceId, appliedRuleIds);
    if (result.error) {
      toast({ variant: 'destructive', title: 'Import failed', description: result.error });
    } else {
      setImportResult({ imported: result.imported || 0 });
      setStep('complete');
      fetchImportBatches();
      toast({ title: 'Import complete!', description: `${result.imported} transactions imported successfully` });
    }
  };

  const resetImport = () => {
    setParsedData([]);
    setEditableData([]);
    setSelectedRows(new Set());
    setCurrentFilename('');
    setSelectedSourceId(null);
    setRulesApplied(false);
    setPendingFile(null);
    setRawFileData(null);
    setColumnMapping({ date: null, label: null, value: null, category: null });
    setProcessingState(null);
    setStep('upload');
  };

  const handleDeleteBatch = async (batchId: string) => {
    const result = await deleteImportBatch(batchId);
    if (result.error) {
      toast({ variant: 'destructive', title: 'Failed to delete batch', description: result.error });
    } else {
      toast({ title: 'Batch deleted', description: 'All related transactions have been removed' });
    }
  };

  const handleDownloadTemplate = () => {
    const categoryData = categories.map(c => ({ name: c.name, type: c.type, color: c.color }));
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

  const getRowClassName = (row: ImportRow) => {
    if (row.autoRejected) return 'bg-red-50/50 dark:bg-red-950/10 opacity-60';
    if (row.isDuplicate && !row.autoAccepted) return 'bg-amber-50 dark:bg-amber-950/20';
    if (row.isDuplicateInFile) return 'bg-orange-50 dark:bg-orange-950/20';
    if (!row.isValid) return 'bg-red-50 dark:bg-red-950/20';
    if (row.appliedRule) return 'bg-violet-50/50 dark:bg-violet-950/10';
    return '';
  };

  const renderRowStatus = (row: ImportRow) => {
    if (row.autoRejected) {
      return <Badge variant="destructive" className="bg-red-100 text-red-800"><X className="mr-1 h-3 w-3" />Auto-rejected</Badge>;
    }
    if (row.autoAccepted) {
      return <Badge variant="secondary" className="bg-emerald-100 text-emerald-800"><Check className="mr-1 h-3 w-3" />Auto-accepted</Badge>;
    }
    if (row.isDuplicate) {
      return <Badge variant="secondary" className="bg-amber-100 text-amber-800"><AlertTriangle className="mr-1 h-3 w-3" />DB Duplicate</Badge>;
    }
    if (row.isDuplicateInFile) {
      return <Badge variant="secondary" className="bg-orange-100 text-orange-800"><AlertTriangle className="mr-1 h-3 w-3" />File Dup #{row.duplicateIndex}</Badge>;
    }
    if (!row.isValid) {
      return <Badge variant="destructive"><X className="mr-1 h-3 w-3" />{row.errors[0]}</Badge>;
    }
    if (row.appliedRule) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="secondary" className="cursor-help bg-violet-100 text-violet-800"><Sparkles className="mr-1 h-3 w-3" />Rule applied</Badge>
          </TooltipTrigger>
          <TooltipContent><p>Rule: {row.appliedRule.name}</p></TooltipContent>
        </Tooltip>
      );
    }

    return <Badge variant="default" className="bg-emerald-600"><Check className="mr-1 h-3 w-3" />Valid</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">{t('importPage.title')}</h1>
        <div className="grid w-full grid-cols-3 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-end">
          <Button data-tutorial="import-mapping-rules" variant="outline" onClick={() => setShowRulesManager(true)} className="h-10 min-w-0 px-2 text-xs sm:px-4 sm:text-sm">
            <Zap className="mr-2 h-4 w-4" />
            {t('importPage.importRules')} {rules.length > 0 && `(${rules.length})`}
          </Button>
          <Button variant="outline" onClick={handleDownloadTemplate} className="h-10 min-w-0 px-2 text-xs sm:px-4 sm:text-sm">
            <Download className="mr-2 h-4 w-4" />
            {t('importPage.downloadTemplate')}
          </Button>
          <Button data-tutorial="import-history" variant="outline" onClick={() => setShowHistoryModal(true)} className="h-10 min-w-0 px-2 text-xs sm:px-4 sm:text-sm">
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            {t('importPage.history')}
          </Button>
        </div>
      </div>

      {step === 'upload' && (
        <Card data-tutorial="import-source-template">
          <CardHeader>
            <CardTitle>{t('importPage.uploadTitle')}</CardTitle>
            <CardDescription>
              {t('importPage.uploadClarification')}
              <br />
              <span className="text-muted-foreground">{t('importPage.allowedDatesNote', { date: APP_START_DATE_STRING })}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Source selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('importPage.sourceLabel')}</label>
              <div className="flex items-center gap-2">
                <Select 
                  value={selectedSourceId || '__none__'} 
                  onValueChange={(v) => setSelectedSourceId(v === '__none__' ? null : v)}
                >
                  <SelectTrigger className="flex-1 sm:w-64">
                    <SelectValue placeholder={t('importPage.selectSource')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{t('importPage.noSource')}</SelectItem>
                    {sources.map(source => (
                      <SelectItem key={source.id} value={source.id}>{source.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="icon" className="shrink-0" onClick={() => setShowNewSource(!showNewSource)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              
              {showNewSource && (
                <div className="flex flex-wrap gap-2">
                  <Input value={newSourceName} onChange={(e) => setNewSourceName(e.target.value)} placeholder="e.g., Boursorama, Revolut, BNP..." className="w-full sm:w-64" />
                  <Button onClick={handleCreateSource} disabled={!newSourceName.trim()}>{t('importPage.addSource')}</Button>
                </div>
              )}
            </div>


            {processingState && (
              <p className="text-sm font-medium text-primary">{processingState}</p>
            )}
            <label 
              htmlFor="file-upload"
              className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/50 p-12 transition-colors hover:border-primary hover:bg-muted"
            >
              <Upload className="mb-4 h-12 w-12 text-muted-foreground" />
              <span className="mb-2 text-lg font-medium">{t('importPage.dropFile')}</span>
              <span className="text-sm text-muted-foreground">{t('importPage.supportedFiles')}</span>
              <input id="file-upload" type="file" accept=".csv,.txt,.xlsx,.xls,.pdf,text/csv,text/plain,application/pdf" onChange={handleFileChange} className="hidden" />
            </label>
          </CardContent>
        </Card>
      )}

      {/* Column Mapping Dialog */}
      {step === 'column-mapping' && rawFileData && (
        <ColumnMappingDialog
          open={true}
          hasHeaders={hasHeaders}
          onHasHeadersChange={(value) => {
            setHasHeaders(value);
            if (!rawFileData) return;
            if (value) {
              const sampleRows = rawFileData.jsonData.slice(1, 11);
              setColumnMapping(detectColumnMapping(rawFileData.rawHeaders, sampleRows));
            } else {
              const generatedHeaders = Array.from(
                { length: Math.max(...rawFileData.jsonData.map((row) => row.length), 0) },
                (_, i) => `Column ${i + 1}`,
              );
              const sampleRows = rawFileData.jsonData.slice(0, 10);
              setColumnMapping(detectColumnMapping(generatedHeaders, sampleRows));
            }
          }}
          onConfirm={handleColumnMappingConfirm}
          onCancel={handleColumnMappingCancel}
          headers={
            hasHeaders
              ? rawFileData.rawHeaders
              : Array.from(
                  { length: Math.max(...rawFileData.jsonData.map((row) => row.length), 0) },
                  (_, i) => `Column ${i + 1}`,
                )
          }
          sampleRows={hasHeaders ? rawFileData.jsonData.slice(1, 11) : rawFileData.jsonData.slice(0, 10)}
          mapping={columnMapping}
          onMappingChange={setColumnMapping}
          sourceName={sources.find(s => s.id === selectedSourceId)?.name}
          sourceId={selectedSourceId}
        />
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
              <Button variant="outline" size="sm" onClick={selectAllValid}>Select All Valid</Button>
              <Button variant="outline" size="sm" onClick={deselectAll}>Deselect All</Button>
            </div>

            {/* Data table */}
            <TooltipProvider>
            {isMobile ? (
              <div className="space-y-2">
                {sortedEditableData.map((row, sortedIdx) => {
                  const originalIdx = getOriginalIndex(sortedIdx);
                  return (
                    <Card key={sortedIdx} className={getRowClassName(row)}>
                      <CardContent className="space-y-2 p-3">
                        <div className="flex items-start justify-between gap-2">
                          {renderRowStatus(row)}
                          <Checkbox checked={selectedRows.has(originalIdx)} onCheckedChange={() => toggleRow(originalIdx)} disabled={!row.isValid || row.autoRejected} />
                        </div>
                        <p className="text-xs text-muted-foreground">{row.date}</p>
                        <Input
                          value={row.label}
                          onChange={(e) => updateRow(originalIdx, 'label', e.target.value)}
                          className={`h-8 ${!row.label ? 'border-destructive' : ''}`}
                          placeholder="Transaction label"
                        />
                        <div className="text-right font-mono text-sm text-muted-foreground">{row.value.toFixed(2)}</div>
                        <Select
                          value={row.category || '__none__'}
                          onValueChange={(v) => updateRow(originalIdx, 'category', v === '__none__' ? undefined : v)}
                        >
                          <SelectTrigger className="h-8 w-full">
                            <SelectValue placeholder="Select..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">None</SelectItem>
                            {activeCategories.map(cat => (
                              <SelectItem key={cat.id} value={cat.name}>
                                <div className="flex items-center gap-2">
                                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: cat.color }} />
                                  {cat.name}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
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
                    
                    return (
                      <TableRow key={sortedIdx} className={getRowClassName(row)}>
                        <TableCell>
                          <Checkbox 
                            checked={selectedRows.has(originalIdx)}
                            onCheckedChange={() => toggleRow(originalIdx)}
                            disabled={!row.isValid || row.autoRejected}
                          />
                        </TableCell>
                        <TableCell>
                          {renderRowStatus(row)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">{row.date}</TableCell>
                        <TableCell>
                          <Input
                            value={row.label}
                            onChange={(e) => updateRow(originalIdx, 'label', e.target.value)}
                            className={`h-8 ${!row.label ? 'border-destructive' : ''}`}
                            placeholder="Transaction label"
                          />
                        </TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">{row.value.toFixed(2)}</TableCell>
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
                                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: cat.color }} />
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
            )}
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
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted p-3 text-sm">
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
                <span>{dbDuplicateCount} duplicate(s) already exist in your database.</span>
              </div>
            )}
            {fileDuplicateCount > 0 && (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted p-3 text-sm">
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
                <span>{fileDuplicateCount} duplicate(s) found within this file.</span>
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={resetImport}>Cancel</Button>
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
              <Button variant="outline" onClick={resetImport}>Import More</Button>
              <Button asChild><a href="/transactions">View Transactions</a></Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Import History Modal */}
      <Dialog open={showHistoryModal} onOpenChange={setShowHistoryModal}>
        <DialogContent className="w-[95vw] max-w-4xl p-4 sm:p-6">
          <DialogHeader><DialogTitle>{t('importPage.history')}</DialogTitle></DialogHeader>
          <ScrollArea className="max-h-[70vh]">
            {importBatches.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">{t('importPage.noImportsYet')}</p>
            ) : (
              isMobile ? (
                <div className="space-y-3">
                  {importBatches.map(batch => (
                    <div key={batch.id} className="space-y-2 rounded-lg border p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium">{format(new Date(batch.imported_at), 'MMM dd, yyyy HH:mm')}</p>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDeleteBatch(batch.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                      <p className="truncate font-mono text-xs text-muted-foreground">{batch.filename}</p>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <Badge variant="outline">{batch.row_count} rows</Badge>
                        {batch.import_sources?.name ? <Badge variant="outline">{batch.import_sources.name}</Badge> : null}
                        {batch.date_from && batch.date_to ? (
                          <Badge variant="secondary">{format(new Date(batch.date_from), 'MMM dd')} - {format(new Date(batch.date_to), 'MMM dd, yyyy')}</Badge>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('importPage.importDate')}</TableHead>
                    <TableHead>{t('importPage.dateRange')}</TableHead>
                    <TableHead>{t('importPage.source')}</TableHead>
                    <TableHead>{t('importPage.filename')}</TableHead>
                    <TableHead className="text-right">{t('importPage.rows')}</TableHead>
                    <TableHead className="text-right">{t('importPage.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {importBatches.map(batch => (
                    <TableRow key={batch.id}>
                      <TableCell className="whitespace-nowrap">{format(new Date(batch.imported_at), 'MMM dd, yyyy HH:mm')}</TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {batch.date_from && batch.date_to ? (
                          <>{format(new Date(batch.date_from), 'MMM dd')} - {format(new Date(batch.date_to), 'MMM dd, yyyy')}</>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        {batch.import_sources?.name ? <Badge variant="outline">{batch.import_sources.name}</Badge> : <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell className="max-w-[150px] truncate font-mono text-sm">{batch.filename}</TableCell>
                      <TableCell className="text-right">{batch.row_count}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteBatch(batch.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              )
            )}
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowHistoryModal(false)}>{t('common.close')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Rules Manager */}
      <ImportRulesManager open={showRulesManager} onClose={() => setShowRulesManager(false)} importRows={editableData} />
    </div>
  );
}
