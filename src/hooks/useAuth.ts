import { useState, useEffect, useCallback } from 'react';
import { User } from '@/types/finance';
import { getStorageItem, setStorageItem, removeStorageItem, STORAGE_KEYS } from '@/lib/storage';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = getStorageItem<User>(STORAGE_KEYS.USER);
    setUser(storedUser);
    setLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<{ error?: string }> => {
    // Simple localStorage-based auth (will be replaced with Supabase)
    if (!email || !password) {
      return { error: 'Email and password are required' };
    }
    
    if (password.length < 6) {
      return { error: 'Password must be at least 6 characters' };
    }

    const newUser: User = {
      id: crypto.randomUUID(),
      email,
    };
    
    setStorageItem(STORAGE_KEYS.USER, newUser);
    setUser(newUser);
    return {};
  }, []);

  const signup = useCallback(async (email: string, password: string): Promise<{ error?: string }> => {
    return login(email, password);
  }, [login]);

  const logout = useCallback(() => {
    removeStorageItem(STORAGE_KEYS.USER);
    setUser(null);
  }, []);

  return { user, loading, login, signup, logout };
}
