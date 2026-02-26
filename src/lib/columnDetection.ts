/**
 * Auto-detect column roles from Excel headers + sample data.
 * Returns a mapping suggestion: { date, label, value, category } → column header name
 */

import { parse, isValid } from 'date-fns';
import * as XLSX from 'xlsx';

const DATE_FORMATS = [
  'yyyy-MM-dd', 'dd/MM/yyyy', 'MM/dd/yyyy', 'dd-MM-yyyy',
  'MM-dd-yyyy', 'dd.MM.yyyy', 'yyyy/MM/dd',
];

export interface ColumnMapping {
  date: string | null;
  label: string | null;
  value: string | null;
  category: string | null;
}

function isDateValue(value: unknown): boolean {
  if (!value) return false;
  if (typeof value === 'number') {
    const d = XLSX.SSF.parse_date_code(value);
    return !!d;
  }
  const str = String(value).trim();
  for (const fmt of DATE_FORMATS) {
    if (isValid(parse(str, fmt, new Date()))) return true;
  }
  const native = new Date(str);
  return isValid(native) && !isNaN(native.getTime());
}

function isNumericValue(value: unknown): boolean {
  if (value === null || value === undefined || value === '') return false;
  if (typeof value === 'number') return true;
  let str = String(value).trim().replace(/[€$£R\s]/g, '');
  // Handle comma formats
  if (str.includes(',') && str.includes('.')) {
    str = str.lastIndexOf('.') < str.lastIndexOf(',')
      ? str.replace(/\./g, '').replace(',', '.')
      : str.replace(/,/g, '');
  } else if (str.includes(',')) {
    str = str.replace(',', '.');
  }
  return !isNaN(parseFloat(str)) && isFinite(Number(str));
}

function avgStringLength(values: unknown[]): number {
  const strings = values.filter(v => v && typeof v === 'string').map(v => String(v).trim());
  if (strings.length === 0) return 0;
  return strings.reduce((sum, s) => sum + s.length, 0) / strings.length;
}

/** Known header synonyms for quick matching */
const DATE_HEADERS = ['date', 'data', 'fecha', 'datum', 'payment_date', 'transaction_date'];
const LABEL_HEADERS = ['label', 'description', 'descricao', 'descripcion', 'libelle', 'bezeichnung', 'memo', 'narration', 'details', 'transaction'];
const VALUE_HEADERS = ['value', 'amount', 'valor', 'montant', 'betrag', 'importe', 'sum', 'total', 'debit', 'credit'];
const CATEGORY_HEADERS = ['category', 'categoria', 'categorie', 'kategorie', 'type', 'tag'];

export function detectColumnMapping(
  headers: string[],
  sampleRows: unknown[][] // first ~10 data rows
): ColumnMapping {
  const mapping: ColumnMapping = { date: null, label: null, value: null, category: null };
  const used = new Set<number>();

  const normalizedHeaders = headers.map(h => h.toLowerCase().trim());

  // Pass 1: Try header name matching
  const tryHeaderMatch = (synonyms: string[], role: keyof ColumnMapping) => {
    const idx = normalizedHeaders.findIndex((h, i) => !used.has(i) && synonyms.includes(h));
    if (idx >= 0) {
      mapping[role] = headers[idx];
      used.add(idx);
    }
  };

  tryHeaderMatch(DATE_HEADERS, 'date');
  tryHeaderMatch(VALUE_HEADERS, 'value');
  tryHeaderMatch(LABEL_HEADERS, 'label');
  tryHeaderMatch(CATEGORY_HEADERS, 'category');

  // Pass 2: Heuristic analysis on sample data for unmapped roles
  const columnScores = headers.map((header, colIdx) => {
    if (used.has(colIdx)) return null;
    const values = sampleRows.map(row => row[colIdx]).filter(v => v != null);
    if (values.length === 0) return null;

    const dateRatio = values.filter(isDateValue).length / values.length;
    const numericRatio = values.filter(isNumericValue).length / values.length;
    const avgLen = avgStringLength(values);

    return { colIdx, header, dateRatio, numericRatio, avgLen };
  }).filter(Boolean) as Array<{ colIdx: number; header: string; dateRatio: number; numericRatio: number; avgLen: number }>;

  // Date: highest date ratio
  if (!mapping.date) {
    const best = columnScores
      .filter(c => c.dateRatio > 0.5)
      .sort((a, b) => b.dateRatio - a.dateRatio)[0];
    if (best) {
      mapping.date = best.header;
      used.add(best.colIdx);
    }
  }

  // Value: highest numeric ratio among remaining
  if (!mapping.value) {
    const remaining = columnScores.filter(c => !used.has(c.colIdx));
    const best = remaining
      .filter(c => c.numericRatio > 0.5)
      .sort((a, b) => b.numericRatio - a.numericRatio)[0];
    if (best) {
      mapping.value = best.header;
      used.add(best.colIdx);
    }
  }

  // Label vs Category: among remaining string columns, longer avg = label, shorter = category
  const stringCols = columnScores
    .filter(c => !used.has(c.colIdx) && c.numericRatio < 0.5 && c.dateRatio < 0.3)
    .sort((a, b) => b.avgLen - a.avgLen);

  if (!mapping.label && stringCols.length > 0) {
    mapping.label = stringCols[0].header;
    used.add(stringCols[0].colIdx);
  }
  if (!mapping.category && stringCols.length > 1) {
    mapping.category = stringCols[1].header;
    used.add(stringCols[1].colIdx);
  }

  return mapping;
}

/** Check if headers match the standard template format */
export function isTemplateFormat(headers: string[]): boolean {
  const normalized = headers.map(h => h.toLowerCase().trim());
  const hasDate = normalized.some(h => h === 'date' || h === 'data');
  const hasLabel = normalized.some(h => h === 'label' || h === 'description' || h === 'descricao');
  const hasValue = normalized.some(h => h === 'value' || h === 'amount' || h === 'valor');
  return hasDate && hasLabel && hasValue;
}
