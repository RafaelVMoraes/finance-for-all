import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthContext } from '@/contexts/AuthContext';
import * as XLSX from 'xlsx';
import { parse, isValid, format, isBefore } from 'date-fns';
import { APP_START_DATE } from '@/constants/app';
import { ImportRule, RuleMatchResult, DuplicateAction } from '@/types/importRules';
import { batchEvaluateRules } from '@/lib/ruleEngine';

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

export function useImport() {
  const [loading, setLoading] = useState(false);
  const [importBatches, setImportBatches] = useState<ImportBatch[]>([]);
  const { user } = useAuthContext();

  const parseFile = useCallback(async (file: File): Promise<ParsedImportData> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array', cellDates: true });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][];
          
          if (jsonData.length < 2) {
            reject(new Error('File is empty or has no data rows'));
            return;
          }
          
          // Find header row (first row)
          const headers = (jsonData[0] as string[]).map(h => String(h).toLowerCase().trim());
          const dateIdx = headers.findIndex(h => h === 'date' || h === 'data');
          const labelIdx = headers.findIndex(h => h === 'label' || h === 'description' || h === 'descricao');
          const valueIdx = headers.findIndex(h => h === 'value' || h === 'amount' || h === 'valor');
          const categoryIdx = headers.findIndex(h => h === 'category' || h === 'categoria');
          
          if (dateIdx === -1 || labelIdx === -1 || valueIdx === -1) {
            reject(new Error('Required columns not found. Please include: date, label, value'));
            return;
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
            
            // Parse label
            const label = row[labelIdx] ? String(row[labelIdx]).trim() : '';
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
          
          resolve({ rows, hasErrors, hasDuplicates: false, hasDuplicatesInFile });
        } catch (err) {
          reject(err);
        }
      };
      
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  }, []);

  const checkDuplicates = useCallback(async (rows: ImportRow[]): Promise<ImportRow[]> => {
    if (!user || rows.length === 0) return rows;

    const validRows = rows.filter(row => row.isValid && row.date && row.label);
    if (validRows.length === 0) return rows;

    const uniqueDates = [...new Set(validRows.map(row => row.date))].sort();
    const uniqueLabels = [...new Set(validRows.map(row => row.label))];

    const minDate = uniqueDates[0];
    const maxDate = uniqueDates[uniqueDates.length - 1];

    // Narrow search window by date range and only labels present in file.
    // This avoids loading the user's full transaction history into memory.
    const { data: existing } = await supabase
      .from('transactions')
      .select('payment_date, original_label, amount')
      .eq('user_id', user.id)
      .gte('payment_date', minDate)
      .lte('payment_date', maxDate)
      .in('original_label', uniqueLabels);

    if (!existing) return rows;

    const existingSet = new Set(
      existing.map(t => createRowKey(t.payment_date, t.original_label, t.amount))
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
    const ruleInputs = rows.map(row => ({
      label: row.label,
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
        } else if (result.duplicateAction === 'reject') {
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
          // Use categoryId from rule or look up from category name
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
      
      // Update rule usage stats in batch (single RPC)
      if (appliedRuleIds && appliedRuleIds.length > 0) {
        const increments = Object.entries(
          appliedRuleIds.reduce<Record<string, number>>((acc, ruleId) => {
            acc[ruleId] = (acc[ruleId] || 0) + 1;
            return acc;
          }, {})
        ).map(([rule_id, increment]) => ({ rule_id, increment }));

        const { error: statsError } = await supabase.rpc('increment_import_rule_usage', {
          p_increments: increments,
        });

        if (statsError) {
          console.error('Error updating import rule usage stats:', statsError);
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
      console.error('Error fetching import batches:', error);
    } else {
      setImportBatches((data || []) as ImportBatch[]);
    }
  }, [user]);

  const deleteImportBatch = useCallback(async (batchId: string) => {
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
    parseFile,
    checkDuplicates,
    applyRules,
    importTransactions,
    fetchImportBatches,
    deleteImportBatch,
    generateTemplate,
  };
}
