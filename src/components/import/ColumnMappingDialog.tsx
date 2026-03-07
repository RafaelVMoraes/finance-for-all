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

  /** Build display label for a header: when no headers, append first row example */
  const getHeaderDisplayLabel = (header: string): string => {
    if (hasHeaders) return header;
    const colIdx = headers.indexOf(header);
    if (colIdx < 0) return header;
    const example = sampleRows[0]?.[colIdx];
    const exampleStr = example != null ? String(example).trim() : "";
    return exampleStr ? `${header} (${exampleStr})` : header;
  };

  /** Get preview samples for a mapped column */
  const getColumnPreview = (columnName: string | null): string[] => {
    if (!columnName) return [];
    const colIdx = headers.indexOf(columnName);
    if (colIdx < 0) return [];
    return sampleRows
      .slice(0, 3)
      .map((row) => String(row[colIdx] ?? "").trim())
      .filter(Boolean);
  };

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
      <DialogContent className="max-w-[calc(100vw-1.5rem)] sm:max-w-2xl max-h-[85vh] flex flex-col overflow-hidden p-0">
        <div className="px-4 pt-4 sm:px-6 sm:pt-6">
          <DialogHeader>
            <DialogTitle>{t("importPage.columnMapping.title")}</DialogTitle>
            <DialogDescription>
              {t("importPage.columnMapping.description")}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-2 sm:px-6 space-y-4">
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

          <div className="space-y-4">
            {(["date", "label", "value", "category"] as const).map((role) => {
              const required = role !== "category";
              const current = mapping[role];
              const available = getAvailableHeaders(role);
              const isMapped = !!current;
              const preview = getColumnPreview(current);

              return (
                <div key={role} className="space-y-1.5">
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
                          {getHeaderDisplayLabel(h)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {isMapped && preview.length > 0 && (
                    <p className="text-xs text-muted-foreground truncate">
                      Preview: {preview.join(", ")}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {!isValid && (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted p-3 text-sm">
              <AlertCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
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

        <div className="px-4 pb-4 sm:px-6 sm:pb-6">
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
