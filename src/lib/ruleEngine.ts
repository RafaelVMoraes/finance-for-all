/**
 * Deterministic Rule Engine for Import Categorization
 * 
 * Rules are evaluated in priority order (highest first).
 * All conditions in a rule must match (AND logic).
 * First matching rule with a terminal action wins (short-circuit).
 */

import { ImportRule, RuleCondition, RuleMatchResult, DuplicateAction } from '@/types/importRules';

// Normalize text for matching: lowercase, trim, remove accents
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // Remove diacritics
}

// Check if a single condition matches
function evaluateCondition(
  condition: RuleCondition,
  label: string,
  value: number,
  isDuplicate: boolean
): boolean {
  const normalizedLabel = normalizeText(label);
  
  switch (condition.type) {
    case 'label_contains': {
      const searchTerm = normalizeText(String(condition.value));
      return searchTerm.length > 0 && normalizedLabel.includes(searchTerm);
    }

    case 'label_starts_with': {
      const prefix = normalizeText(String(condition.value));
      return prefix.length > 0 && normalizedLabel.startsWith(prefix);
    }

    case 'label_exact': {
      const exact = normalizeText(String(condition.value));
      return exact.length > 0 && normalizedLabel === exact;
    }
    
    case 'value_min': {
      const minValue = Number(condition.value);
      return !isNaN(minValue) && value >= minValue;
    }
    
    case 'value_max': {
      const maxValue = Number(condition.value);
      return !isNaN(maxValue) && value <= maxValue;
    }
    
    case 'value_sign': {
      if (condition.value === 'income') {
        return value > 0;
      } else if (condition.value === 'expense') {
        return value < 0;
      }
      return false;
    }
    
    case 'is_duplicate': {
      return isDuplicate === Boolean(condition.value);
    }
    
    default:
      return false;
  }
}

// Evaluate all conditions for a rule (AND logic)
function evaluateRule(
  rule: ImportRule,
  label: string,
  value: number,
  isDuplicate: boolean
): boolean {
  if (!rule.enabled) return false;
  if (!rule.conditions || rule.conditions.length === 0) return false;
  
  // All conditions must match (AND logic)
  return rule.conditions.every(condition => 
    evaluateCondition(condition, label, value, isDuplicate)
  );
}

// Sort rules by priority (descending), then by creation date (ascending for determinism)
function sortRulesByPriority(rules: ImportRule[]): ImportRule[] {
  return [...rules].sort((a, b) => {
    // Higher priority first
    if (b.priority !== a.priority) {
      return b.priority - a.priority;
    }
    // Earlier creation date wins ties (deterministic)
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
}

/**
 * Evaluate rules against a transaction row
 * Returns the first matching rule with a terminal action
 */
export function evaluateRules(
  rules: ImportRule[],
  label: string,
  value: number,
  isDuplicate: boolean
): RuleMatchResult {
  const sortedRules = sortRulesByPriority(rules);
  
  for (const rule of sortedRules) {
    if (evaluateRule(rule, label, value, isDuplicate)) {
      const result: RuleMatchResult = {
        matched: true,
        rule,
      };
      
      // Extract actions
      if (rule.actions.category_id) {
        result.appliedCategory = rule.actions.category_id;
      }
      
      if (rule.actions.duplicate_action) {
        result.duplicateAction = rule.actions.duplicate_action as DuplicateAction;
      }
      
      // Short-circuit: return first matching rule with any terminal action
      if (result.appliedCategory || result.duplicateAction) {
        return result;
      }
    }
  }
  
  return { matched: false };
}

/**
 * Batch evaluate rules for multiple rows
 * Returns array of results in same order as input
 */
export function batchEvaluateRules(
  rules: ImportRule[],
  rows: Array<{ label: string; value: number; isDuplicate: boolean }>
): RuleMatchResult[] {
  // Sort once, reuse for all rows
  const sortedRules = sortRulesByPriority(rules);
  
  return rows.map(row => {
    for (const rule of sortedRules) {
      if (evaluateRule(rule, row.label, row.value, row.isDuplicate)) {
        const result: RuleMatchResult = {
          matched: true,
          rule,
        };
        
        if (rule.actions.category_id) {
          result.appliedCategory = rule.actions.category_id;
        }
        
        if (rule.actions.duplicate_action) {
          result.duplicateAction = rule.actions.duplicate_action as DuplicateAction;
        }
        
        if (result.appliedCategory || result.duplicateAction) {
          return result;
        }
      }
    }
    
    return { matched: false };
  });
}

/**
 * Preview rule effects on sample data
 * Returns count of rows that would be affected
 */
export function previewRuleEffect(
  rule: ImportRule,
  rows: Array<{ label: string; value: number; isDuplicate: boolean }>
): { matchCount: number; matchedRows: number[] } {
  const matchedRows: number[] = [];
  
  rows.forEach((row, index) => {
    if (evaluateRule(rule, row.label, row.value, row.isDuplicate)) {
      matchedRows.push(index);
    }
  });
  
  return {
    matchCount: matchedRows.length,
    matchedRows,
  };
}

/**
 * Get a human-readable description of a rule
 */
export function describeRule(rule: ImportRule, categoryName?: string): string {
  const conditionParts: string[] = [];
  
  for (const condition of rule.conditions) {
    switch (condition.type) {
      case 'label_contains':
        conditionParts.push(`label contains "${condition.value}"`);
        break;
      case 'label_starts_with':
        conditionParts.push(`label starts with "${condition.value}"`);
        break;
      case 'label_exact':
        conditionParts.push(`label is exactly "${condition.value}"`);
        break;
      case 'value_min':
        conditionParts.push(`value ≥ ${condition.value}`);
        break;
      case 'value_max':
        conditionParts.push(`value ≤ ${condition.value}`);
        break;
      case 'value_sign':
        conditionParts.push(condition.value === 'income' ? 'is income' : 'is expense');
        break;
      case 'is_duplicate':
        conditionParts.push(condition.value ? 'is duplicate' : 'is not duplicate');
        break;
    }
  }
  
  const actionParts: string[] = [];
  
  if (rule.actions.category_id) {
    actionParts.push(`set category = ${categoryName || rule.actions.category_id}`);
  }
  
  if (rule.actions.duplicate_action === 'accept') {
    actionParts.push('auto-accept duplicate');
  } else if (rule.actions.duplicate_action === 'reject') {
    actionParts.push('auto-reject duplicate');
  }
  
  return `If ${conditionParts.join(' AND ')} → ${actionParts.join(', ')}`;
}
