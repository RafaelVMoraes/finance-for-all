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
import { useI18n } from "@/i18n/I18nProvider";

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

export function RuleEditor({
  rule,
  categories,
  onSave,
  onClose,
  open,
}: RuleEditorProps) {
  const { t } = useI18n();

  const conditionTypes: { value: ConditionType; label: string }[] = [
    { value: "label_contains", label: t("importPage.ruleEditor.conditionTypes.labelContains") },
    { value: "label_starts_with", label: t("importPage.ruleEditor.conditionTypes.labelStartsWith") },
    { value: "label_exact", label: t("importPage.ruleEditor.conditionTypes.labelExact") },
    { value: "value_min", label: t("importPage.ruleEditor.conditionTypes.valueMin") },
    { value: "value_max", label: t("importPage.ruleEditor.conditionTypes.valueMax") },
    { value: "value_sign", label: t("importPage.ruleEditor.conditionTypes.valueType") },
    { value: "is_duplicate", label: t("importPage.ruleEditor.conditionTypes.isDuplicate") },
  ];

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
      setError(t("importPage.ruleEditor.errors.nameRequired"));
      return;
    }

    if (conditions.length === 0) {
      setError(t("importPage.ruleEditor.errors.conditionRequired"));
      return;
    }

    for (const cond of conditions) {
      if (
        (cond.type === "label_contains" ||
          cond.type === "label_starts_with" ||
          cond.type === "label_exact") &&
        !String(cond.value).trim()
      ) {
        setError(t("importPage.ruleEditor.errors.labelValueRequired"));
        return;
      }
      if (
        (cond.type === "value_min" || cond.type === "value_max") &&
        (cond.value === "" || isNaN(Number(cond.value)))
      ) {
        setError(t("importPage.ruleEditor.errors.numericValueRequired"));
        return;
      }
    }

    if (!categoryId && !duplicateAction) {
      setError(t("importPage.ruleEditor.errors.actionRequired"));
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
      <DialogContent className="max-w-[calc(100vw-env(safe-area-inset-left)-env(safe-area-inset-right)-0.75rem)] sm:max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>
            {rule
              ? t("importPage.ruleEditor.editTitle")
              : t("importPage.ruleEditor.createTitle")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t("importPage.ruleEditor.ruleName")}</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("importPage.ruleEditor.namePlaceholder")}
            />
          </div>

          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="flex-1 space-y-2">
              <Label>{t("importPage.ruleEditor.priority")}</Label>
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
              <Label>{t("importPage.ruleEditor.enabled")}</Label>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t("importPage.ruleEditor.conditions")}</Label>
              <Button variant="outline" size="sm" onClick={addCondition}>
                <Plus className="mr-1 h-3 w-3" />
                {t("importPage.ruleEditor.add")}
              </Button>
            </div>

            {conditions.length === 0 && (
              <p className="text-sm text-muted-foreground">
                {t("importPage.ruleEditor.noConditions")}
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
                    {conditionTypes.map((ct) => (
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
                        ? t("importPage.ruleEditor.exactLabelPlaceholder")
                        : t("importPage.ruleEditor.keywordPlaceholder")
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
                    placeholder={t("importPage.ruleEditor.amountPlaceholder")}
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
                        {t("importPage.ruleEditor.income")}
                      </SelectItem>
                      <SelectItem value="expense">
                        {t("importPage.ruleEditor.expense")}
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
                      <SelectItem value="true">{t("importPage.ruleEditor.isDuplicate")}</SelectItem>
                      <SelectItem value="false">{t("importPage.ruleEditor.isNotDuplicate")}</SelectItem>
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

          <div className="space-y-3">
            <Label>{t("importPage.ruleEditor.actions")}</Label>

            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">
                {t("importPage.ruleEditor.assignCategory")}
              </Label>
              <Select
                value={categoryId || "__none__"}
                onValueChange={(v) =>
                  setCategoryId(v === "__none__" ? null : v)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("importPage.ruleEditor.noCategory")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t("importPage.ruleEditor.noCategory")}</SelectItem>
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
                {t("importPage.ruleEditor.handling")}
              </Label>
              <Select
                value={duplicateAction || "__none__"}
                onValueChange={(v) =>
                  setDuplicateAction(v === "__none__" ? null : v)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("importPage.ruleEditor.noAction")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t("importPage.ruleEditor.noAction")}</SelectItem>
                  <SelectItem value="accept">{t("importPage.ruleEditor.autoAccept")}</SelectItem>
                  <SelectItem value="reject">{t("importPage.ruleEditor.autoReject")}</SelectItem>
                  <SelectItem value="skip_import">{t("importPage.ruleEditor.neverImport")}</SelectItem>
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
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving
              ? t("importPage.ruleEditor.saving")
              : rule
                ? t("importPage.ruleEditor.update")
                : t("importPage.ruleEditor.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
