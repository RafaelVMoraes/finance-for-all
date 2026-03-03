import { TranslationTree } from '../types';

export const fr: TranslationTree = {
  common: { appName: 'FinTrack', loading: 'Chargement...', save: 'Enregistrer', cancel: 'Annuler', delete: 'Supprimer', close: 'Fermer' },
  language: { label: 'Langue', en: 'Anglais', fr: 'Français', pt: 'Portugais' },
  nav: { dashboard: 'Tableau de bord', transactions: 'Transactions', budget: 'Budget', investments: 'Investissements', import: 'Import', tutorials: 'Tutoriels', logout: 'Se déconnecter', openNavigation: 'Ouvrir la navigation' },
  auth: {
    subtitle: 'Gérez vos finances avec clarté', login: 'Connexion', signUp: 'Créer un compte', email: 'E-mail', password: 'Mot de passe', emailPlaceholder: 'vous@exemple.com', signIn: 'Se connecter', signingIn: 'Connexion...', createAccount: 'Créer un compte', creatingAccount: 'Création du compte...', errorTitle: 'Erreur', welcomeBack: 'Bon retour !', accountCreated: 'Compte créé !', confirmEmail: 'Veuillez vérifier votre e-mail pour confirmer votre compte.', redirecting: 'Redirection vers le tableau de bord...'
  },
  pwa: { updateAvailableTitle: 'Mise à jour disponible', updateAvailableDescription: 'Une nouvelle version est prête. Actualisez maintenant pour obtenir les dernières améliorations.', refreshNow: 'Actualiser', dismiss: 'Ignorer', offline: 'Vous êtes hors ligne. Certaines données en direct peuvent être indisponibles.' },
  notFound: { title: 'Oups ! Page introuvable', returnHome: "Retour à l'accueil" },
  protectedRoute: { checkingSession: 'Vérification de la session...' },
  deleteAccount: {
    button: 'Supprimer le compte', title: 'Supprimer définitivement le compte ?', description: 'Cette action est irréversible. Nous supprimerons définitivement votre compte et toutes les données associées.', consequencesTitle: 'Cela supprimera définitivement :', consequenceTransactions: 'Toutes les transactions et fichiers importés', consequenceCategories: 'Toutes les catégories et tous les budgets', consequenceInvestments: 'Tous les investissements et paramètres de change', consequenceRules: "Toutes les règles d'import et de mappage", confirmLabel: 'Saisissez {{text}} pour confirmer :', placeholder: 'Saisissez le texte de confirmation', cancel: 'Annuler', confirm: 'Supprimer mon compte', deleting: 'Suppression...', successTitle: 'Compte supprimé', successDescription: 'Toutes vos données ont été supprimées définitivement.', errorDescription: 'Échec de la suppression du compte. Veuillez réessayer.'
  },
  tutorial: {
    step: 'Étape {{current}} / {{total}}', next: 'Suivant', finish: 'Terminer', skip: 'Passer le tutoriel',
    sections: { dashboard: 'Tutoriel tableau de bord', transactions: 'Tutoriel transactions', budget: 'Tutoriel budget', investment: 'Tutoriel investissements', import: "Tutoriel d'import" },
    steps: {
      'dashboard-view-toggle': { title: 'Vues mensuelle et annuelle du tableau de bord', description: "Basculez entre les analyses mensuelles et annuelles ici. Utilisez le mensuel pour l'exécution et l'annuel pour les tendances." },
      'dashboard-key-metrics': { title: 'Indicateurs mensuels principaux', description: 'Ces cartes résument les revenus, dépenses, épargne et solde budgétaire pour la période sélectionnée.' },
      'transaction-filters': { title: 'Filtres de transaction', description: 'Filtrez par catégorie, statut, date et montant pour isoler rapidement ce dont vous avez besoin.' },
      'budget-overview': { title: 'Aperçu du budget (lecture seule)', description: 'Cette page est votre vue en lecture seule de la santé budgétaire sur les dépenses fixes et variables.' },
      'budget-category-edit-link': { title: 'Modifier catégories et règles de répartition', description: 'Ouvrez les catégories pour configurer les types fixe/variable, le mode de répartition et les valeurs planifiées.' },
      'investment-main-currency': { title: "Devise principale d'investissement", description: 'Définissez votre devise de base pour les totaux consolidés du portefeuille et les comparaisons.' },
      'investment-types-and-assets': { title: 'Types et actifs', description: 'Gérez les types d’investissement et ajoutez des actifs pour maintenir allocations et totaux à jour.' },
      'import-source-template': { title: "Source d'import et modèle", description: 'Choisissez une source et utilisez votre flux basé sur des modèles pour accélérer les imports récurrents.' },
      'import-mapping': { title: 'Règles de mappage des colonnes et catégories', description: 'Mappez les colonnes source et le comportement des catégories pour des imports propres et prévisibles.' },
      'import-history': { title: "Gestion de l'historique des imports", description: 'Suivez les imports précédents et examinez les résultats pour maintenir la qualité des données.' }
    }
  },
  budget: {
    loading: 'Chargement du budget...', editCategories: 'Modifier les catégories', spent: 'dépensé', remaining: 'restant', noBudgetSet: 'Aucun budget défini', includedInActualIncome: 'Inclus dans le revenu réel mensuel',
    cards: { expectedIncome: 'Revenu attendu', real: 'Réel', fixedExpenses: 'Dépenses fixes', variableExpenses: 'Dépenses variables', estimatedSavings: 'Épargne estimée', actual: 'Réel', spent: 'Dépensé' },
    sections: { fixedExpensesBudget: 'Budget des dépenses fixes', variableExpensesBudget: 'Budget des dépenses variables', expectedIncomeSources: 'Sources de revenu attendues' },
    empty: { noCategories: 'Aucune catégorie pour le moment.', createCategoriesFirst: 'Créez d’abord des catégories pour configurer votre budget.', createCategories: 'Créer des catégories' }
  },
  importPage: {
    title: 'Importer des transactions', importRules: "Règles d'import", history: "Historique d'import", uploadTitle: "Téléverser un fichier d'import", sourceLabel: "Source d'import (optionnelle)", selectSource: 'Sélectionner une source...', noSource: 'Aucune source', addSource: 'Ajouter une source'
  },
  investments: {
    title: 'Investissements', loading: 'Chargement des investissements...', manageTypes: 'Gérer les types', addAsset: 'Ajouter un actif',
    summary: { totalNetWorth: 'Valeur nette totale' },
    assets: { title: 'Vos actifs', empty: 'Aucun actif pour ce mois. Ajoutez votre premier investissement.' }
  },
  transactions: { title: 'Transactions', add: 'Ajouter', import: 'Importer' },
  dashboard: {
    budgetAlerts: 'Alertes budget', categoryBudgetProgress: 'Progression du budget par catégorie', monthlyNotes: 'Notes mensuelles', avgIncome: 'Revenu moyen', avgExpenses: 'Dépenses moyennes', avgSavings: 'Épargne moyenne', netWorth: 'Valeur nette', incomeVsExpenses: 'Revenus vs dépenses', monthly: 'Mensuel', quarterly: 'Trimestriel', budgetVsReality: 'Budget vs réalité', heatmapTitle: 'Carte de chaleur (Catégorie × Mois)', heatmapSubtitle: "Intensité relative au mois de pic de chaque catégorie.", investmentsStacked: 'Investissements (Valeur nette empilée en {{currency}})'
  }
};
