import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthContext } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/i18n/I18nProvider';


export function DeleteAccountDialog() {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, logout } = useAuthContext();
  const { toast } = useToast();
  const { t } = useI18n();
  const confirmationText = t('deleteAccount.confirm').toUpperCase();

  const isConfirmed = confirmText === confirmationText;

  const handleDelete = async () => {
    if (!user || !isConfirmed) return;
    
    setLoading(true);
    
    try {
      // Delete all user data in order (respecting foreign keys)
      // Note: monthly_category_summary and monthly_totals are trigger-managed
      // and will be cleaned up when transactions are deleted
      
      // 1. Delete investment snapshots (via investments)
      const { data: investments } = await supabase
        .from('investments')
        .select('id')
        .eq('user_id', user.id);
      
      if (investments && investments.length > 0) {
        const investmentIds = investments.map(i => i.id);
        await supabase
          .from('investment_snapshots')
          .delete()
          .in('investment_id', investmentIds);
      }
      
      // 3. Delete investments
      await supabase.from('investments').delete().eq('user_id', user.id);
      
      // 4. Delete investment types
      await supabase.from('investment_types').delete().eq('user_id', user.id);
      
      // 5. Delete transactions
      await supabase.from('transactions').delete().eq('user_id', user.id);
      
      // 6. Delete import rule matches and rules
      await supabase.from('import_rule_matches').delete().eq('user_id', user.id);
      await supabase.from('import_rules').delete().eq('user_id', user.id);
      
      // 7. Delete import batches and sources
      await supabase.from('import_batches').delete().eq('user_id', user.id);
      await supabase.from('import_sources').delete().eq('user_id', user.id);
      
      // 8. Delete budgets
      await supabase.from('budgets').delete().eq('user_id', user.id);
      
      // 9. Delete monthly settings
      await supabase.from('monthly_settings').delete().eq('user_id', user.id);
      
      // 10. Delete exchange rates
      await supabase.from('exchange_rates').delete().eq('user_id', user.id);
      
      // 11. Delete categories
      await supabase.from('categories').delete().eq('user_id', user.id);
      
      // 12. Delete user settings
      await supabase.from('user_settings').delete().eq('user_id', user.id);
      
      // 13. Delete profile
      await supabase.from('profiles').delete().eq('id', user.id);
      
      toast({
        title: t('deleteAccount.successTitle'),
        description: t('deleteAccount.successDescription'),
      });
      
      // Logout after deletion
      await logout();
      
    } catch (error) {
      console.error('[ACCOUNT_DELETE_ERR]', error instanceof Error ? error.message : 'Unknown error');
      toast({
        variant: 'destructive',
        title: t('auth.errorTitle'),
        description: t('deleteAccount.errorDescription'),
      });
    } finally {
      setLoading(false);
      setOpen(false);
      setConfirmText('');
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" className="w-full justify-start gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive">
          <Trash2 className="h-4 w-4" />
          {t('deleteAccount.button')}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-destructive">{t('deleteAccount.title')}</AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>
              {t('deleteAccount.description')}
            </p>
            <ul className="list-inside list-disc space-y-1 text-sm">
              <li>{t('deleteAccount.consequenceTransactions')}</li>
              <li>{t('deleteAccount.consequenceCategories')}</li>
              <li>{t('deleteAccount.consequenceInvestments')}</li>
              <li>{t('deleteAccount.consequenceRules')}</li>
              
            </ul>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2 py-4">
          <Label htmlFor="confirm-delete">
            {t('deleteAccount.confirmLabel', { text: confirmationText })}
          </Label>
          <Input
            id="confirm-delete"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={t('deleteAccount.placeholder')}
            className="font-mono"
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setConfirmText('')}>{t('deleteAccount.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={!isConfirmed || loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? t('deleteAccount.deleting') : t('deleteAccount.confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
