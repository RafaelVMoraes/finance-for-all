import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/i18n/I18nProvider';

const HCAPTCHA_SITEKEY = import.meta.env.VITE_HCAPTCHA_SITE_KEY;

declare global {
  interface Window {
    hcaptcha?: {
      render: (container: HTMLElement, params: {
        sitekey: string;
        callback: (token: string) => void;
        'expired-callback': () => void;
        'error-callback': () => void;
      }) => string | number;
      reset: (widgetId?: string | number) => void;
      remove: (widgetId: string | number) => void;
    };
  }
}

function HCaptchaWidget({
  siteKey,
  onVerify,
  onExpire,
  onError,
}: {
  siteKey: string;
  onVerify: (token: string) => void;
  onExpire: () => void;
  onError: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | number>();

  useEffect(() => {
    if (!siteKey || !containerRef.current) {
      return;
    }

    const renderWidget = () => {
      if (!containerRef.current || !window.hcaptcha) {
        return;
      }

      if (widgetIdRef.current !== undefined) {
        window.hcaptcha.remove(widgetIdRef.current);
      }

      widgetIdRef.current = window.hcaptcha.render(containerRef.current, {
        sitekey: siteKey,
        callback: onVerify,
        'expired-callback': onExpire,
        'error-callback': onError,
      });
    };

    const existingScript = document.querySelector('script[data-hcaptcha-script="true"]');
    if (existingScript) {
      renderWidget();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://js.hcaptcha.com/1/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.dataset.hcaptchaScript = 'true';
    script.onload = renderWidget;
    script.onerror = onError;
    document.body.appendChild(script);

    return () => {
      if (widgetIdRef.current !== undefined && window.hcaptcha) {
        window.hcaptcha.remove(widgetIdRef.current);
      }
    };
  }, [siteKey, onVerify, onExpire, onError]);

  return <div className="hcaptcha-container" ref={containerRef} />;
}

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string>();
  const [captchaResetKey, setCaptchaResetKey] = useState(0);
  const { user, login, signup } = useAuthContext();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useI18n();

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const [forgotMode, setForgotMode] = useState(false);

  const handleCaptchaError = useCallback(() => {
    setCaptchaToken(undefined);
    toast({
      variant: 'destructive',
      title: t('auth.errorTitle'),
      description: 'Captcha failed to load. Please refresh and try again.',
    });
  }, [t, toast]);

  const handleForgotPassword = async () => {
    if (!email) {
      toast({ variant: 'destructive', title: t('auth.errorTitle'), description: t('auth.emailRequired') });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      toast({ variant: 'destructive', title: t('auth.errorTitle'), description: error.message });
    } else {
      toast({ title: t('auth.resetEmailSent'), description: t('auth.resetEmailSentDescription') });
      setForgotMode(false);
    }
    setLoading(false);
  };

  const handleSubmit = async (action: 'login' | 'signup') => {
    if (!HCAPTCHA_SITEKEY) {
      toast({
        variant: 'destructive',
        title: t('auth.errorTitle'),
        description: 'Missing hCaptcha site key. Set VITE_HCAPTCHA_SITE_KEY in your environment.',
      });
      return;
    }

    if (!captchaToken) {
      toast({
        variant: 'destructive',
        title: t('auth.errorTitle'),
        description: 'Please complete the captcha challenge.',
      });
      return;
    }

    setLoading(true);

    const result = action === 'login'
      ? await login(email, password, captchaToken)
      : await signup(email, password, captchaToken);

    setCaptchaToken(undefined);
    setCaptchaResetKey((prev) => prev + 1);

    if (result.error) {
      toast({
        variant: 'destructive',
        title: t('auth.errorTitle'),
        description: result.error,
      });
    } else {
      toast({
        title: action === 'login' ? t('auth.welcomeBack') : t('auth.accountCreated'),
        description: action === 'signup'
          ? t('auth.confirmEmail')
          : t('auth.redirecting'),
      });
      if (action === 'login') {
        navigate('/dashboard');
      }
    }

    setLoading(false);
  };

  const renderCaptcha = (id: string) => (
    <div className="flex justify-center">
      {HCAPTCHA_SITEKEY ? (
        <HCaptchaWidget
          key={`${id}-${captchaResetKey}`}
          siteKey={HCAPTCHA_SITEKEY}
          onVerify={(token) => setCaptchaToken(token)}
          onExpire={() => setCaptchaToken(undefined)}
          onError={handleCaptchaError}
        />
      ) : (
        <p className="text-sm text-destructive">Set VITE_HCAPTCHA_SITE_KEY to enable sign in and sign up.</p>
      )}
    </div>
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">{t('common.appName')}</CardTitle>
          <CardDescription>{t('auth.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">{t('auth.login')}</TabsTrigger>
              <TabsTrigger value="signup">{t('auth.signUp')}</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email">{t('auth.email')}</Label>
                <Input id="login-email" type="email" placeholder={t('auth.emailPlaceholder')} value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password">{t('auth.password')}</Label>
                <Input id="login-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              {!forgotMode && renderCaptcha('login-captcha')}
              {forgotMode ? (
                <>
                  <Button className="w-full" onClick={handleForgotPassword} disabled={loading}>
                    {loading ? t('common.loading') : t('auth.sendResetLink')}
                  </Button>
                  <Button variant="ghost" className="w-full" onClick={() => setForgotMode(false)}>
                    {t('auth.backToLogin')}
                  </Button>
                </>
              ) : (
                <>
                  <Button className="w-full" onClick={() => handleSubmit('login')} disabled={loading || !captchaToken || !HCAPTCHA_SITEKEY}>
                    {loading ? t('auth.signingIn') : t('auth.signIn')}
                  </Button>
                  <Button variant="link" className="w-full" onClick={() => setForgotMode(true)}>
                    {t('auth.forgotPassword')}
                  </Button>
                </>
              )}
            </TabsContent>

            <TabsContent value="signup" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signup-email">{t('auth.email')}</Label>
                <Input id="signup-email" type="email" placeholder={t('auth.emailPlaceholder')} value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-password">{t('auth.password')}</Label>
                <Input id="signup-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              {renderCaptcha('signup-captcha')}
              <Button className="w-full" onClick={() => handleSubmit('signup')} disabled={loading || !captchaToken || !HCAPTCHA_SITEKEY}>
                {loading ? t('auth.creatingAccount') : t('auth.createAccount')}
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
