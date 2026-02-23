# Revisão da base de código: erros e otimizações no uso da base de dados

## Resumo executivo

A aplicação já possui bons fundamentos (RLS, índices compostos e algumas queries com paginação por cursor), mas ainda existem gargalos importantes de I/O e consistência transacional no fluxo de importação e em leituras de alto volume.

Os principais riscos estão em:

1. **Detecção de duplicados carregando toda a tabela de transações para memória**.
2. **Atualização de estatísticas de regras com padrão N+1 e sem atomicidade**.
3. **Paginação com filtro de “completo/incompleto” sendo aplicado no cliente (inconsistência de `hasMore`)**.
4. **Uso de `select('*')` em hooks com potencial de crescimento de payload**.
5. **Uso de `AbortController` sem integração real com a requisição Supabase (falsa sensação de cancelamento)**.

---

## Problemas encontrados (com impacto)

### 1) `checkDuplicates` busca todas as transações do usuário
- Local: `src/hooks/useImport.ts`.
- Problema: o método faz `select('payment_date, original_label, amount')` filtrando apenas por `user_id`, sem recorte por período/lotes, puxando potencialmente milhares de linhas para o cliente.
- Impacto:
  - Latência alta para usuários com histórico longo.
  - Uso desnecessário de banda e memória no browser.
  - Escalabilidade ruim conforme crescimento da base.

### 2) Atualização de uso de regras com N+1 e sem transação
- Local: `src/hooks/useImport.ts`.
- Problema: para cada regra aplicada, há um `select` seguido de `update` assíncrono “fire-and-forget”.
- Impacto:
  - Muitas round-trips ao banco.
  - Risco de condição de corrida no incremento de `times_applied`.
  - Inconsistência se uma atualização falhar silenciosamente.

### 3) Filtro de status de conclusão no cliente após paginação
- Local: `src/hooks/useTransactions.ts`.
- Problema: `completionStatus` é filtrado em memória após a query paginada; `hasMore` é derivado do resultado já filtrado.
- Impacto:
  - Usuário pode receber menos itens por página e ainda existir mais dados no banco.
  - `hasMore` pode ser falso-positivo/negativo.
  - Desempenho pior por trafegar dados que serão descartados.

### 4) `select('*')` em vários hooks
- Locais: `src/hooks/useBudgets.ts`, `src/hooks/useInvestments.ts` e em consultas secundárias.
- Problema: colunas desnecessárias são retornadas por padrão.
- Impacto:
  - Payload maior e mais lento.
  - Acoplamento com mudanças de schema (novas colunas impactam tráfego sem necessidade).

### 5) `AbortController` sem efeito prático nas queries
- Local: `src/hooks/useDashboardData.ts`.
- Problema: o hook cria/aborta `AbortController`, mas a chamada `supabase.rpc(...)` não recebe o `signal`.
- Impacto:
  - Requisições antigas continuam em voo.
  - Maior chance de race condition de UI (resposta antiga sobrescrevendo estado recente).

---

## Tarefa sugerida (única, com foco em correção + otimização)

## **Tarefa: “Consolidar importação e paginação em RPCs transacionais e server-side filters”**

### Objetivo
Reduzir latência e custo de I/O, eliminando N+1 e movendo a lógica crítica para o banco com atomicidade.

### Escopo técnico
1. **Criar RPC `import_transactions_v2`** que:
   - Receba linhas válidas (JSONB) + metadados do lote.
   - Faça deduplicação no banco (usando chave única existente).
   - Insira transações e atualize `import_batches.row_count` dentro da mesma transação.
   - Atualize `times_applied` com `UPDATE ... SET times_applied = times_applied + ?` em lote.

2. **Criar RPC `check_duplicates_v2`** que:
   - Receba array de possíveis chaves e retorne apenas as que já existem.
   - Evite carregar todo o histórico do usuário no front.

3. **Mover filtro `completionStatus` para SQL** em `useTransactions`:
   - `category_id is null` / `is not null` já na query.
   - `hasMore` baseado no conjunto real retornado pelo banco.

4. **Padronizar projeção explícita de colunas**:
   - Remover `select('*')` dos hooks principais.

5. **Ajustar cancelamento de requisições**:
   - Integrar `AbortSignal` nas chamadas suportadas ou substituir por controle de stale response (request id).

### Critérios de aceite
- Importação de 10k linhas sem travar UI e com no máximo 3 round-trips principais.
- `times_applied` consistente em cenários concorrentes.
- Paginação de transações com `completionStatus` sem inconsistência de `hasMore`.
- Redução de payload nas rotas auditadas (sem `select('*')`).
- Sem regressão funcional em criação/edição/exclusão de transações.

### Prioridade
**Alta** (impacta custo de banco, experiência de importação e confiabilidade dos dados).

---

## Observações positivas
- Há índice composto para paginação por cursor em transações (`user_id, payment_date DESC, id DESC`).
- Há preocupação explícita com RLS performance nos scripts de migration.
- O fluxo já separa regras de importação e permite evoluir para processamento server-side com baixo risco arquitetural.
