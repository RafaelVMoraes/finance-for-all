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

const CONFIRMATION_TEXT = 'DELETE MY ACCOUNT';

export function DeleteAccountDialog() {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, logout } = useAuthContext();
  const { toast } = useToast();

  const isConfirmed = confirmText === CONFIRMATION_TEXT;

  const handleDelete = async () => {
    if (!user || !isConfirmed) return;
    
    setLoading(true);
    
    try {
      // Delete all user data in order (respecting foreign keys)
      
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
      
      // 2. Delete investments
      await supabase.from('investments').delete().eq('user_id', user.id);
      
      // 3. Delete transactions
      await supabase.from('transactions').delete().eq('user_id', user.id);
      
      // 4. Delete import batches
      await supabase.from('import_batches').delete().eq('user_id', user.id);
      
      // 5. Delete import sources
      await supabase.from('import_sources').delete().eq('user_id', user.id);
      
      // 6. Delete budgets
      await supabase.from('budgets').delete().eq('user_id', user.id);
      
      // 7. Delete monthly settings
      await supabase.from('monthly_settings').delete().eq('user_id', user.id);
      
      // 8. Delete categories
      await supabase.from('categories').delete().eq('user_id', user.id);
      
      // 9. Delete profile
      await supabase.from('profiles').delete().eq('id', user.id);
      
      toast({
        title: 'Account deleted',
        description: 'All your data has been permanently removed.',
      });
      
      // Logout after deletion
      await logout();
      
    } catch (error) {
      console.error('Error deleting account:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to delete account. Please try again.',
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
          Delete Account
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-destructive">Delete Account</AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>
              This action is <strong>irreversible</strong>. All your data will be permanently deleted including:
            </p>
            <ul className="list-inside list-disc space-y-1 text-sm">
              <li>All transactions</li>
              <li>All categories and budgets</li>
              <li>All investments and snapshots</li>
              <li>All import history</li>
              <li>Your account profile</li>
            </ul>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2 py-4">
          <Label htmlFor="confirm-delete">
            Type <span className="font-mono font-bold">{CONFIRMATION_TEXT}</span> to confirm:
          </Label>
          <Input
            id="confirm-delete"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={CONFIRMATION_TEXT}
            className="font-mono"
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setConfirmText('')}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={!isConfirmed || loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? 'Deleting...' : 'Delete My Account'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
