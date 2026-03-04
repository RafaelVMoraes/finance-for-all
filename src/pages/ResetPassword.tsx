import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/i18n/I18nProvider';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useI18n();

  useEffect(() => {
    // Check for recovery event from Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecovery(true);
      }
    });

    // Also check URL hash for type=recovery
    const hash = window.location.hash;
    if (hash.includes('type=recovery')) {
      setIsRecovery(true);
    }

    return () => subscription.unsubscribe();
  }, []);

  const handleResetPassword = async () => {
    if (password !== confirmPassword) {
      toast({
        variant: 'destructive',
        title: t('auth.errorTitle'),
        description: t('auth.passwordsDoNotMatch'),
      });
      return;
    }

    if (password.length < 8) {
      toast({
        variant: 'destructive',
        title: t('auth.errorTitle'),
        description: t('auth.passwordTooShort'),
      });
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      toast({
        variant: 'destructive',
        title: t('auth.errorTitle'),
        description: error.message,
      });
    } else {
      toast({
        title: t('auth.passwordResetSuccess'),
        description: t('auth.passwordResetSuccessDescription'),
      });
      navigate('/dashboard');
    }
    setLoading(false);
  };

  if (!isRecovery) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>{t('auth.invalidResetLink')}</CardTitle>
            <CardDescription>{t('auth.invalidResetLinkDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => navigate('/auth')}>
              {t('auth.backToLogin')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>{t('auth.setNewPassword')}</CardTitle>
          <CardDescription>{t('auth.setNewPasswordDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-password">{t('auth.newPassword')}</Label>
            <Input
              id="new-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">{t('auth.confirmPassword')}</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          <Button
            className="w-full"
            onClick={handleResetPassword}
            disabled={loading || !password || !confirmPassword}
          >
            {loading ? t('common.loading') : t('auth.resetPassword')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
