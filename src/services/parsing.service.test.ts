import { describe, expect, it } from 'vitest';
import { normalizeAmount, normalizeDate, parseTransactionsFromText } from './parsing.service';

describe('parsing.service', () => {
  it('parses a structured statement text', () => {
    const rows = parseTransactionsFromText('2026-01-02 Grocery Store -45.67\n2026-01-03 Salary 3000.00');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ date: '2026-01-02', amount: -45.67 });
  });

  it('ignores header/footer noise and appends multiline descriptions', () => {
    const text = 'Statement\n02/01/2026 Airline Ticket -199.99\nRef 12345\nClosing balance';
    const rows = parseTransactionsFromText(text);
    expect(rows).toHaveLength(1);
    expect(rows[0].description).toContain('Ref 12345');
  });

  it('normalizes US and FR amounts', () => {
    expect(normalizeAmount('1 234,56')).toBe(1234.56);
    expect(normalizeAmount('-1,234.56')).toBe(-1234.56);
  });

  it('normalizes ambiguous dates using day-first default', () => {
    expect(normalizeDate('13/01/2026')).toBe('2026-01-13');
    expect(normalizeDate('02/01/2026')).toBe('2026-01-02');
  });

  it('supports multiline transaction descriptions', () => {
    const rows = parseTransactionsFromText('01/02/2026 Hotel stay -120.00\nsecond line details');
    expect(rows[0].description).toContain('second line details');
  });
});
