import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TutorialStepConfig } from '@/types/tutorial';

interface TutorialStepProps {
  step: TutorialStepConfig;
  index: number;
  total: number;
  position: { top: number; left: number };
  onNext: () => void;
  onSkip: () => void;
}

export function TutorialStep({ step, index, total, position, onNext, onSkip }: TutorialStepProps) {
  return (
    <Card
      role="dialog"
      aria-modal="true"
      className="fixed z-[100] w-[min(22rem,calc(100vw-2rem))] shadow-xl"
      style={{ top: position.top, left: position.left }}
    >
      <CardHeader className="pb-2">
        <p className="text-xs text-muted-foreground">Step {index + 1} / {total}</p>
        <CardTitle className="text-base">{step.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{step.description}</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onSkip}>Skip tutorial</Button>
          <Button size="sm" onClick={onNext}>Next</Button>
        </div>
      </CardContent>
    </Card>
  );
}
