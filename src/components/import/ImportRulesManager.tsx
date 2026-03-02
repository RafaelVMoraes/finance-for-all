import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Lightbulb, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useImportRules, useRuleSuggestions } from '@/hooks/useImportRules';
import { useCategories } from '@/hooks/useCategories';
import { RuleEditor } from './RuleEditor';
import { RuleList } from './RuleList';
import { RuleSuggestions } from './RuleSuggestions';
import { ImportRule, RuleSuggestion, RuleCondition, RuleActions } from '@/types/importRules';
import { ImportRow } from '@/hooks/useImport';

interface ImportRulesManagerProps {
  open: boolean;
  onClose: () => void;
  importRows?: ImportRow[];
}

export function ImportRulesManager({ open, onClose, importRows }: ImportRulesManagerProps) {
  const [editingRule, setEditingRule] = useState<ImportRule | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [dismissedSuggestions, setDismissedSuggestions] = useState<number[]>([]);
  
  const { toast } = useToast();
  const { rules, loading, createRule, updateRule, deleteRule, toggleRule } = useImportRules();
  const {
    suggestions,
    loading: suggestionsLoading,
    progress: suggestionsProgress,
    progressMessage: suggestionsProgressMessage,
    generateSuggestions,
    clearSuggestions,
  } = useRuleSuggestions();
  const { activeCategories } = useCategories();

  const handleCreateRule = useCallback(async (input: {
    name: string;
    priority: number;
    enabled: boolean;
    conditions: RuleCondition[];
    actions: RuleActions;
  }) => {
    const result = await createRule(input);
    if (result.error) {
      toast({
        variant: 'destructive',
        title: 'Failed to create rule',
        description: result.error,
      });
      return { error: result.error };
    }
    toast({
      title: 'Rule created',
      description: `Rule "${input.name}" has been created`,
    });
    return {};
  }, [createRule, toast]);

  const handleUpdateRule = useCallback(async (input: {
    name: string;
    priority: number;
    enabled: boolean;
    conditions: RuleCondition[];
    actions: RuleActions;
  }) => {
    if (!editingRule) return { error: 'No rule selected' };
    
    const result = await updateRule(editingRule.id, input);
    if (result.error) {
      toast({
        variant: 'destructive',
        title: 'Failed to update rule',
        description: result.error,
      });
      return { error: result.error };
    }
    toast({
      title: 'Rule updated',
      description: `Rule "${input.name}" has been updated`,
    });
    return {};
  }, [editingRule, updateRule, toast]);

  const handleDeleteRule = useCallback(async (ruleId: string) => {
    const result = await deleteRule(ruleId);
    if (result.error) {
      toast({
        variant: 'destructive',
        title: 'Failed to delete rule',
        description: result.error,
      });
    } else {
      toast({
        title: 'Rule deleted',
      });
    }
    setDeleteConfirmId(null);
  }, [deleteRule, toast]);

  const handleToggleRule = useCallback(async (ruleId: string, enabled: boolean) => {
    const result = await toggleRule(ruleId, enabled);
    if (result.error) {
      toast({
        variant: 'destructive',
        title: 'Failed to toggle rule',
        description: result.error,
      });
    }
  }, [toggleRule, toast]);

  const handleUpdatePriority = useCallback(async (ruleId: string, newPriority: number) => {
    const result = await updateRule(ruleId, { priority: newPriority });
    if (result.error) {
      toast({
        variant: 'destructive',
        title: 'Failed to update priority',
        description: result.error,
      });
    }
  }, [updateRule, toast]);

  const handleGenerateSuggestions = useCallback(async () => {
    if (!importRows || importRows.length === 0) {
      // Use existing transactions if no import rows
      toast({
        title: 'Analyzing patterns...',
        description: 'Looking for common patterns in your data',
      });
    }
    
    const rows = importRows?.map(r => ({
      label: r.label,
      value: r.value,
      category: r.category,
    })) || [];
    
    setShowSuggestions(true);
    setDismissedSuggestions([]);
    await generateSuggestions(rows, activeCategories, rules);
  }, [importRows, activeCategories, rules, generateSuggestions, toast]);

  const handleCreateFromSuggestion = useCallback((suggestion: RuleSuggestion) => {
    // Pre-populate the editor with suggestion data
    const conditions: RuleCondition[] = [];
    
    if (suggestion.type === 'label' && suggestion.label) {
      conditions.push({ type: 'label_contains', value: suggestion.label });
    }
    
    if (suggestion.type === 'value_range') {
      if (suggestion.valueSign) {
        conditions.push({ type: 'value_sign', value: suggestion.valueSign });
      }
      if (suggestion.valueMin !== undefined) {
        conditions.push({ type: 'value_min', value: suggestion.valueMin });
      }
      if (suggestion.valueMax !== undefined) {
        conditions.push({ type: 'value_max', value: suggestion.valueMax });
      }
    }
    
    const actions: RuleActions = {};
    if (suggestion.suggestedCategoryId) {
      actions.category_id = suggestion.suggestedCategoryId;
    }
    
    // Create a temporary rule object for the editor
    const tempRule: ImportRule = {
      id: '',
      user_id: '',
      name: suggestion.label 
        ? `Auto-categorize "${suggestion.label}"` 
        : `Auto-categorize ${suggestion.valueSign || 'transactions'}`,
      priority: 0,
      enabled: true,
      conditions,
      actions,
      times_applied: 0,
      last_applied_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    
    setEditingRule(tempRule);
    setShowEditor(true);
  }, []);

  const handleDismissSuggestion = useCallback((index: number) => {
    setDismissedSuggestions(prev => [...prev, index]);
  }, []);

  const filteredSuggestions = suggestions.filter((_, i) => !dismissedSuggestions.includes(i));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Import Rules
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden">
          <Tabs defaultValue="rules" className="h-full flex flex-col">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="rules">Rules ({rules.length})</TabsTrigger>
              <TabsTrigger value="suggestions">
                Suggestions {filteredSuggestions.length > 0 && `(${filteredSuggestions.length})`}
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="rules" className="flex-1 overflow-hidden mt-4">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-muted-foreground">
                    Rules are evaluated in priority order. First matching rule wins.
                  </p>
                  <Button onClick={() => { setEditingRule(null); setShowEditor(true); }}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Rule
                  </Button>
                </div>
                
                <RuleList
                  rules={rules}
                  categories={activeCategories}
                  onEdit={(rule) => { setEditingRule(rule); setShowEditor(true); }}
                  onDelete={(id) => setDeleteConfirmId(id)}
                  onToggle={handleToggleRule}
                  onUpdatePriority={handleUpdatePriority}
                />
              </div>
            </TabsContent>
            
            <TabsContent value="suggestions" className="flex-1 overflow-hidden mt-4">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-muted-foreground">
                    Get rule suggestions based on your transaction patterns.
                  </p>
                  <Button onClick={handleGenerateSuggestions} disabled={suggestionsLoading}>
                    <Lightbulb className="mr-2 h-4 w-4" />
                    {suggestionsLoading ? 'Analyzing...' : 'Generate Suggestions'}
                  </Button>
                </div>
                
                {showSuggestions ? (
                  <RuleSuggestions
                    suggestions={filteredSuggestions}
                    loading={suggestionsLoading}
                    progress={suggestionsProgress}
                    progressMessage={suggestionsProgressMessage}
                    onCreateFromSuggestion={handleCreateFromSuggestion}
                    onDismiss={handleDismissSuggestion}
                    onClose={() => { setShowSuggestions(false); clearSuggestions(); }}
                  />
                ) : (
                  <Card className="border-dashed">
                    <CardContent className="py-12 text-center">
                      <Lightbulb className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                      <h3 className="text-lg font-medium">Get Smart Suggestions</h3>
                      <p className="text-sm text-muted-foreground mt-1 mb-4">
                        Analyze your transaction patterns to discover rules that could save you time.
                      </p>
                      <Button variant="outline" onClick={handleGenerateSuggestions}>
                        <Lightbulb className="mr-2 h-4 w-4" />
                        Generate Suggestions
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
      
      {/* Rule Editor */}
      {showEditor && (
        <RuleEditor
          rule={editingRule?.id ? editingRule : undefined}
          categories={activeCategories}
          onSave={editingRule?.id ? handleUpdateRule : handleCreateRule}
          onClose={() => { setShowEditor(false); setEditingRule(null); }}
          open={showEditor}
        />
      )}
      
      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Rule?</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            This action cannot be undone. The rule will be permanently deleted.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => deleteConfirmId && handleDeleteRule(deleteConfirmId)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
