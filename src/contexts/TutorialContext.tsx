import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { onboardingSteps, sectionTutorialSteps } from '@/config/tutorialSteps';
import { useAuthContext } from '@/contexts/AuthContext';
import { TutorialSection, TutorialState } from '@/types/tutorial';

interface TutorialContextType extends TutorialState {
  activeTutorialSteps: typeof onboardingSteps;
  mandatoryOnboarding: boolean;
  startSectionTutorial: (section: TutorialSection) => void;
  nextStep: () => void;
  skipTutorial: () => void;
}

const TutorialContext = createContext<TutorialContextType | undefined>(undefined);

const getStorageKey = (userId: string) => `fintrack:tutorial:${userId}`;

const defaultState: TutorialState = {
  hasCompletedOnboarding: false,
  completedSections: [],
  activeTutorialId: null,
  currentStepIndex: 0,
};

export function TutorialProvider({ children }: { children: ReactNode }) {
  const { user } = useAuthContext();
  const [state, setState] = useState<TutorialState>(defaultState);

  useEffect(() => {
    if (!user) {
      setState(defaultState);
      return;
    }

    const raw = localStorage.getItem(getStorageKey(user.id));
    if (!raw) {
      setState({ ...defaultState, activeTutorialId: 'onboarding' });
      return;
    }

    try {
      const parsed = JSON.parse(raw) as TutorialState;
      setState({ ...defaultState, ...parsed });
    } catch {
      setState({ ...defaultState, activeTutorialId: 'onboarding' });
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    localStorage.setItem(getStorageKey(user.id), JSON.stringify(state));
  }, [state, user]);

  const activeTutorialSteps = useMemo(() => {
    if (state.activeTutorialId === 'onboarding') return onboardingSteps;
    if (!state.activeTutorialId) return [];
    return sectionTutorialSteps[state.activeTutorialId];
  }, [state.activeTutorialId]);

  const markSectionsComplete = (sections: TutorialSection[]) => {
    setState((prev) => ({
      ...prev,
      completedSections: Array.from(new Set([...prev.completedSections, ...sections])),
    }));
  };

  const nextStep = () => {
    setState((prev) => {
      const nextIndex = prev.currentStepIndex + 1;
      const steps =
        prev.activeTutorialId === 'onboarding'
          ? onboardingSteps
          : prev.activeTutorialId
            ? sectionTutorialSteps[prev.activeTutorialId]
            : [];

      if (nextIndex >= steps.length) {
        const completedSections = steps.map((step) => step.section);
        return {
          ...prev,
          hasCompletedOnboarding: prev.hasCompletedOnboarding || prev.activeTutorialId === 'onboarding',
          completedSections: Array.from(new Set([...prev.completedSections, ...completedSections])),
          activeTutorialId: null,
          currentStepIndex: 0,
        };
      }

      return { ...prev, currentStepIndex: nextIndex };
    });
  };

  const skipTutorial = () => {
    setState((prev) => ({
      ...prev,
      hasCompletedOnboarding: prev.hasCompletedOnboarding || prev.activeTutorialId === 'onboarding',
      activeTutorialId: null,
      currentStepIndex: 0,
    }));
  };

  const startSectionTutorial = (section: TutorialSection) => {
    markSectionsComplete([]);
    setState((prev) => ({
      ...prev,
      activeTutorialId: section,
      currentStepIndex: 0,
    }));
  };

  const value: TutorialContextType = {
    ...state,
    activeTutorialSteps,
    mandatoryOnboarding: !state.hasCompletedOnboarding && state.activeTutorialId === 'onboarding',
    startSectionTutorial,
    nextStep,
    skipTutorial,
  };

  return <TutorialContext.Provider value={value}>{children}</TutorialContext.Provider>;
}

export function useTutorial() {
  const context = useContext(TutorialContext);
  if (!context) {
    throw new Error('useTutorial must be used within TutorialProvider');
  }
  return context;
}
