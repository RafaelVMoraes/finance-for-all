import { useState, useEffect, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { emailSchema, passwordSchema } from '@/lib/authValidation';

interface AuthUser {
  id: string;
  email: string;
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ? { id: session.user.id, email: session.user.email || '' } : null);
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ? { id: session.user.id, email: session.user.email || '' } : null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = useCallback(async (email: string, password: string, captchaToken?: string): Promise<{ error?: string }> => {
    if (!email || !password) {
      return { error: 'Email and password are required' };
    }
    
    const emailResult = emailSchema.safeParse(email);
    if (!emailResult.success) {
      return { error: emailResult.error.errors[0].message };
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: emailResult.data,
      password,
      options: { captchaToken },
    });

    if (error) {
      return { error: error.message };
    }

    return {};
  }, []);

  const signup = useCallback(async (email: string, password: string, captchaToken?: string): Promise<{ error?: string }> => {
    if (!email || !password) {
      return { error: 'Email and password are required' };
    }
    
    const emailResult = emailSchema.safeParse(email);
    if (!emailResult.success) {
      return { error: emailResult.error.errors[0].message };
    }
    
    const passwordResult = passwordSchema.safeParse(password);
    if (!passwordResult.success) {
      return { error: passwordResult.error.errors[0].message };
    }

    const redirectUrl = `${window.location.origin}/`;

    const { error } = await supabase.auth.signUp({
      email: emailResult.data,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        captchaToken,
      },
    });

    if (error) {
      return { error: error.message };
    }

    return {};
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  }, []);

  return { user, session, loading, login, signup, logout };
}
