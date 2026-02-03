import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthContext } from '@/contexts/AuthContext';
import { ImportRule, RuleCondition, RuleActions, RuleSuggestion } from '@/types/importRules';
import { normalizeText } from '@/lib/ruleEngine';
import { Json } from '@/integrations/supabase/types';

interface RuleInput {
  name: string;
  priority: number;
  enabled: boolean;
  conditions: RuleCondition[];
  actions: RuleActions;
}

// Helper to parse DB row to ImportRule
function parseDbRule(row: {
  id: string;
  user_id: string;
  name: string;
  priority: number;
  enabled: boolean;
  conditions: Json;
  actions: Json;
  times_applied: number;
  last_applied_at: string | null;
  created_at: string;
  updated_at: string;
}): ImportRule {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    priority: row.priority,
    enabled: row.enabled,
    conditions: Array.isArray(row.conditions) 
      ? (row.conditions as unknown as RuleCondition[]) 
      : [],
    actions: typeof row.actions === 'object' && row.actions !== null && !Array.isArray(row.actions)
      ? (row.actions as unknown as RuleActions)
      : {},
    times_applied: row.times_applied,
    last_applied_at: row.last_applied_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function useImportRules() {
  const [rules, setRules] = useState<ImportRule[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthContext();

  const fetchRules = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    
    const { data, error } = await supabase
      .from('import_rules')
      .select('*')
      .eq('user_id', user.id)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true });
    
    if (error) {
      console.error('Error fetching rules:', error);
    } else {
      const parsedRules = (data || []).map(parseDbRule);
      setRules(parsedRules);
    }
    
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const createRule = useCallback(async (input: RuleInput) => {
    if (!user) return { error: 'Not authenticated' };
    
    const { data, error } = await supabase
      .from('import_rules')
      .insert({
        user_id: user.id,
        name: input.name,
        priority: input.priority,
        enabled: input.enabled,
        conditions: input.conditions as unknown as Json,
        actions: input.actions as unknown as Json,
      })
      .select()
      .single();
    
    if (error) {
      return { error: error.message };
    }
    
    const newRule = parseDbRule(data);
    
    setRules(prev => [...prev, newRule].sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    }));
    
    return { data: newRule };
  }, [user]);

  const updateRule = useCallback(async (id: string, input: Partial<RuleInput>) => {
    const updatePayload: Record<string, unknown> = {};
    
    if (input.name !== undefined) updatePayload.name = input.name;
    if (input.priority !== undefined) updatePayload.priority = input.priority;
    if (input.enabled !== undefined) updatePayload.enabled = input.enabled;
    if (input.conditions !== undefined) updatePayload.conditions = input.conditions as unknown as Json;
    if (input.actions !== undefined) updatePayload.actions = input.actions as unknown as Json;
    
    const { data, error } = await supabase
      .from('import_rules')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      return { error: error.message };
    }
    
    const updatedRule = parseDbRule(data);
    
    setRules(prev => prev.map(r => r.id === id ? updatedRule : r).sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    }));
    
    return { data: updatedRule };
  }, []);

  const deleteRule = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('import_rules')
      .delete()
      .eq('id', id);
    
    if (error) {
      return { error: error.message };
    }
    
    setRules(prev => prev.filter(r => r.id !== id));
    return {};
  }, []);

  const toggleRule = useCallback(async (id: string, enabled: boolean) => {
    return updateRule(id, { enabled });
  }, [updateRule]);

  const incrementRuleUsage = useCallback(async (ruleId: string) => {
    const currentRule = rules.find(r => r.id === ruleId);
    // Fire and forget - don't await
    supabase
      .from('import_rules')
      .update({ 
        times_applied: (currentRule?.times_applied ?? 0) + 1,
        last_applied_at: new Date().toISOString(),
      })
      .eq('id', ruleId)
      .then(() => {});
  }, [rules]);

  return {
    rules,
    loading,
    createRule,
    updateRule,
    deleteRule,
    toggleRule,
    incrementRuleUsage,
    refetch: fetchRules,
  };
}

// Separate hook for suggestions
export function useRuleSuggestions() {
  const [suggestions, setSuggestions] = useState<RuleSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuthContext();

  const generateSuggestions = useCallback(async (
    rows: Array<{ label: string; value: number; category?: string }>,
    existingCategories: Array<{ id: string; name: string }>,
    existingRules: ImportRule[]
  ): Promise<RuleSuggestion[]> => {
    if (!user) return [];
    
    setLoading(true);
    
    // Build frequency maps
    const labelFrequency = new Map<string, { count: number; categoryId?: string }>();
    const keywordFrequency = new Map<string, number>();
    const incomeCount = { count: 0, totalValue: 0 };
    const expenseRanges = {
      low: { count: 0, min: 0, max: 50 },
      medium: { count: 0, min: 50, max: 200 },
      high: { count: 0, min: 200, max: Infinity },
    };
    
    for (const row of rows) {
      const normalizedLabel = normalizeText(row.label);
      
      // Track full label frequency
      const existing = labelFrequency.get(normalizedLabel) || { count: 0 };
      labelFrequency.set(normalizedLabel, {
        count: existing.count + 1,
        categoryId: row.category ? existingCategories.find(c => 
          c.name.toLowerCase() === row.category?.toLowerCase()
        )?.id : existing.categoryId,
      });
      
      // Extract keywords (words with 3+ characters)
      const words = normalizedLabel.split(/\s+/).filter(w => w.length >= 3);
      for (const word of words) {
        keywordFrequency.set(word, (keywordFrequency.get(word) || 0) + 1);
      }
      
      // Track value patterns
      if (row.value > 0) {
        incomeCount.count++;
        incomeCount.totalValue += row.value;
      } else {
        const absValue = Math.abs(row.value);
        if (absValue <= 50) expenseRanges.low.count++;
        else if (absValue <= 200) expenseRanges.medium.count++;
        else expenseRanges.high.count++;
      }
    }
    
    const newSuggestions: RuleSuggestion[] = [];
    
    // Check which patterns don't already have rules
    const existingLabelPatterns = new Set(
      existingRules.flatMap(r => 
        r.conditions
          .filter(c => c.type === 'label_contains')
          .map(c => normalizeText(String(c.value)))
      )
    );
    
    // Suggest rules for frequent keywords (appearing 5+ times, not already covered)
    const sortedKeywords = Array.from(keywordFrequency.entries())
      .filter(([keyword, count]) => count >= 5 && !existingLabelPatterns.has(keyword))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    
    for (const [keyword, count] of sortedKeywords) {
      // Find most common category for rows with this keyword
      let suggestedCategory: { id: string; name: string } | undefined;
      const categoryCount = new Map<string, number>();
      
      for (const row of rows) {
        if (normalizeText(row.label).includes(keyword) && row.category) {
          const cat = existingCategories.find(c => 
            c.name.toLowerCase() === row.category?.toLowerCase()
          );
          if (cat) {
            categoryCount.set(cat.id, (categoryCount.get(cat.id) || 0) + 1);
          }
        }
      }
      
      if (categoryCount.size > 0) {
        const mostCommon = Array.from(categoryCount.entries())
          .sort((a, b) => b[1] - a[1])[0];
        suggestedCategory = existingCategories.find(c => c.id === mostCommon[0]);
      }
      
      newSuggestions.push({
        type: 'label',
        label: keyword,
        occurrences: count,
        suggestedCategoryId: suggestedCategory?.id,
        suggestedCategoryName: suggestedCategory?.name,
        reason: `Keyword "${keyword}" appears in ${count} transactions`,
      });
    }
    
    // Suggest value range rules
    if (incomeCount.count >= 10) {
      const avgIncome = incomeCount.totalValue / incomeCount.count;
      const hasIncomeRule = existingRules.some(r => 
        r.conditions.some(c => c.type === 'value_sign' && c.value === 'income')
      );
      
      if (!hasIncomeRule) {
        newSuggestions.push({
          type: 'value_range',
          valueSign: 'income',
          occurrences: incomeCount.count,
          reason: `${incomeCount.count} income transactions detected (avg: €${avgIncome.toFixed(0)})`,
        });
      }
    }
    
    setSuggestions(newSuggestions);
    setLoading(false);
    
    return newSuggestions;
  }, [user]);

  const clearSuggestions = useCallback(() => {
    setSuggestions([]);
  }, []);

  return {
    suggestions,
    loading,
    generateSuggestions,
    clearSuggestions,
  };
}
