// Global app constants

// Earliest allowed date in the app - no data before this
export const APP_START_DATE = new Date('2025-09-01');
export const APP_START_DATE_STRING = '2025-09-01';

// Validate if a date is within the allowed range
export function isDateAllowed(date: Date | string): boolean {
  const checkDate = typeof date === 'string' ? new Date(date) : date;
  return checkDate >= APP_START_DATE;
}

// Get the earliest allowed date for date inputs
export function getMinDate(): string {
  return APP_START_DATE_STRING;
}
