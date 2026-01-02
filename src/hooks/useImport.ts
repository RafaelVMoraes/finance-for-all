import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthContext } from '@/contexts/AuthContext';
import * as XLSX from 'xlsx';
import { parse, isValid, format } from 'date-fns';

export interface ImportRow {
  date: string;
  label: string;
  value: number;
  category?: string;
  isValid: boolean;
  errors: string[];
  isDuplicate?: boolean;
}

export interface ImportBatch {
  id: string;
  user_id: string;
  filename: string;
  row_count: number;
  imported_at: string;
  status: string;
}

export interface ParsedImportData {
  rows: ImportRow[];
  hasErrors: boolean;
  hasDuplicates: boolean;
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
  // If there's both comma and period, determine which is decimal
  if (strValue.includes(',') && strValue.includes('.')) {
    // Period before comma = European (1.234,56)
    if (strValue.lastIndexOf('.') < strValue.lastIndexOf(',')) {
      strValue = strValue.replace(/\./g, '').replace(',', '.');
    } else {
      // Comma before period = US (1,234.56)
      strValue = strValue.replace(/,/g, '');
    }
  } else if (strValue.includes(',')) {
    // Just comma - could be decimal or thousand separator
    // If comma is followed by exactly 2 digits at the end, it's decimal
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
          
          // Detect date format from first data row
          let detectedDateFormat: string | null = null;
          for (let i = 1; i < Math.min(jsonData.length, 5); i++) {
            const row = jsonData[i] as unknown[];
            const { format: fmt } = parseDate(row[dateIdx]);
            if (fmt) {
              detectedDateFormat = fmt;
              break;
            }
          }
          
          const rows: ImportRow[] = [];
          
          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i] as unknown[];
            if (!row || row.length === 0) continue;
            
            const errors: string[] = [];
            
            // Parse date
            const { date } = parseDate(row[dateIdx]);
            if (!date) {
              errors.push('Invalid date format');
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
            
            rows.push({
              date: date ? format(date, 'yyyy-MM-dd') : '',
              label,
              value: value ?? 0,
              category,
              isValid: errors.length === 0,
              errors,
            });
          }
          
          const hasErrors = rows.some(r => !r.isValid);
          
          resolve({ rows, hasErrors, hasDuplicates: false });
        } catch (err) {
          reject(err);
        }
      };
      
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  }, []);

  const checkDuplicates = useCallback(async (rows: ImportRow[]): Promise<ImportRow[]> => {
    if (!user) return rows;
    
    // Fetch existing transactions
    const { data: existing } = await supabase
      .from('transactions')
      .select('payment_date, original_label, amount')
      .eq('user_id', user.id);
    
    if (!existing) return rows;
    
    const existingSet = new Set(
      existing.map(t => `${t.payment_date}|${t.original_label}|${t.amount}`)
    );
    
    return rows.map(row => ({
      ...row,
      isDuplicate: existingSet.has(`${row.date}|${row.label}|${row.value}`)
    }));
  }, [user]);

  const importTransactions = useCallback(async (
    rows: ImportRow[],
    filename: string,
    categoryMap: Record<string, string> // category name -> category id
  ) => {
    if (!user) return { error: 'Not authenticated' };
    
    setLoading(true);
    
    try {
      // Create import batch
      const { data: batch, error: batchError } = await supabase
        .from('import_batches')
        .insert({
          user_id: user.id,
          filename,
          row_count: rows.length
        })
        .select()
        .single();
      
      if (batchError) throw batchError;
      
      // Prepare transactions
      const transactions = rows
        .filter(r => r.isValid && !r.isDuplicate)
        .map(row => ({
          user_id: user.id,
          import_batch_id: batch.id,
          payment_date: row.date,
          original_label: row.label,
          amount: row.value,
          original_category: row.category || null,
          category_id: row.category && categoryMap[row.category] ? categoryMap[row.category] : null
        }));
      
      if (transactions.length > 0) {
        const { error: insertError } = await supabase
          .from('transactions')
          .insert(transactions);
        
        if (insertError) throw insertError;
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
      .select('*')
      .eq('user_id', user.id)
      .order('imported_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching import batches:', error);
    } else {
      setImportBatches(data || []);
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

  const generateTemplate = useCallback(() => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['date', 'label', 'value', 'category'],
      ['2024-01-15', 'Grocery shopping', '-85.50', 'Food'],
      ['2024-01-16', 'Monthly salary', '3500.00', 'Income'],
      ['2024-01-17', 'Electric bill', '-120.00', 'Utilities'],
    ]);
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
    
    XLSX.writeFile(wb, 'fintrack-import-template.xlsx');
  }, []);

  return {
    loading,
    importBatches,
    parseFile,
    checkDuplicates,
    importTransactions,
    fetchImportBatches,
    deleteImportBatch,
    generateTemplate,
  };
}
