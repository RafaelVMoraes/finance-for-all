import { TranslationTree } from '../types';

export const pt: TranslationTree = {
  common: { appName: 'FinTrack', loading: 'Carregando...', save: 'Salvar', cancel: 'Cancelar', delete: 'Excluir', close: 'Fechar' },
  language: { label: 'Idioma', en: 'Inglês', fr: 'Francês', pt: 'Português' },
  nav: { dashboard: 'Painel', transactions: 'Transações', budget: 'Orçamento', investments: 'Investimentos', import: 'Importar', tutorials: 'Tutoriais', logout: 'Sair', openNavigation: 'Abrir navegação' },
  auth: { subtitle: 'Gerencie suas finanças com clareza', login: 'Entrar', signUp: 'Cadastrar', email: 'E-mail', password: 'Senha', emailPlaceholder: 'voce@exemplo.com', signIn: 'Entrar', signingIn: 'Entrando...', createAccount: 'Criar conta', creatingAccount: 'Criando conta...', errorTitle: 'Erro', welcomeBack: 'Bem-vindo de volta!', accountCreated: 'Conta criada!', confirmEmail: 'Confira seu e-mail para confirmar sua conta.', redirecting: 'Redirecionando para o painel...' },
  pwa: { updateAvailableTitle: 'Atualização disponível', updateAvailableDescription: 'Uma nova versão está pronta. Atualize agora para obter as últimas melhorias.', refreshNow: 'Atualizar agora', dismiss: 'Dispensar', offline: 'Você está offline. Alguns dados ao vivo podem não estar disponíveis.' },
  notFound: { title: 'Ops! Página não encontrada', returnHome: 'Voltar para início' },
  protectedRoute: { checkingSession: 'Verificando sessão...' },
  deleteAccount: { button: 'Excluir conta', title: 'Excluir conta permanentemente?', description: 'Esta ação não pode ser desfeita. Vamos remover permanentemente sua conta e todos os dados relacionados.', consequencesTitle: 'Isso excluirá permanentemente:', consequenceTransactions: 'Todas as transações e arquivos importados', consequenceCategories: 'Todas as categorias e orçamentos', consequenceInvestments: 'Todos os investimentos e configurações de câmbio', consequenceRules: 'Todas as regras e mapeamentos de importação', confirmLabel: 'Digite {{text}} para confirmar:', placeholder: 'Digite o texto de confirmação', cancel: 'Cancelar', confirm: 'Excluir minha conta', deleting: 'Excluindo...', successTitle: 'Conta excluída', successDescription: 'Todos os seus dados foram removidos permanentemente.', errorDescription: 'Falha ao excluir conta. Tente novamente.' },
  tutorial: {
    step: 'Etapa {{current}} / {{total}}', next: 'Próximo', finish: 'Concluir', skip: 'Pular tutorial',
    sections: { dashboard: 'Tutorial do painel', transactions: 'Tutorial de transações', budget: 'Tutorial de orçamento', investment: 'Tutorial de investimentos', import: 'Tutorial de importação' },
    steps: {
      'dashboard-view-toggle': { title: 'Visões mensal e anual do painel', description: 'Alterne entre análises mensais e anuais aqui. Use mensal para execução e anual para tendências.' },
      'dashboard-key-metrics': { title: 'Indicadores mensais principais', description: 'Esses cartões resumem receitas, despesas, poupança e saldo do orçamento para o período selecionado.' },
      'transaction-filters': { title: 'Filtros de transação', description: 'Filtre por categoria, status, data e valor para isolar rapidamente o que você precisa.' },
      'budget-overview': { title: 'Visão geral do orçamento (somente leitura)', description: 'Esta página é sua visão somente leitura da saúde orçamentária entre despesas fixas e variáveis.' },
      'budget-category-edit-link': { title: 'Editar categorias e regras de distribuição', description: 'Abra categorias para configurar tipos fixo/variável, modo de distribuição e valores planejados.' },
      'investment-main-currency': { title: 'Moeda principal de investimento', description: 'Defina sua moeda base para totais consolidados da carteira e comparações.' },
      'investment-types-and-assets': { title: 'Tipos e ativos', description: 'Gerencie tipos de investimento e adicione ativos para manter alocações e totais atualizados.' },
      'import-source-template': { title: 'Fonte de importação e modelo', description: 'Escolha uma fonte e use seu fluxo orientado por modelo para acelerar importações recorrentes.' },
      'import-mapping': { title: 'Regras de mapeamento de colunas e categorias', description: 'Mapeie colunas de origem e comportamento de categorias para importações limpas e previsíveis.' },
      'import-history': { title: 'Gerenciamento do histórico de importação', description: 'Acompanhe importações anteriores e revise resultados para manter a qualidade dos dados.' }
    }
  }
};
