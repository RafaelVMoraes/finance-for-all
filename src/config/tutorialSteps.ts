import { TutorialSection, TutorialStepConfig } from '@/types/tutorial';

export const tutorialSectionLabels: Record<TutorialSection, string> = {
  dashboard: 'Dashboard tutorial',
  transactions: 'Transactions tutorial',
  budget: 'Budget tutorial',
  investment: 'Investments tutorial',
  import: 'Import tutorial',
};

export const onboardingSteps: TutorialStepConfig[] = [
  {
    id: 'dashboard-view-toggle',
    section: 'dashboard',
    route: '/dashboard',
    selector: '[data-tutorial="dashboard-view-tabs"]',
    title: 'Dashboard monthly and yearly views',
    description: 'Switch between monthly and yearly analytics here. Use monthly for execution and yearly for trends.',
  },
  {
    id: 'dashboard-key-metrics',
    section: 'dashboard',
    route: '/dashboard',
    selector: '[data-tutorial="dashboard-key-metrics"]',
    title: 'Core monthly indicators',
    description: 'These cards summarize income, expenses, savings and budget balance for the selected period.',
  },
  {
    id: 'transaction-filters',
    section: 'transactions',
    route: '/transactions',
    selector: '[data-tutorial="transactions-filters"]',
    title: 'Transaction filters',
    description: 'Filter by category, status, date and amount to quickly isolate what you need.',
  },
  {
    id: 'budget-overview',
    section: 'budget',
    route: '/budget',
    selector: '[data-tutorial="budget-overview-cards"]',
    title: 'Budget overview (view-only)',
    description: 'This page is your read-only budget health view across fixed and variable expenses.',
  },
  {
    id: 'budget-category-edit-link',
    section: 'budget',
    route: '/budget',
    selector: '[data-tutorial="budget-edit-categories-link"]',
    title: 'Edit categories and distribution rules',
    description: 'Open categories to configure fixed/variable types, distribution mode, and planned values.',
  },
  {
    id: 'investment-main-currency',
    section: 'investment',
    route: '/investments',
    selector: '[data-tutorial="investments-main-currency"]',
    title: 'Main investment currency',
    description: 'Set your base currency for consolidated portfolio totals and comparisons.',
  },
  {
    id: 'investment-types-and-assets',
    section: 'investment',
    route: '/investments',
    selector: '[data-tutorial="investments-types-assets"]',
    title: 'Types and assets',
    description: 'Manage investment types and add assets to keep allocations and totals up to date.',
  },
  {
    id: 'import-source-template',
    section: 'import',
    route: '/import',
    selector: '[data-tutorial="import-source-template"]',
    title: 'Import source and template',
    description: 'Choose a source and use your template-driven flow to speed up recurring imports.',
  },
  {
    id: 'import-mapping',
    section: 'import',
    route: '/import',
    selector: '[data-tutorial="import-mapping-rules"]',
    title: 'Column and category mapping rules',
    description: 'Map source columns and category behavior so imports are clean and predictable.',
  },
  {
    id: 'import-history',
    section: 'import',
    route: '/import',
    selector: '[data-tutorial="import-history"]',
    title: 'Import history management',
    description: 'Track previous imports and review outcomes to maintain data quality over time.',
  },
];

export const sectionTutorialSteps: Record<TutorialSection, TutorialStepConfig[]> = {
  dashboard: onboardingSteps.filter((step) => step.section === 'dashboard'),
  transactions: onboardingSteps.filter((step) => step.section === 'transactions'),
  budget: onboardingSteps.filter((step) => step.section === 'budget'),
  investment: onboardingSteps.filter((step) => step.section === 'investment'),
  import: onboardingSteps.filter((step) => step.section === 'import'),
};
