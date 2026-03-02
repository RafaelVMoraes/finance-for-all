import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthContext } from '@/contexts/AuthContext';

export type Currency = 'EUR' | 'USD' | 'BRL';

export interface UserSettings {
  id: string;
  user_id: string;
  main_currency: Currency;
  created_at: string;
  updated_at: string;
}

export function useUserSettings() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthContext();

  const fetchSettings = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching user settings:', error);
    } else if (data) {
      setSettings(data as unknown as UserSettings);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateMainCurrency = useCallback(async (currency: Currency) => {
    if (!user) return { error: 'Not authenticated' };

    if (settings) {
      const { data, error } = await supabase
        .from('user_settings')
        .update({ main_currency: currency })
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) return { error: error.message };
      setSettings(data as unknown as UserSettings);
      return { data };
    } else {
      const { data, error } = await supabase
        .from('user_settings')
        .insert({ user_id: user.id, main_currency: currency })
        .select()
        .single();

      if (error) return { error: error.message };
      setSettings(data as unknown as UserSettings);
      return { data };
    }
  }, [user, settings]);

  const mainCurrency = (settings?.main_currency || 'EUR') as Currency;
  const currencySymbol = mainCurrency === 'BRL' ? 'R$' : mainCurrency === 'USD' ? '$' : '€';

  return {
    settings,
    mainCurrency,
    currencySymbol,
    loading,
    updateMainCurrency,
    refetch: fetchSettings,
  };
}
