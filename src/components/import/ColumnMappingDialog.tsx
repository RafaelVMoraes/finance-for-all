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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check, AlertCircle } from "lucide-react";
import { ColumnMapping } from "@/lib/columnDetection";

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

  const previewRows = useMemo(() => {
    const dateIdx = mapping.date ? headers.indexOf(mapping.date) : -1;
    const labelIdx = mapping.label ? headers.indexOf(mapping.label) : -1;
    const valueIdx = mapping.value ? headers.indexOf(mapping.value) : -1;
    const catIdx = mapping.category ? headers.indexOf(mapping.category) : -1;

    return sampleRows.slice(0, 2).map((row) => ({
      date: dateIdx >= 0 ? String(row[dateIdx] ?? "") : "",
      label: labelIdx >= 0 ? String(row[labelIdx] ?? "") : "",
      value: valueIdx >= 0 ? String(row[valueIdx] ?? "") : "",
      category: catIdx >= 0 ? String(row[catIdx] ?? "") : "",
    }));
  }, [mapping, headers, sampleRows]);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onCancel();
      }}
    >
      <DialogContent className="max-w-[calc(100vw-1rem)] sm:max-w-2xl max-h-[90vh] overflow-hidden p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Map Columns</DialogTitle>
          <DialogDescription>
            Assign each column from your file to the correct field. Date, Label,
            and Value are required.
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
              My file has a header row
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
                    <label className="text-sm font-medium capitalize">
                      {role}
                    </label>
                    {required && (
                      <Badge variant="outline" className="text-[10px]">
                        Required
                      </Badge>
                    )}
                    {isMapped && <Check className="h-3 w-3 text-emerald-500" />}
                  </div>
                  <Select
                    value={current || NONE_VALUE}
                    onValueChange={(v) => updateMapping(role, v)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select column..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>— Not mapped —</SelectItem>
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
                Preview (first 2 rows)
              </p>
              <ScrollArea className="max-h-[200px] w-full rounded-md border">
                <Table className="w-full table-fixed">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Label</TableHead>
                        <TableHead className="text-right">Value</TableHead>
                        <TableHead>Category</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewRows.map((row, i) => (
                        <TableRow key={i}>
                          <TableCell className="truncate text-muted-foreground">
                            {row.date}
                          </TableCell>
                          <TableCell className="truncate">{row.label}</TableCell>
                          <TableCell className="truncate text-right font-mono">
                            {row.value}
                          </TableCell>
                          <TableCell className="truncate text-muted-foreground">
                            {row.category || "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
              </ScrollArea>
            </div>
          )}

          {!isValid && (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted p-3 text-sm">
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
              <span>
                Please map the Date, Label, and Value columns to continue.
              </span>
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
                Save this mapping for source "{sourceName}" for future imports
              </label>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            onClick={() => onConfirm(mapping, saveForSource)}
            disabled={!isValid}
          >
            Confirm Mapping
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
