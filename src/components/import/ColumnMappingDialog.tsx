import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Check, AlertCircle } from "lucide-react";
import { ColumnMapping } from "@/lib/columnDetection";
import { useI18n } from "@/i18n/I18nProvider";

interface ColumnMappingDialogProps {
  hasHeaders: boolean;
  onHasHeadersChange: (value: boolean) => void;
  open: boolean;
  onConfirm: (mapping: ColumnMapping, saveForSource: boolean) => void;
  onCancel: () => void;
  headers: string[];
  sampleRows: unknown[][];
  mapping: ColumnMapping;
  onMappingChange: (mapping: ColumnMapping) => void;
  sourceName?: string;
  sourceId?: string | null;
}

const NONE_VALUE = "__none__";

export function ColumnMappingDialog({
  open,
  hasHeaders,
  onHasHeadersChange,
  onConfirm,
  onCancel,
  headers,
  sampleRows,
  mapping,
  onMappingChange,
  sourceName,
  sourceId,
}: ColumnMappingDialogProps) {
  const { t } = useI18n();
  const [saveForSource, setSaveForSource] = useState(!!sourceId);

  const isValid = mapping.date && mapping.label && mapping.value;

  const usedColumns = useMemo(() => {
    const set = new Set<string>();
    if (mapping.date) set.add(mapping.date);
    if (mapping.label) set.add(mapping.label);
    if (mapping.value) set.add(mapping.value);
    if (mapping.category) set.add(mapping.category);
    return set;
  }, [mapping]);

  const getAvailableHeaders = (currentRole: keyof ColumnMapping) => {
    return headers.filter((h) => {
      if (h === mapping[currentRole]) return true;
      return !usedColumns.has(h);
    });
  };

  const updateMapping = (role: keyof ColumnMapping, value: string) => {
    onMappingChange({
      ...mapping,
      [role]: value === NONE_VALUE ? null : value,
    });
  };

  const previewByRole = useMemo(() => {
    const roleToColumn = {
      date: mapping.date,
      label: mapping.label,
      value: mapping.value,
      category: mapping.category,
    } as const;

    return (Object.keys(roleToColumn) as Array<keyof typeof roleToColumn>).map(
      (role) => {
        const selectedColumn = roleToColumn[role];
        const columnIndex = selectedColumn ? headers.indexOf(selectedColumn) : -1;
        return {
          role,
          selectedColumn,
          examples: sampleRows.slice(0, 2).map((row) =>
            columnIndex >= 0 ? String(row[columnIndex] ?? "") : "",
          ),
        };
      },
    );
  }, [mapping, headers, sampleRows]);

  const roleLabelKey: Record<keyof ColumnMapping, string> = {
    date: "importPage.columnMapping.roles.date",
    label: "importPage.columnMapping.roles.label",
    value: "importPage.columnMapping.roles.value",
    category: "importPage.columnMapping.roles.category",
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onCancel();
      }}
    >
      <DialogContent className="max-w-[calc(100vw-env(safe-area-inset-left)-env(safe-area-inset-right)-0.75rem)] sm:max-w-2xl max-h-[90vh] overflow-hidden p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>{t("importPage.columnMapping.title")}</DialogTitle>
          <DialogDescription>
            {t("importPage.columnMapping.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto pr-1">
          <div className="flex items-center gap-2">
            <Checkbox
              id="has-headers"
              checked={hasHeaders}
              onCheckedChange={(c) => onHasHeadersChange(!!c)}
            />
            <label htmlFor="has-headers" className="text-sm text-muted-foreground">
              {t("importPage.columnMapping.hasHeaders")}
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {(["date", "label", "value", "category"] as const).map((role) => {
              const required = role !== "category";
              const current = mapping[role];
              const available = getAvailableHeaders(role);
              const isMapped = !!current;

              return (
                <div key={role} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium">
                      {t(roleLabelKey[role])}
                    </label>
                    {required && (
                      <Badge variant="outline" className="text-[10px]">
                        {t("importPage.columnMapping.required")}
                      </Badge>
                    )}
                    {isMapped && <Check className="h-3 w-3 text-emerald-500" />}
                  </div>
                  <Select
                    value={current || NONE_VALUE}
                    onValueChange={(v) => updateMapping(role, v)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder={t("importPage.columnMapping.selectColumn")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>
                        {t("importPage.columnMapping.notMapped")}
                      </SelectItem>
                      {available.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
          </div>

          {isValid && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                {t("importPage.columnMapping.previewTitle")}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {previewByRole.map((item) => (
                  <div key={item.role} className="rounded-md border p-3 text-sm">
                    <p className="font-medium">{t(roleLabelKey[item.role])}</p>
                    <p className="text-muted-foreground">
                      {item.selectedColumn || t("importPage.columnMapping.noColumnSelected")}
                    </p>
                    <p className="mt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {t("importPage.columnMapping.examples")}
                    </p>
                    <div className="mt-1 space-y-1">
                      {item.examples.map((example, index) => (
                        <p key={index} className="truncate text-muted-foreground">
                          {example || "—"}
                        </p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!isValid && (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted p-3 text-sm">
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
              <span>{t("importPage.columnMapping.validationHint")}</span>
            </div>
          )}

          {sourceId && (
            <div className="flex items-center gap-2">
              <Checkbox
                id="save-mapping"
                checked={saveForSource}
                onCheckedChange={(c) => setSaveForSource(!!c)}
              />
              <label
                htmlFor="save-mapping"
                className="text-sm text-muted-foreground"
              >
                {t("importPage.columnMapping.saveForSource", { sourceName: sourceName || "" })}
              </label>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onCancel}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={() => onConfirm(mapping, saveForSource)}
            disabled={!isValid}
          >
            {t("importPage.columnMapping.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
