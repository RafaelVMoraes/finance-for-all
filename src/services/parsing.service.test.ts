import { describe, expect, it } from 'vitest';
import { normalizeAmount, normalizeDate, parseTransactionsFromText } from './parsing.service';

describe('normalizeDate', () => {
  it('handles ISO format', () => {
    expect(normalizeDate('2025-10-30')).toBe('2025-10-30');
  });

  it('handles dd/mm/yyyy', () => {
    expect(normalizeDate('30/10/2025')).toBe('2025-10-30');
  });

  it('handles Portuguese named months', () => {
    expect(normalizeDate('30 de out. de 2025')).toBe('2025-10-30');
    expect(normalizeDate('6 de dez. de 2025')).toBe('2025-12-06');
    expect(normalizeDate('12 de jan. de 2026')).toBe('2026-01-12');
  });

  it('handles French named months', () => {
    expect(normalizeDate('15 mars 2026')).toBe('2026-03-15');
    expect(normalizeDate('7 décembre 2025')).toBe('2025-12-07');
  });
});

describe('normalizeAmount', () => {
  it('parses currency-prefixed amounts', () => {
    expect(normalizeAmount('€400.00')).toBe(400);
    expect(normalizeAmount('€0.10')).toBe(0.1);
  });

  it('parses European comma decimal', () => {
    expect(normalizeAmount('1.234,56')).toBe(1234.56);
  });

  it('parses negative amounts', () => {
    expect(normalizeAmount('-100.00')).toBe(-100);
    expect(normalizeAmount('(50.00)')).toBe(-50);
  });
});

describe('parseTransactionsFromText', () => {
  it('parses Revolut PT bank statement', () => {
    const text = `
30 de out. de 2025 Mend's €0.10 €32.51
6 de dez. de 2025 Depósito via Apple Pay do cartão *6716 €400.00 €432.51
24 de dez. de 2025 Transferência recebida de MAXIME €90.00 €457.76
12 de jan. de 2026 To Rafael Vazquez Moraes €100.00 €0.00
    `;
    const txns = parseTransactionsFromText(text);
    expect(txns.length).toBe(4);
    expect(txns[0].date).toBe('2025-10-30');
    expect(txns[0].amount).toBe(-0.1);
    expect(txns[1].amount).toBe(400); // deposit = positive
    expect(txns[2].amount).toBe(90); // received = positive
    expect(txns[3].amount).toBe(-100); // transfer out = negative
  });
});
