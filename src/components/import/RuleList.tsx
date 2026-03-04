import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MoreHorizontal, Pencil, Trash2, ArrowUp, ArrowDown, Zap } from "lucide-react";
import { ImportRule } from "@/types/importRules";

interface RuleListProps {
  rules: ImportRule[];
  categories: Array<{ id: string; name: string; color: string }>;
  onEdit: (rule: ImportRule) => void;
  onDelete: (ruleId: string) => void;
  onToggle: (ruleId: string, enabled: boolean) => void;
  onUpdatePriority: (ruleId: string, newPriority: number) => void;
}

export function RuleList({
  rules,
  categories,
  onEdit,
  onDelete,
  onToggle,
  onUpdatePriority,
}: RuleListProps) {
  const getCategoryName = (categoryId: string) => categories.find((c) => c.id === categoryId)?.name || "Unknown";
  const getCategoryColor = (categoryId: string) => categories.find((c) => c.id === categoryId)?.color || "#888";

  if (rules.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Zap className="mb-4 h-12 w-12 text-muted-foreground/50" />
        <h3 className="text-lg font-medium">No import rules yet</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Create rules to automatically categorize transactions during import
        </p>
      </div>
    );
  }

  const actionBadge = (rule: ImportRule) => {
    if (!rule.actions.duplicate_action) return null;
    return (
      <Badge
        variant="secondary"
        className={
          rule.actions.duplicate_action === "accept"
            ? "bg-emerald-100 text-emerald-800"
            : rule.actions.duplicate_action === "reject"
              ? "bg-red-100 text-red-800"
              : "bg-orange-100 text-orange-800"
        }
      >
        {rule.actions.duplicate_action === "accept"
          ? "Auto-accept duplicate"
          : rule.actions.duplicate_action === "reject"
            ? "Auto-reject duplicate"
            : "Never import row"}
      </Badge>
    );
  };

  return (
    <ScrollArea className="h-[400px] w-full">
      <div className="space-y-3 md:hidden">
        {rules.map((rule, index) => (
          <div key={rule.id} className={`rounded-lg border p-3 ${!rule.enabled ? "opacity-50" : ""}`}>
            <div className="mb-2 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium">{rule.name}</p>
                <p className="text-xs text-muted-foreground">Priority {rule.priority} · Used {rule.times_applied}×</p>
              </div>
              <Switch checked={rule.enabled} onCheckedChange={(checked) => onToggle(rule.id, checked)} />
            </div>
            <div className="mb-2 flex flex-wrap gap-1">
              {rule.conditions.map((cond, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  {cond.type === "label_contains" && `"${cond.value}"`}
                  {cond.type === "value_min" && `≥ ${cond.value}`}
                  {cond.type === "value_max" && `≤ ${cond.value}`}
                  {cond.type === "value_sign" && (cond.value === "income" ? "Income" : "Expense")}
                  {cond.type === "is_duplicate" && (cond.value ? "Duplicate" : "Not duplicate")}
                </Badge>
              ))}
            </div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {rule.actions.category_id && (
                <span className="inline-flex items-center gap-1 text-xs">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: getCategoryColor(rule.actions.category_id) }} />
                  {getCategoryName(rule.actions.category_id)}
                </span>
              )}
              {actionBadge(rule)}
            </div>
            <div className="flex items-center justify-between">
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onUpdatePriority(rule.id, rule.priority + 1)} disabled={index === 0}>
                  <ArrowUp className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onUpdatePriority(rule.id, Math.max(0, rule.priority - 1))} disabled={rule.priority === 0}>
                  <ArrowDown className="h-3 w-3" />
                </Button>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(rule)}>
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(rule.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="hidden md:block">
        <Table className="w-full">
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">Active</TableHead>
              <TableHead className="w-16">Priority</TableHead>
              <TableHead>Rule Name</TableHead>
              <TableHead>Conditions</TableHead>
              <TableHead>Action</TableHead>
              <TableHead className="w-20 text-right">Used</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.map((rule, index) => (
              <TableRow key={rule.id} className={!rule.enabled ? "opacity-50" : ""}>
                <TableCell>
                  <Switch checked={rule.enabled} onCheckedChange={(checked) => onToggle(rule.id, checked)} />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <span className="font-mono text-sm">{rule.priority}</span>
                    <div className="flex flex-col">
                      <Button variant="ghost" size="icon" className="h-4 w-4" onClick={() => onUpdatePriority(rule.id, rule.priority + 1)} disabled={index === 0}>
                        <ArrowUp className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-4 w-4" onClick={() => onUpdatePriority(rule.id, Math.max(0, rule.priority - 1))} disabled={rule.priority === 0}>
                        <ArrowDown className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="font-medium">{rule.name}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {rule.conditions.map((cond, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {cond.type === "label_contains" && `"${cond.value}"`}
                        {cond.type === "value_min" && `≥ ${cond.value}`}
                        {cond.type === "value_max" && `≤ ${cond.value}`}
                        {cond.type === "value_sign" && (cond.value === "income" ? "Income" : "Expense")}
                        {cond.type === "is_duplicate" && (cond.value ? "Duplicate" : "Not duplicate")}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    {rule.actions.category_id && (
                      <div className="flex items-center gap-1">
                        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: getCategoryColor(rule.actions.category_id) }} />
                        <span className="text-sm">{getCategoryName(rule.actions.category_id)}</span>
                      </div>
                    )}
                    {actionBadge(rule)}
                  </div>
                </TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">{rule.times_applied}×</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit(rule)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onDelete(rule.id)} className="text-destructive">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </ScrollArea>
  );
}
