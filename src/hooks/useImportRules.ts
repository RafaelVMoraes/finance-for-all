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
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const { user } = useAuthContext();

  const updateProgress = useCallback(async (value: number, message: string) => {
    setProgress(Math.max(0, Math.min(100, value)));
    setProgressMessage(message);
    await new Promise(resolve => setTimeout(resolve, 0));
  }, []);

  const generateSuggestions = useCallback(async (
    rows: Array<{ label: string; value: number; category?: string }>,
    existingCategories: Array<{ id: string; name: string }>,
    existingRules: ImportRule[]
  ): Promise<RuleSuggestion[]> => {
    if (!user) return [];
    
    setLoading(true);
    setProgress(0);
    setProgressMessage('Preparing analysis...');

    try {
      const labelsByWord = new Map<string, Set<string>>();
      const keywordFrequency = new Map<string, number>();
      const exactLabelFrequency = new Map<string, number>();
      const exactValueFrequency = new Map<string, { count: number; sign: 'income' | 'expense' }>();
      const categoryByName = new Map(existingCategories.map(c => [normalizeText(c.name), c]));
      const rowsByLabel: Array<{ normalizedLabel: string; categoryId?: string }> = [];

      const totalRows = rows.length || 1;
      let processedRows = 0;

      for (const row of rows) {
        const normalizedLabel = normalizeText(row.label);
        const categoryId = row.category
          ? categoryByName.get(normalizeText(row.category))?.id
          : undefined;

        rowsByLabel.push({ normalizedLabel, categoryId });
        exactLabelFrequency.set(normalizedLabel, (exactLabelFrequency.get(normalizedLabel) || 0) + 1);

        const words = normalizedLabel
          .split(/[^a-z0-9]+/)
          .filter(word => word.length >= 3 && !/^\d+$/.test(word));

        const uniqueWords = new Set(words);
        for (const word of uniqueWords) {
          keywordFrequency.set(word, (keywordFrequency.get(word) || 0) + 1);
          if (!labelsByWord.has(word)) {
            labelsByWord.set(word, new Set());
          }
          labelsByWord.get(word)?.add(normalizedLabel);
        }

        const sign: 'income' | 'expense' = row.value >= 0 ? 'income' : 'expense';
        const normalizedValue = Math.abs(row.value).toFixed(2);
        const valueKey = `${sign}:${normalizedValue}`;
        const existingValue = exactValueFrequency.get(valueKey);
        exactValueFrequency.set(valueKey, {
          count: (existingValue?.count || 0) + 1,
          sign,
        });

        processedRows += 1;
        if (processedRows % 25 === 0 || processedRows === totalRows) {
          const scanProgress = (processedRows / totalRows) * 50;
          await updateProgress(scanProgress, 'Scanning transactions...');
        }
      }

      await updateProgress(60, 'Comparing with existing rules...');

      const existingLabelPatterns = new Set(
        existingRules.flatMap(rule =>
          rule.conditions
            .filter(condition => ['label_contains', 'label_exact', 'label_starts_with'].includes(condition.type))
            .map(condition => normalizeText(String(condition.value)))
        )
      );

      const hasRuleWithSign = (sign: 'income' | 'expense', min?: number, max?: number) =>
        existingRules.some(rule => {
          const signCondition = rule.conditions.some(c => c.type === 'value_sign' && c.value === sign);
          if (!signCondition) return false;

          const hasMin = min === undefined || rule.conditions.some(c => c.type === 'value_min' && Number(c.value) <= min);
          const hasMax = max === undefined || rule.conditions.some(c => c.type === 'value_max' && Number(c.value) >= max);
          return hasMin && hasMax;
        });

      const suggestionsBuffer: RuleSuggestion[] = [];

      // Repeated exact labels
      for (const [label, count] of exactLabelFrequency.entries()) {
        if (count < 3 || existingLabelPatterns.has(label)) {
          continue;
        }

        const categoryCount = new Map<string, number>();
        for (const row of rowsByLabel) {
          if (row.normalizedLabel === label && row.categoryId) {
            categoryCount.set(row.categoryId, (categoryCount.get(row.categoryId) || 0) + 1);
          }
        }

        const topCategory = Array.from(categoryCount.entries()).sort((a, b) => b[1] - a[1])[0];
        const suggestedCategory = topCategory
          ? existingCategories.find(category => category.id === topCategory[0])
          : undefined;

        suggestionsBuffer.push({
          type: 'label',
          label,
          occurrences: count,
          suggestedCategoryId: suggestedCategory?.id,
          suggestedCategoryName: suggestedCategory?.name,
          reason: `Label "${label}" repeats ${count} times`,
        });
      }

      await updateProgress(75, 'Extracting label patterns...');

      // Repeated keywords spread across distinct labels
      for (const [word, count] of keywordFrequency.entries()) {
        const distinctLabels = labelsByWord.get(word)?.size || 0;
        if (count < 3 || distinctLabels < 2 || existingLabelPatterns.has(word)) {
          continue;
        }

        suggestionsBuffer.push({
          type: 'label',
          label: word,
          occurrences: count,
          reason: `Word "${word}" appears ${count} times across ${distinctLabels} different labels`,
        });
      }

      // Repeated exact values (same sign + amount)
      for (const [valueKey, data] of exactValueFrequency.entries()) {
        if (data.count < 4) {
          continue;
        }

        const [sign, rawAmount] = valueKey.split(':');
        const amount = Number(rawAmount);

        if (hasRuleWithSign(sign as 'income' | 'expense', amount, amount)) {
          continue;
        }

        suggestionsBuffer.push({
          type: 'value_range',
          valueSign: sign as 'income' | 'expense',
          valueMin: amount,
          valueMax: amount,
          occurrences: data.count,
          reason: `${data.count} ${sign} transactions have the exact value ${amount.toFixed(2)}`,
        });
      }

      await updateProgress(90, 'Ranking best suggestions...');

      const newSuggestions = suggestionsBuffer
        .sort((a, b) => b.occurrences - a.occurrences)
        .slice(0, 15);

      setSuggestions(newSuggestions);
      await updateProgress(100, 'Analysis complete');
      return newSuggestions;
    } finally {
      setLoading(false);
    }
  }, [updateProgress, user]);

  const clearSuggestions = useCallback(() => {
    setSuggestions([]);
    setProgress(0);
    setProgressMessage('');
  }, []);

  return {
    suggestions,
    loading,
    progress,
    progressMessage,
    generateSuggestions,
    clearSuggestions,
  };
}
