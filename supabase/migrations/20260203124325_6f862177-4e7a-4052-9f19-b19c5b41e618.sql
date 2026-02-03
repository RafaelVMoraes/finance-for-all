-- ============================================================
-- MANDATORY FIX #1: Transactions Query Optimization Indexes
-- ============================================================

-- Primary composite index for transactions queries
-- Optimizes: user_id filtering + payment_date range + keyset pagination
-- This is the critical index for all transaction list queries
CREATE INDEX IF NOT EXISTS idx_transactions_user_payment_date_id 
ON public.transactions (user_id, payment_date DESC, id DESC);

-- Index for category joins (categories.id is already PK, but ensure it's optimized)
-- The primary key already creates an index, but we ensure it exists
-- No action needed as id is already the primary key

-- Index for filtering by category_id (for category-specific queries)
CREATE INDEX IF NOT EXISTS idx_transactions_category_id 
ON public.transactions (category_id) 
WHERE category_id IS NOT NULL;

-- Composite index for user + category queries
CREATE INDEX IF NOT EXISTS idx_transactions_user_category 
ON public.transactions (user_id, category_id);

-- ============================================================
-- MANDATORY FIX #2: RLS Performance Optimization
-- ============================================================

-- Index to support RLS policies that check user_id = auth.uid()
-- This ensures RLS predicates are fast
CREATE INDEX IF NOT EXISTS idx_transactions_user_id 
ON public.transactions (user_id);

CREATE INDEX IF NOT EXISTS idx_categories_user_id 
ON public.categories (user_id);

CREATE INDEX IF NOT EXISTS idx_budgets_user_id 
ON public.budgets (user_id);

CREATE INDEX IF NOT EXISTS idx_investments_user_id 
ON public.investments (user_id);

CREATE INDEX IF NOT EXISTS idx_monthly_settings_user_id 
ON public.monthly_settings (user_id);

-- ============================================================
-- Additional Indexes for Common Query Patterns
-- ============================================================

-- Index for monthly_settings lookups (user + month)
CREATE INDEX IF NOT EXISTS idx_monthly_settings_user_month 
ON public.monthly_settings (user_id, month);

-- Index for investment snapshots by investment and month
CREATE INDEX IF NOT EXISTS idx_investment_snapshots_investment_month 
ON public.investment_snapshots (investment_id, month DESC);

-- Index for exchange rates lookup
CREATE INDEX IF NOT EXISTS idx_exchange_rates_user_from_to_month 
ON public.exchange_rates (user_id, from_currency, to_currency, month DESC);

-- Index for import batches by user
CREATE INDEX IF NOT EXISTS idx_import_batches_user_id 
ON public.import_batches (user_id);