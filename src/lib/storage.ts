// LocalStorage wrapper for data persistence

const STORAGE_KEYS = {
  USER: 'fintrack_user',
  TRANSACTIONS: 'fintrack_transactions',
  CATEGORIES: 'fintrack_categories',
  BUDGETS: 'fintrack_budgets',
  MONTHLY_SETTINGS: 'fintrack_monthly_settings',
  INVESTMENTS: 'fintrack_investments',
  INVESTMENT_SNAPSHOTS: 'fintrack_investment_snapshots',
} as const;

export function getStorageItem<T>(key: string): T | null {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  } catch {
    return null;
  }
}

export function setStorageItem<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function removeStorageItem(key: string): void {
  localStorage.removeItem(key);
}

export { STORAGE_KEYS };
