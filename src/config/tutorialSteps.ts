import { TutorialSection, TutorialStepConfig } from '@/types/tutorial';

export const tutorialSectionLabels: Record<TutorialSection, string> = {
  dashboard: 'tutorial.sections.dashboard',
  transactions: 'tutorial.sections.transactions',
  budget: 'tutorial.sections.budget',
  investment: 'tutorial.sections.investment',
  import: 'tutorial.sections.import',
};

export const onboardingSteps: TutorialStepConfig[] = [
  { id: 'dashboard-view-toggle', section: 'dashboard', route: '/view', selector: '[data-tutorial="dashboard-view-tabs"]', title: 'tutorial.steps.dashboard-view-toggle.title', description: 'tutorial.steps.dashboard-view-toggle.description' },
  { id: 'dashboard-key-metrics', section: 'dashboard', route: '/view', selector: '[data-tutorial="dashboard-key-metrics"]', title: 'tutorial.steps.dashboard-key-metrics.title', description: 'tutorial.steps.dashboard-key-metrics.description' },
  { id: 'transaction-filters', section: 'transactions', route: '/input/transactions', selector: '[data-tutorial="transactions-filters"]', title: 'tutorial.steps.transaction-filters.title', description: 'tutorial.steps.transaction-filters.description' },
  { id: 'budget-overview', section: 'budget', route: '/input/budget', selector: '[data-tutorial="budget-overview-cards"]', title: 'tutorial.steps.budget-overview.title', description: 'tutorial.steps.budget-overview.description' },
  { id: 'budget-category-edit-link', section: 'budget', route: '/input/budget', selector: '[data-tutorial="budget-edit-categories-link"]', title: 'tutorial.steps.budget-category-edit-link.title', description: 'tutorial.steps.budget-category-edit-link.description' },
  { id: 'investment-main-currency', section: 'investment', route: '/input/investments', selector: '[data-tutorial="investments-main-currency"]', title: 'tutorial.steps.investment-main-currency.title', description: 'tutorial.steps.investment-main-currency.description' },
  { id: 'investment-types-and-assets', section: 'investment', route: '/input/investments', selector: '[data-tutorial="investments-types-assets"]', title: 'tutorial.steps.investment-types-and-assets.title', description: 'tutorial.steps.investment-types-and-assets.description' },
  { id: 'import-source-template', section: 'import', route: '/input', selector: '[data-tutorial="import-source-template"]', title: 'tutorial.steps.import-source-template.title', description: 'tutorial.steps.import-source-template.description' },
  { id: 'import-mapping', section: 'import', route: '/input', selector: '[data-tutorial="import-mapping-rules"]', title: 'tutorial.steps.import-mapping.title', description: 'tutorial.steps.import-mapping.description' },
  { id: 'import-history', section: 'import', route: '/input', selector: '[data-tutorial="import-history"]', title: 'tutorial.steps.import-history.title', description: 'tutorial.steps.import-history.description' },
];

export const sectionTutorialSteps: Record<TutorialSection, TutorialStepConfig[]> = {
  dashboard: onboardingSteps.filter((step) => step.section === 'dashboard'),
  transactions: onboardingSteps.filter((step) => step.section === 'transactions'),
  budget: onboardingSteps.filter((step) => step.section === 'budget'),
  investment: onboardingSteps.filter((step) => step.section === 'investment'),
  import: onboardingSteps.filter((step) => step.section === 'import'),
};
