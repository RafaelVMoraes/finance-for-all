// Import Rules Types

export type ConditionType = 
  | 'label_contains'
  | 'label_starts_with'
  | 'label_exact'
  | 'value_min'
  | 'value_max'
  | 'value_sign' // 'income' or 'expense'
  | 'is_duplicate';

export type DuplicateAction = 'accept' | 'reject';

export interface RuleCondition {
  type: ConditionType;
  value: string | number | boolean;
}

export interface RuleActions {
  category_id?: string | null;
  duplicate_action?: DuplicateAction | null;
}

export interface ImportRule {
  id: string;
  user_id: string;
  name: string;
  priority: number;
  enabled: boolean;
  conditions: RuleCondition[];
  actions: RuleActions;
  times_applied: number;
  last_applied_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RuleMatchResult {
  matched: boolean;
  rule?: ImportRule;
  appliedCategory?: string;
  duplicateAction?: DuplicateAction;
}

export interface RuleSuggestion {
  type: 'label' | 'value_range' | 'duplicate';
  label?: string;
  valueMin?: number;
  valueMax?: number;
  valueSign?: 'income' | 'expense';
  suggestedCategoryId?: string;
  suggestedCategoryName?: string;
  occurrences: number;
  reason: string;
}
