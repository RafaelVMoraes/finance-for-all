import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, X } from "lucide-react";
import {
  ImportRule,
  RuleCondition,
  RuleActions,
  ConditionType,
} from "@/types/importRules";

interface RuleEditorProps {
  rule?: ImportRule;
  categories: Array<{ id: string; name: string; color: string }>;
  onSave: (rule: {
    name: string;
    priority: number;
    enabled: boolean;
    conditions: RuleCondition[];
    actions: RuleActions;
  }) => Promise<{ error?: string }>;
  onClose: () => void;
  open: boolean;
}

const CONDITION_TYPES: { value: ConditionType; label: string }[] = [
  { value: "label_contains", label: "Label contains" },
  { value: "label_starts_with", label: "Label starts with" },
  { value: "label_exact", label: "Label is exactly" },
  { value: "value_min", label: "Value ≥ (min)" },
  { value: "value_max", label: "Value ≤ (max)" },
  { value: "value_sign", label: "Value type" },
  { value: "is_duplicate", label: "Is duplicate" },
];

export function RuleEditor({
  rule,
  categories,
  onSave,
  onClose,
  open,
}: RuleEditorProps) {
  const [name, setName] = useState(rule?.name || "");
  const [priority, setPriority] = useState(rule?.priority || 0);
  const [enabled, setEnabled] = useState(rule?.enabled ?? true);
  const [conditions, setConditions] = useState<RuleCondition[]>(
    rule?.conditions || [],
  );
  const [categoryId, setCategoryId] = useState<string | null>(
    rule?.actions.category_id || null,
  );
  const [duplicateAction, setDuplicateAction] = useState<string | null>(
    rule?.actions.duplicate_action || null,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addCondition = () => {
    setConditions([...conditions, { type: "label_contains", value: "" }]);
  };

  const updateCondition = (
    index: number,
    field: "type" | "value",
    value: string | number | boolean,
  ) => {
    const updated = [...conditions];
    if (field === "type") {
      // Reset value when type changes
      const newType = value as ConditionType;
      updated[index] = {
        type: newType,
        value:
          newType === "value_sign"
            ? "expense"
            : newType === "is_duplicate"
              ? true
              : "",
      };
    } else {
      updated[index] = { ...updated[index], value };
    }
    setConditions(updated);
  };

  const removeCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Rule name is required");
      return;
    }

    if (conditions.length === 0) {
      setError("At least one condition is required");
      return;
    }

    // Validate conditions have values
    for (const cond of conditions) {
      if (
        (cond.type === "label_contains" ||
          cond.type === "label_starts_with" ||
          cond.type === "label_exact") &&
        !String(cond.value).trim()
      ) {
        setError("Label condition requires a value");
        return;
      }
      if (
        (cond.type === "value_min" || cond.type === "value_max") &&
        (cond.value === "" || isNaN(Number(cond.value)))
      ) {
        setError("Value conditions require a numeric value");
        return;
      }
    }

    if (!categoryId && !duplicateAction) {
      setError(
        "At least one action (category or duplicate handling) is required",
      );
      return;
    }

    setError(null);
    setSaving(true);

    const result = await onSave({
      name: name.trim(),
      priority,
      enabled,
      conditions,
      actions: {
        category_id: categoryId,
        duplicate_action: duplicateAction as
          | "accept"
          | "reject"
          | "skip_import"
          | null,
      },
    });

    setSaving(false);

    if (result.error) {
      setError(result.error);
    } else {
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[calc(100vw-1rem)] sm:max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>{rule ? "Edit Rule" : "Create Rule"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Rule name */}
          <div className="space-y-2">
            <Label>Rule Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Categorize grocery stores"
            />
          </div>

          {/* Priority and enabled */}
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="flex-1 space-y-2">
              <Label>Priority (higher = first)</Label>
              <Input
                type="number"
                value={priority}
                onChange={(e) => setPriority(parseInt(e.target.value) || 0)}
                min={0}
                max={100}
              />
            </div>
            <div className="flex items-end gap-2 pb-2">
              <Switch checked={enabled} onCheckedChange={setEnabled} />
              <Label>Enabled</Label>
            </div>
          </div>

          {/* Conditions */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Conditions (all must match)</Label>
              <Button variant="outline" size="sm" onClick={addCondition}>
                <Plus className="mr-1 h-3 w-3" />
                Add
              </Button>
            </div>

            {conditions.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No conditions yet. Add at least one.
              </p>
            )}

            {conditions.map((condition, index) => (
              <div
                key={index}
                className="flex flex-col gap-2 rounded-lg border p-2 bg-muted/50 sm:flex-row sm:items-center"
              >
                <Select
                  value={condition.type}
                  onValueChange={(v) => updateCondition(index, "type", v)}
                >
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONDITION_TYPES.map((ct) => (
                      <SelectItem key={ct.value} value={ct.value}>
                        {ct.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {(condition.type === "label_contains" ||
                  condition.type === "label_starts_with" ||
                  condition.type === "label_exact") && (
                  <Input
                    value={String(condition.value)}
                    onChange={(e) =>
                      updateCondition(index, "value", e.target.value)
                    }
                    placeholder={
                      condition.type === "label_exact"
                        ? "exact label text"
                        : "keyword"
                    }
                    className="flex-1"
                  />
                )}

                {(condition.type === "value_min" ||
                  condition.type === "value_max") && (
                  <Input
                    type="number"
                    value={String(condition.value)}
                    onChange={(e) =>
                      updateCondition(
                        index,
                        "value",
                        parseFloat(e.target.value) || 0,
                      )
                    }
                    placeholder="amount"
                    className="flex-1"
                  />
                )}

                {condition.type === "value_sign" && (
                  <Select
                    value={String(condition.value)}
                    onValueChange={(v) => updateCondition(index, "value", v)}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="income">
                        Income (value &gt; 0)
                      </SelectItem>
                      <SelectItem value="expense">
                        Expense (value &lt; 0)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                )}

                {condition.type === "is_duplicate" && (
                  <Select
                    value={String(condition.value)}
                    onValueChange={(v) =>
                      updateCondition(index, "value", v === "true")
                    }
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Is duplicate</SelectItem>
                      <SelectItem value="false">Is not duplicate</SelectItem>
                    </SelectContent>
                  </Select>
                )}

                <Button
                  variant="ghost"
                  size="icon"
                  className="self-end sm:self-auto"
                  onClick={() => removeCondition(index)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <Label>Actions</Label>

            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">
                Assign Category
              </Label>
              <Select
                value={categoryId || "__none__"}
                onValueChange={(v) =>
                  setCategoryId(v === "__none__" ? null : v)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="No category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No category</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: cat.color }}
                        />
                        {cat.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">
                Duplicate Handling
              </Label>
              <Select
                value={duplicateAction || "__none__"}
                onValueChange={(v) =>
                  setDuplicateAction(v === "__none__" ? null : v)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="No action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No action</SelectItem>
                  <SelectItem value="accept">
                    Auto-accept (import anyway)
                  </SelectItem>
                  <SelectItem value="reject">Auto-reject duplicate</SelectItem>
                  <SelectItem value="skip_import">
                    Never import matching row
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <X className="h-4 w-4" />
              {error}
            </div>
          )}
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : rule ? "Update Rule" : "Create Rule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
