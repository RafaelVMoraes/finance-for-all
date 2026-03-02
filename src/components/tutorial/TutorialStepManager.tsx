import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { HighlightOverlay } from '@/components/tutorial/HighlightOverlay';
import { TutorialStep } from '@/components/tutorial/TutorialStep';
import { useTutorial } from '@/contexts/TutorialContext';

export function TutorialStepManager() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    activeTutorialSteps,
    activeTutorialId,
    currentStepIndex,
    mandatoryOnboarding,
    nextStep,
    skipTutorial,
  } = useTutorial();
  const [rect, setRect] = useState<DOMRect | null>(null);

  const step = activeTutorialSteps[currentStepIndex];

  useEffect(() => {
    if (!step || location.pathname !== step.route) {
      return;
    }

    let cancelled = false;
    let attempts = 0;

    const measure = () => {
      if (cancelled) return;
      const target = document.querySelector(step.selector);
      if (target) {
        const measured = target.getBoundingClientRect();
        if (measured.width > 0 && measured.height > 0) {
          setRect(measured);
          return;
        }
      }

      attempts += 1;
      if (attempts < 30) {
        window.setTimeout(measure, 150);
      } else {
        setRect(null);
      }
    };

    setRect(null);
    measure();

    return () => {
      cancelled = true;
    };
  }, [step, location.pathname]);

  useEffect(() => {
    if (!step) return;
    if (location.pathname !== step.route) {
      navigate(step.route);
    }
  }, [location.pathname, navigate, step]);

  const position = useMemo(() => {
    const margin = 12;
    const width = Math.min(352, window.innerWidth - 32);
    const defaultTop = Math.max(16, window.innerHeight / 2 - 120);
    const defaultLeft = Math.max(16, (window.innerWidth - width) / 2);

    if (!rect) return { top: defaultTop, left: defaultLeft };

    const belowTop = rect.bottom + margin;
    const aboveTop = rect.top - 190;
    const top = belowTop + 180 < window.innerHeight ? belowTop : Math.max(16, aboveTop);
    const left = Math.min(Math.max(16, rect.left), window.innerWidth - width - 16);
    return { top, left };
  }, [rect]);

  useEffect(() => {
    if (!mandatoryOnboarding) return;

    const blockNav = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
      }
    };

    document.addEventListener('keydown', blockNav);
    return () => document.removeEventListener('keydown', blockNav);
  }, [mandatoryOnboarding]);

  if (!activeTutorialId || !step) return null;

  return (
    <div className="fixed inset-0 z-[80]" aria-live="polite">
      <div className="fixed inset-0 bg-black/45" />
      <HighlightOverlay rect={rect} />
      <TutorialStep
        step={step}
        index={currentStepIndex}
        total={activeTutorialSteps.length}
        position={position}
        onNext={nextStep}
        onSkip={skipTutorial}
      />
    </div>
  );
}
