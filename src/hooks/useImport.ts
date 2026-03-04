import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthContext } from '@/contexts/AuthContext';
import * as XLSX from 'xlsx';
import { parse, isValid, format, isBefore } from 'date-fns';
import { APP_START_DATE } from '@/constants/app';
import { ImportRule, DuplicateAction } from '@/types/importRules';
import { batchEvaluateRules } from '@/lib/ruleEngine';
import { extractPdfText } from '@/services/pdf.service';
import { parseTransactionsFromText } from '@/services/parsing.service';

export interface ImportRow {
  date: string;
  label: string;
  value: number;
  category?: string;
  categoryId?: string; // Category ID assigned by rule or manual selection
  isValid: boolean;
  errors: string[];
  isDuplicate?: boolean;
  isDuplicateInFile?: boolean;
  duplicateIndex?: number; // For naming duplicates
  // Rule application tracking
  appliedRule?: ImportRule;
  duplicateAction?: DuplicateAction;
  autoAccepted?: boolean;
  autoRejected?: boolean;
}

export interface ImportBatch {
  id: string;
  user_id: string;
  filename: string;
  row_count: number;
  imported_at: string;
  status: string;
  source_id: string | null;
  date_from: string | null;
  date_to: string | null;
  import_sources?: {
    id: string;
    name: string;
  } | null;
}

export interface ParsedImportData {
  rows: ImportRow[];
  hasErrors: boolean;
  hasDuplicates: boolean;
  hasDuplicatesInFile: boolean;
}

// Date formats to try
const DATE_FORMATS = [
  'yyyy-MM-dd',
  'dd/MM/yyyy',
  'MM/dd/yyyy',
  'dd-MM-yyyy',
  'MM-dd-yyyy',
  'dd.MM.yyyy',
  'yyyy/MM/dd',
];

function parseDate(value: unknown): { date: Date | null; format: string | null } {
  if (!value) return { date: null, format: null };
  
  // Handle Excel serial dates
  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value);
    if (date) {
      return { 
        date: new Date(date.y, date.m - 1, date.d), 
        format: 'excel' 
      };
    }
  }
  
  const strValue = String(value).trim();
  
  for (const fmt of DATE_FORMATS) {
    const parsed = parse(strValue, fmt, new Date());
    if (isValid(parsed)) {
      return { date: parsed, format: fmt };
    }
  }
  
  // Try native Date parsing as fallback
  const nativeDate = new Date(strValue);
  if (isValid(nativeDate)) {
    return { date: nativeDate, format: 'native' };
  }
  
  return { date: null, format: null };
}

function parseAmount(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  
  if (typeof value === 'number') return value;
  
  let strValue = String(value).trim();
  
  // Handle European format (comma as decimal separator)
  if (strValue.includes(',') && strValue.includes('.')) {
    if (strValue.lastIndexOf('.') < strValue.lastIndexOf(',')) {
      strValue = strValue.replace(/\./g, '').replace(',', '.');
    } else {
      strValue = strValue.replace(/,/g, '');
    }
  } else if (strValue.includes(',')) {
    if (/,\d{2}$/.test(strValue)) {
      strValue = strValue.replace(',', '.');
    } else {
      strValue = strValue.replace(/,/g, '');
    }
  }
  
  // Remove currency symbols and whitespace
  strValue = strValue.replace(/[€$£R\s]/g, '');
  
  const num = parseFloat(strValue);
  return isNaN(num) ? null : num;
}

// Create a unique key for duplicate detection
function createRowKey(date: string, label: string, value: number): string {
  return `${date}|${label.toLowerCase().trim()}|${value}`;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_ROW_COUNT = 10000;

function sanitizeLabel(label: string): string {
  // Remove leading characters that could trigger formula injection in spreadsheets
  return label.replace(/^[=+\-@\t\r]/g, "'");
}


function detectCsvSeparator(content: string): ',' | ';' {
  const firstLines = content
    .split(/\r?\n/)
    .slice(0, 5)
    .join('\n');
  const commaCount = (firstLines.match(/,/g) || []).length;
  const semicolonCount = (firstLines.match(/;/g) || []).length;
  return semicolonCount > commaCount ? ';' : ',';
}

function sheetRowsFromCsv(content: string): unknown[][] {
  const separator = detectCsvSeparator(content);
  const workbook = XLSX.read(content, { type: 'string', FS: separator });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][];
}

async function readSheetRows(file: File): Promise<unknown[][]> {
  const lowerName = file.name.toLowerCase();

  if (lowerName.endsWith('.csv') || lowerName.endsWith('.txt')) {
    const content = await file.text();
    return sheetRowsFromCsv(content);
  }

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][];
}

async function readPdfRows(file: File): Promise<ImportRow[]> {
  const rawText = await extractPdfText(file);
  const transactions = parseTransactionsFromText(rawText);

  if (transactions.length === 0) {
    throw new Error('Unable to detect transactions in this PDF');
  }

  return transactions.map((transaction) => ({
    date: transaction.date,
    label: sanitizeLabel(transaction.description),
    value: transaction.amount,
    isValid: Boolean(transaction.date) && !Number.isNaN(transaction.amount),
    errors: [],
  }));
}

export interface ColumnIndices {
  dateIdx: number;
  labelIdx: number;
  valueIdx: number;
  categoryIdx: number;
}

export interface RawFileData {
  headers: string[];
  rawHeaders: string[];
  jsonData: unknown[][];
}

export function useImport() {
  const [loading, setLoading] = useState(false);
  const [importBatches, setImportBatches] = useState<ImportBatch[]>([]);
  const { user } = useAuthContext();

  /** Read file and return raw headers + data without parsing rows */
  const readFileRaw = useCallback(async (file: File): Promise<RawFileData> => {
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`);
    }

    try {
      const lowerName = file.name.toLowerCase();
      if (lowerName.endsWith('.pdf')) {
        throw new Error('PDF files do not support column mapping');
      }

      const jsonData = await readSheetRows(file);

      if (jsonData.length < 2) {
        throw new Error('File is empty or has no data rows');
      }
      if (jsonData.length > MAX_ROW_COUNT + 1) {
        throw new Error(`File has too many rows. Maximum is ${MAX_ROW_COUNT} data rows.`);
      }

      const rawHeaders = (jsonData[0] as string[]).map(h => String(h).trim());
      const headers = rawHeaders.map(h => h.toLowerCase());

      return { headers, rawHeaders, jsonData };
    } catch {
      throw new Error('Failed to read file');
    }
  }, []);

  const parseFile = useCallback(async (file: File, columnIndices?: ColumnIndices): Promise<ParsedImportData> => {
    const lowerName = file.name.toLowerCase();
    if (lowerName.endsWith('.pdf')) {
      const rows = await readPdfRows(file);
      const hasErrors = rows.some(r => !r.isValid);
      return { rows, hasErrors, hasDuplicates: false, hasDuplicatesInFile: false };
    }

    const { headers, jsonData } = await readFileRaw(file);

    let dateIdx: number, labelIdx: number, valueIdx: number, categoryIdx: number;

    if (columnIndices) {
      dateIdx = columnIndices.dateIdx;
      labelIdx = columnIndices.labelIdx;
      valueIdx = columnIndices.valueIdx;
      categoryIdx = columnIndices.categoryIdx;
    } else {
      dateIdx = headers.findIndex(h => h === 'date' || h === 'data');
      labelIdx = headers.findIndex(h => h === 'label' || h === 'description' || h === 'descricao');
      valueIdx = headers.findIndex(h => h === 'value' || h === 'amount' || h === 'valor');
      categoryIdx = headers.findIndex(h => h === 'category' || h === 'categoria');

      if (dateIdx === -1 || labelIdx === -1 || valueIdx === -1) {
        throw new Error('Required columns not found. Please include: date, label, value');
      }
    }

    const rows: ImportRow[] = [];
          
          // Track duplicates within file
          const seenInFile = new Map<string, number>(); // key -> first occurrence index
          
          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i] as unknown[];
            if (!row || row.length === 0) continue;
            
            const errors: string[] = [];
            
            // Parse date
            const { date } = parseDate(row[dateIdx]);
            if (!date) {
              errors.push('Invalid date format');
            } else if (isBefore(date, APP_START_DATE)) {
              errors.push('Date before September 2025 is not allowed');
            }
            
            // Parse label (sanitize for formula injection)
            const rawLabel = row[labelIdx] ? String(row[labelIdx]).trim() : '';
            const label = rawLabel ? sanitizeLabel(rawLabel) : '';
            if (!label) {
              errors.push('Label is required');
            }
            
            // Parse value
            const value = parseAmount(row[valueIdx]);
            if (value === null) {
              errors.push('Invalid value format');
            }
            
            // Parse category (optional)
            const category = categoryIdx >= 0 && row[categoryIdx] 
              ? String(row[categoryIdx]).trim() 
              : undefined;
            
            const dateStr = date ? format(date, 'yyyy-MM-dd') : '';
            const rowKey = createRowKey(dateStr, label, value ?? 0);
            
            // Check for duplicate within file
            let isDuplicateInFile = false;
            let duplicateIndex: number | undefined;
            
            if (seenInFile.has(rowKey)) {
              isDuplicateInFile = true;
              duplicateIndex = (seenInFile.get(rowKey) || 0) + 1;
              seenInFile.set(rowKey, duplicateIndex);
            } else {
              seenInFile.set(rowKey, 1);
            }
            
            rows.push({
              date: dateStr,
              label,
              value: value ?? 0,
              category,
              isValid: errors.length === 0,
              errors,
              isDuplicateInFile,
              duplicateIndex: isDuplicateInFile ? duplicateIndex : undefined,
            });
          }
          
    const hasErrors = rows.some(r => !r.isValid);
    const hasDuplicatesInFile = rows.some(r => r.isDuplicateInFile);
    
    return { rows, hasErrors, hasDuplicates: false, hasDuplicatesInFile };
  }, [readFileRaw]);

  const checkDuplicates = useCallback(async (rows: ImportRow[]): Promise<ImportRow[]> => {
    if (!user) return rows;
    
    // Get unique dates from import to narrow the query
    const uniqueDates = [...new Set(rows.map(r => r.date).filter(Boolean))];
    if (uniqueDates.length === 0) return rows;
    
    const minDate = uniqueDates.sort()[0];
    const maxDate = uniqueDates.sort().reverse()[0];
    
    // Fetch existing transactions only for the relevant date range
    // Paginate to avoid 1000-row Supabase limit
    const allExisting: { payment_date: string; original_label: string; amount: number }[] = [];
    let from = 0;
    const PAGE = 1000;
    
    while (true) {
      const { data, error } = await supabase
        .from('transactions')
        .select('payment_date, original_label, amount')
        .eq('user_id', user.id)
        .gte('payment_date', minDate)
        .lte('payment_date', maxDate)
        .range(from, from + PAGE - 1);
      
      if (error || !data) break;
      allExisting.push(...data);
      if (data.length < PAGE) break;
      from += PAGE;
    }
    
    const existingSet = new Set(
      allExisting.map(t => createRowKey(t.payment_date, t.original_label, t.amount))
    );

    return rows.map(row => ({
      ...row,
      isDuplicate: existingSet.has(createRowKey(row.date, row.label, row.value))
    }));
  }, [user]);

  /**
   * Apply import rules to rows
   * This should be called after checkDuplicates
   * Rules are evaluated deterministically: same input → same output
   */
  const applyRules = useCallback((
    rows: ImportRow[],
    rules: ImportRule[],
    categoryMap: Record<string, string> // categoryId -> categoryName
  ): ImportRow[] => {
    if (rules.length === 0) return rows;
    
    // Batch evaluate rules for efficiency
    // Use the sanitized label (same as what gets stored) for consistent matching
    const ruleInputs = rows.map(row => ({
      label: row.label, // Already sanitized during parseFile
      value: row.value,
      isDuplicate: row.isDuplicate || row.isDuplicateInFile || false,
    }));
    
    const results = batchEvaluateRules(rules, ruleInputs);
    
    return rows.map((row, index) => {
      const result = results[index];
      
      if (!result.matched) return row;
      
      const updatedRow = { ...row };
      
      // Apply category from rule
      if (result.appliedCategory) {
        updatedRow.categoryId = result.appliedCategory;
        // Find category name for display
        const categoryEntry = Object.entries(categoryMap).find(
          ([id]) => id === result.appliedCategory
        );
        if (categoryEntry) {
          updatedRow.category = categoryEntry[1];
        }
      }
      
      // Apply duplicate action
      if (result.duplicateAction) {
        updatedRow.duplicateAction = result.duplicateAction;
        if (result.duplicateAction === 'accept') {
          updatedRow.autoAccepted = true;
        } else if (result.duplicateAction === 'reject' || result.duplicateAction === 'skip_import') {
          updatedRow.autoRejected = true;
        }
      }
      
      // Track which rule was applied
      if (result.rule) {
        updatedRow.appliedRule = result.rule;
      }
      
      return updatedRow;
    });
  }, []);

  const importTransactions = useCallback(async (
    rows: ImportRow[],
    filename: string,
    categoryMap: Record<string, string>, // category name (lowercase) -> category id
    sourceId?: string | null,
    appliedRuleIds?: string[] // Track which rules were used for stats
  ) => {
    if (!user) return { error: 'Not authenticated' };
    
    setLoading(true);
    
    try {
      // Calculate date range
      const validRows = rows.filter(r => r.isValid);
      const dates = validRows.map(r => r.date).filter(Boolean).sort();
      const dateFrom = dates[0] || null;
      const dateTo = dates[dates.length - 1] || null;
      
      // Create import batch
      const { data: batch, error: batchError } = await supabase
        .from('import_batches')
        .insert({
          user_id: user.id,
          filename,
          row_count: validRows.length,
          source_id: sourceId || null,
          date_from: dateFrom,
          date_to: dateTo,
        })
        .select()
        .single();
      
      if (batchError) throw batchError;
      
      // Prepare transactions
      // Filter out: duplicates (unless auto-accepted), auto-rejected
      const transactions = validRows
        .filter(r => {
          // Skip auto-rejected rows
          if (r.autoRejected) return false;
          // Skip duplicates unless auto-accepted
          if (r.isDuplicate && !r.autoAccepted) return false;
          return true;
        })
        .map(row => {
          // Rule category takes precedence over file category
          let categoryId: string | null = row.categoryId || null;
          if (!categoryId && row.category) {
            const categoryLower = row.category.toLowerCase().trim();
            categoryId = categoryMap[categoryLower] || null;
          }
          
          // Handle duplicate naming within file
          let label = row.label;
          if (row.isDuplicateInFile && row.duplicateIndex) {
            label = `${row.label} (${row.duplicateIndex})`;
          }
          
          return {
            user_id: user.id,
            import_batch_id: batch.id,
            payment_date: row.date,
            original_label: label,
            amount: row.value,
            original_category: row.category || null,
            category_id: categoryId,
          };
        });
      
      if (transactions.length > 0) {
        const { error: insertError } = await supabase
          .from('transactions')
          .insert(transactions);
        
        if (insertError) {
          // Rollback: delete the batch if insert fails
          await supabase.from('import_batches').delete().eq('id', batch.id);
          throw insertError;
        }
      }
      
      // Update batch row_count with actual imported count
      await supabase
        .from('import_batches')
        .update({ row_count: transactions.length })
        .eq('id', batch.id);
      
      // Update rule usage stats atomically (fire and forget)
      if (appliedRuleIds && appliedRuleIds.length > 0) {
        const ruleCounts = new Map<string, number>();
        appliedRuleIds.forEach(id => ruleCounts.set(id, (ruleCounts.get(id) || 0) + 1));
        
        const increments = Array.from(ruleCounts.entries()).map(([rule_id, increment]) => ({
          rule_id,
          increment,
        }));
        
        // Fire-and-forget rule usage update (non-blocking)
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase.rpc as any)('increment_import_rule_usage', {
            p_increments: JSON.stringify(increments),
          });
        } catch {
          // RPC may not exist yet — silently ignore
        }
      }
      
      setLoading(false);
      return { data: batch, imported: transactions.length };
    } catch (err) {
      setLoading(false);
      return { error: err instanceof Error ? err.message : 'Import failed' };
    }
  }, [user]);

  const fetchImportBatches = useCallback(async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('import_batches')
      .select(`
        *,
        import_sources (
          id,
          name
        )
      `)
      .eq('user_id', user.id)
      .order('imported_at', { ascending: false });
    
    if (error) {
      console.error('[IMPORT_BATCH_ERR]', error?.code || 'Unknown');
    } else {
      setImportBatches((data || []) as ImportBatch[]);
    }
  }, [user]);

  const deleteImportBatch = useCallback(async (batchId: string) => {
    // CASCADE on transactions.import_batch_id deletes related transactions.
    // The refresh_monthly_summary trigger recalculates aggregations automatically.
    const { error } = await supabase
      .from('import_batches')
      .delete()
      .eq('id', batchId);
    
    if (error) {
      return { error: error.message };
    }
    
    setImportBatches(prev => prev.filter(b => b.id !== batchId));
    return {};
  }, []);

  const generateTemplate = useCallback(async (categories: { name: string; type: string; color: string }[]) => {
    // Transaction sheet
    const wsTransactions = XLSX.utils.aoa_to_sheet([
      ['date', 'label', 'value', 'category'],
      ['2025-09-15', 'Grocery shopping', '-85.50', 'Food'],
      ['2025-09-16', 'Monthly salary', '3500.00', 'Income'],
      ['2025-09-17', 'Electric bill', '-120.00', 'Utilities'],
    ]);
    
    // Categories sheet
    const categoryRows = [
      ['Category Name', 'Type', 'Color'],
      ...categories.map(c => [c.name, c.type, c.color])
    ];
    const wsCategories = XLSX.utils.aoa_to_sheet(categoryRows);
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsTransactions, 'Transactions');
    XLSX.utils.book_append_sheet(wb, wsCategories, 'Categories');
    
    XLSX.writeFile(wb, 'fintrack-import-template.xlsx');
  }, []);

  return {
    loading,
    importBatches,
    readFileRaw,
    parseFile,
    checkDuplicates,
    applyRules,
    importTransactions,
    fetchImportBatches,
    deleteImportBatch,
    generateTemplate,
  };
}
