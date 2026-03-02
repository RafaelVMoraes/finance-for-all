import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Lightbulb, Plus, X } from 'lucide-react';
import { RuleSuggestion } from '@/types/importRules';

interface RuleSuggestionsProps {
  suggestions: RuleSuggestion[];
  loading: boolean;
  progress: number;
  progressMessage: string;
  onCreateFromSuggestion: (suggestion: RuleSuggestion) => void;
  onDismiss: (index: number) => void;
  onClose: () => void;
}

export function RuleSuggestions({
  suggestions,
  loading,
  progress,
  progressMessage,
  onCreateFromSuggestion,
  onDismiss,
  onClose,
}: RuleSuggestionsProps) {
  if (loading) {
    return (
      <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20">
        <CardContent className="py-6">
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-2">
              <Lightbulb className="h-5 w-5 animate-pulse text-amber-600" />
              <span>{progressMessage || 'Analyzing patterns...'}</span>
            </div>
            <div className="space-y-1">
              <Progress value={progress} className="h-2" />
              <p className="text-center text-xs text-muted-foreground">{Math.round(progress)}% complete</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (suggestions.length === 0) {
    return (
      <Card className="border-muted">
        <CardContent className="py-6">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Lightbulb className="h-5 w-5" />
            <span>No suggestions available. Import more transactions to see patterns.</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Lightbulb className="h-5 w-5 text-amber-600" />
            Rule Suggestions
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-[250px]">
          <div className="space-y-2">
            {suggestions.map((suggestion, index) => (
              <div
                key={index}
                className="flex items-center justify-between gap-4 rounded-lg border bg-background p-3"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {suggestion.type === 'label' && (
                      <Badge variant="outline">Label: "{suggestion.label}"</Badge>
                    )}
                    {suggestion.type === 'value_range' && suggestion.valueSign && (
                      <Badge variant="outline">
                        {suggestion.valueSign === 'income' ? 'Income' : 'Expense'}
                      </Badge>
                    )}
                    {suggestion.suggestedCategoryName && (
                      <span className="text-sm">
                        → {suggestion.suggestedCategoryName}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{suggestion.reason}</p>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onCreateFromSuggestion(suggestion)}
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    Create
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onDismiss(index)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
