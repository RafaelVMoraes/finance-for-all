export interface Transaction {
  date: string;
  description: string;
  amount: number;
}

// ── Month name maps (add more languages as needed) ──────────────────────────

const MONTH_NAMES: Record<string, number> = {
  // English
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  // Portuguese
  janeiro: 1, fevereiro: 2, março: 3, marco: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
  // Portuguese abbreviated (Revolut style: "out.", "dez.", etc.)
  fev: 2, abr: 4, mai: 5, ago: 8, set: 9, out: 10, dez: 12,
  // French
  janvier: 1, février: 2, fevrier: 2, mars: 3, avril: 4, mai2: 5, juin: 6,
  juillet: 7, août: 8, aout: 8, septembre: 9, octobre: 10, novembre: 11, décembre: 12, decembre: 12,
  // French abbreviated
  janv: 1, févr: 2, fevr: 2, avr: 4, juil: 7, aoû: 8, sept: 9, déc: 12,
};

// Fix: "mai" is shared by PT and FR
MONTH_NAMES['mai'] = 5;

// ── Date parsing ────────────────────────────────────────────────────────────

// Numeric: dd/mm/yyyy, dd-mm-yyyy, yyyy-mm-dd, mm/dd/yyyy
const NUMERIC_DATE_REGEX = /\b(\d{4}-\d{2}-\d{2})\b|\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/;

// Named-month: "30 de out. de 2025", "7 décembre 2025", "Jan 15, 2026", etc.
// Captures: (day) (month-word) (year) — flexible separators
const NAMED_DATE_REGEX = /\b(\d{1,2})\s+(?:de\s+)?([a-zçéûôàèêë]+)\.?\s+(?:de\s+)?(\d{4})\b/i;

// Also handle "Month day, year" (English)
const NAMED_DATE_EN_REGEX = /\b([a-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})\b/i;

function parseMonthName(name: string): number | null {
  const key = name.toLowerCase().replace(/\./g, '');
  return MONTH_NAMES[key] ?? null;
}

export function normalizeDate(value: string, preferDayFirst = true): string {
  const trimmed = value.trim();

  // Try ISO format first
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  // Try named-month format: "30 de out. de 2025" or "7 décembre 2025"
  const namedMatch = trimmed.match(NAMED_DATE_REGEX);
  if (namedMatch) {
    const day = parseInt(namedMatch[1], 10);
    const month = parseMonthName(namedMatch[2]);
    const year = parseInt(namedMatch[3], 10);
    if (month && day >= 1 && day <= 31 && year > 1900) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // Try English named-month: "Jan 15, 2026"
  const enMatch = trimmed.match(NAMED_DATE_EN_REGEX);
  if (enMatch) {
    const month = parseMonthName(enMatch[1]);
    const day = parseInt(enMatch[2], 10);
    const year = parseInt(enMatch[3], 10);
    if (month && day >= 1 && day <= 31 && year > 1900) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // Try numeric formats
  const numericMatch = trimmed.match(NUMERIC_DATE_REGEX);
  if (!numericMatch) return '';

  if (numericMatch[1]) return numericMatch[1]; // yyyy-mm-dd

  const a = parseInt(numericMatch[2], 10);
  const b = parseInt(numericMatch[3], 10);
  const year = parseInt(numericMatch[4], 10);

  let day: number, month: number;
  if (a > 12) { day = a; month = b; }
  else if (b > 12) { day = b; month = a; }
  else if (preferDayFirst) { day = a; month = b; }
  else { day = b; month = a; }

  if (!year || !month || !day) return '';
  const iso = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.getUTCDate() !== day || date.getUTCMonth() + 1 !== month) return '';
  return iso;
}

// ── Amount parsing ──────────────────────────────────────────────────────────

// Matches amounts like: €0.10, -€400.00, 100,00, 1.234,56, (500.00)
const AMOUNT_REGEX = /[€$£R]?\s*[-+]?\(?\d{1,3}(?:[\s.,]\d{3})*(?:[.,]\d{2})\)?|[-+]?\(?\d+[.,]\d{2}\)?/g;

export function normalizeAmount(value: string): number {
  let text = value.trim();
  const isNegative = text.startsWith('-') || /\(.*\)/.test(text);
  text = text.replace(/[()€$£R\s\u00A0]/g, '');

  const lastComma = text.lastIndexOf(',');
  const lastDot = text.lastIndexOf('.');

  if (lastComma > lastDot) {
    text = text.replace(/\./g, '').replace(/,/g, '.');
  } else if (lastDot > lastComma) {
    text = text.replace(/,/g, '');
  } else if (lastComma !== -1) {
    text = text.replace(',', '.');
  }

  const parsed = Number.parseFloat(text.replace(/[^\d.-]/g, ''));
  if (Number.isNaN(parsed)) return Number.NaN;
  return isNegative ? -Math.abs(parsed) : parsed;
}

// ── Noise detection ─────────────────────────────────────────────────────────

const NOISE_PATTERNS = [
  /statement/i,
  /account\s*number/i,
  /closing\s*balance/i,
  /^balance\b/i,
  /^total\b/i,
  /opening\s*balance/i,
  /page\s*\d+/i,
  /saldo\s*inicial/i,
  /saldo\s*final/i,
  /resumo\s*do\s*saldo/i,
  /valores\s*descontados/i,
  /valores\s*recebidos/i,
  /^\s*produto\b/i,
  /^\s*data\b.*descri/i,
  /conta\s*\(conta\s*corrente\)/i,
  /IBAN\s+[A-Z]{2}/i,
  /extrato\s+em\s+/i,
  /gerado\s+em\s+/i,
  /página\s+\d/i,
  /informe\s+perda/i,
  /revolut\s+bank/i,
  /©\s*\d{4}/i,
];

function isNoise(line: string): boolean {
  return NOISE_PATTERNS.some((pattern) => pattern.test(line));
}

// ── Date detection in a line ────────────────────────────────────────────────

function extractDate(line: string): string | null {
  // Try named-month patterns first
  const namedMatch = line.match(NAMED_DATE_REGEX);
  if (namedMatch) {
    const result = normalizeDate(namedMatch[0]);
    if (result) return result;
  }

  const enMatch = line.match(NAMED_DATE_EN_REGEX);
  if (enMatch) {
    const result = normalizeDate(enMatch[0]);
    if (result) return result;
  }

  // Try numeric
  const numericMatch = line.match(NUMERIC_DATE_REGEX);
  if (numericMatch) {
    return normalizeDate(numericMatch[0]);
  }

  return null;
}

function extractAmounts(line: string): string[] {
  const matches = line.match(AMOUNT_REGEX);
  if (!matches) return [];
  return matches.filter(m => {
    const cleaned = m.replace(/[€$£R\s]/g, '');
    if (cleaned.length === 0) return false;
    // Skip amounts that are directly part of a card mask (e.g., *6716)
    const idx = line.indexOf(m);
    const charBefore = idx > 0 ? line[idx - 1] : '';
    const charAfter = idx + m.length < line.length ? line[idx + m.length] : '';
    if (charBefore === '*' || charAfter === '*') return false;
    return true;
  });
}

// ── Main parser ─────────────────────────────────────────────────────────────

export function isTransactionLine(line: string): boolean {
  return extractDate(line) !== null && extractAmounts(line).length > 0;
}

export function parseTransactionsFromText(rawText: string): Transaction[] {
  const normalizedText = rawText
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();

  const lines = normalizedText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !isNoise(line));

  const parsed: Transaction[] = [];
  let previousTransaction: Transaction | null = null;

  for (const line of lines) {
    const date = extractDate(line);
    const amounts = extractAmounts(line);

    if (!date || amounts.length === 0) {
      // Continuation line — append to previous transaction description
      if (previousTransaction && line.length > 2) {
        // Skip card numbers, references, IBANs in description
        if (!/^Cartão:/i.test(line) && !/^De:/i.test(line) && !/^Para:/i.test(line) && !/^Referência:/i.test(line)) {
          previousTransaction.description = `${previousTransaction.description} ${line}`.trim();
        }
      }
      continue;
    }

    // For bank statements: prefer the first non-balance amount
    // In Revolut statements, columns are: description | debit | credit | balance
    // The last amount is typically the balance — skip it if there are multiple
    let amountStr: string;
    if (amounts.length >= 2) {
      // Use the first amount (debit or credit), not the balance
      amountStr = amounts[0];
    } else {
      amountStr = amounts[0];
    }

    const amount = normalizeAmount(amountStr);

    if (Number.isNaN(amount)) {
      console.warn('[PDF_PARSE_INVALID]', { line, date, amount: amountStr });
      continue;
    }

    // Build description by removing date and amount strings from the line
    let description = line;
    // Remove the date portion (named dates can be long like "30 de out. de 2025")
    const namedMatch = line.match(NAMED_DATE_REGEX);
    if (namedMatch) {
      description = description.replace(namedMatch[0], '');
    } else {
      const numMatch = line.match(NUMERIC_DATE_REGEX);
      if (numMatch) description = description.replace(numMatch[0], '');
    }
    // Remove all amount occurrences
    for (const amt of amounts) {
      description = description.replace(amt, '');
    }
    description = description.replace(/[€$£]/g, '').replace(/\s+/g, ' ').trim();

    // Determine sign: in Revolut, "Valores descontados" = expense (negative)
    // If amount is positive and it appears in the debit column context, negate it
    // Heuristic: if there's a second amount (credit column) and first is debit,
    // mark first as negative. But with extracted text, column positions aren't reliable.
    // So we keep the amount as-is and let the user handle sign in the import review.

    const current: Transaction = { date, description, amount: -Math.abs(amount) };

    // Check if there's a credit amount too (second amount before balance)
    if (amounts.length >= 3) {
      // 3 amounts: debit, credit, balance
      const debit = normalizeAmount(amounts[0]);
      const credit = normalizeAmount(amounts[1]);
      if (!Number.isNaN(credit) && credit > 0 && (Number.isNaN(debit) || debit === 0)) {
        current.amount = Math.abs(credit);
      } else if (!Number.isNaN(debit) && debit > 0) {
        current.amount = -Math.abs(debit);
      }
    } else if (amounts.length === 2) {
      // Could be: debit + balance, or credit + balance
      // If description suggests income/deposit, make positive
      const incomeKeywords = /depósito|transferência recebida|pagamento recebido|received|deposit|income|salary|virement/i;
      if (incomeKeywords.test(line)) {
        current.amount = Math.abs(amount);
      }
    }

    parsed.push(current);
    previousTransaction = current;
  }

  // Deduplicate
  const deduped = new Map<string, Transaction>();
  for (const entry of parsed) {
    if (!entry.date || Number.isNaN(entry.amount)) continue;
    const key = `${entry.date}|${entry.amount}|${entry.description.toLowerCase()}`;
    if (!deduped.has(key)) {
      deduped.set(key, entry);
    }
  }

  return Array.from(deduped.values());
}
