export interface Transaction {
  date: string;
  description: string;
  amount: number;
}

const DATE_REGEX = /(\b\d{4}-\d{2}-\d{2}\b|\b\d{2}[/-]\d{2}[/-]\d{4}\b)/;
const AMOUNT_REGEX = /[-+]?\(?\d{1,3}(?:[\s.,]\d{3})*(?:[.,]\d{2})\)?|[-+]?\(?\d+[.,]\d{2}\)?/;
const NOISE_PATTERNS = [
  /statement/i,
  /account\s*number/i,
  /closing\s*balance/i,
  /^balance\b/i,
  /^total\b/i,
  /opening\s*balance/i,
  /page\s*\d+/i,
];

export function normalizeAmount(value: string): number {
  let text = value.trim();
  const isNegative = text.startsWith('-') || /\(.*\)/.test(text);
  text = text.replace(/[()]/g, '').replace(/[\s\u00A0]/g, '');

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

export function normalizeDate(value: string, preferDayFirst = true): string {
  const trimmed = value.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const separator = trimmed.includes('/') ? '/' : '-';
  const parts = trimmed.split(separator).map(Number);
  if (parts.length !== 3) return '';

  let day: number;
  let month: number;
  let year: number;

  if (parts[0] > 999) {
    [year, month, day] = parts;
  } else {
    const [first, second, yyyy] = parts;
    year = yyyy;

    if (first > 12) {
      day = first;
      month = second;
    } else if (second > 12) {
      day = second;
      month = first;
    } else if (preferDayFirst) {
      day = first;
      month = second;
    } else {
      day = second;
      month = first;
    }
  }

  if (!year || !month || !day) return '';
  const iso = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const date = new Date(`${iso}T00:00:00Z`);

  if (Number.isNaN(date.getTime()) || date.getUTCDate() !== day || date.getUTCMonth() + 1 !== month) {
    return '';
  }

  return iso;
}

function isNoise(line: string): boolean {
  return NOISE_PATTERNS.some((pattern) => pattern.test(line));
}

export function isTransactionLine(line: string): boolean {
  return DATE_REGEX.test(line) && AMOUNT_REGEX.test(line);
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
    if (!isTransactionLine(line)) {
      if (previousTransaction) {
        previousTransaction.description = `${previousTransaction.description} ${line}`.trim();
      }
      continue;
    }

    const dateMatch = line.match(DATE_REGEX);
    const amountMatches = Array.from(line.matchAll(new RegExp(AMOUNT_REGEX, 'g')));
    const amountMatch = amountMatches.length > 0 ? amountMatches[amountMatches.length - 1] : undefined;

    if (!dateMatch || !amountMatch) {
      console.warn('[PDF_PARSE_SKIP]', line);
      continue;
    }

    const date = normalizeDate(dateMatch[0]);
    const amount = normalizeAmount(amountMatch[0]);

    if (!date || Number.isNaN(amount)) {
      console.warn('[PDF_PARSE_INVALID]', { line, date, amount: amountMatch[0] });
      continue;
    }

    const description = line
      .replace(dateMatch[0], '')
      .replace(amountMatch[0], '')
      .replace(/\s+/g, ' ')
      .trim();

    const current: Transaction = {
      date,
      description,
      amount,
    };

    parsed.push(current);
    previousTransaction = current;
  }

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
