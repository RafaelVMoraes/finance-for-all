export type TutorialSection = 'import' | 'investment' | 'budget' | 'transactions' | 'dashboard';

export interface TutorialStepConfig {
  id: string;
  section: TutorialSection;
  route: string;
  selector: string;
  title: string;
  description: string;
}

export interface TutorialState {
  hasCompletedOnboarding: boolean;
  completedSections: TutorialSection[];
  activeTutorialId: 'onboarding' | TutorialSection | null;
  currentStepIndex: number;
}
