
-- =============================================
-- Phase 1: Monthly Aggregation Table
-- =============================================

-- Pre-aggregated monthly spending by category (dashboards read this, not raw transactions)
CREATE TABLE public.monthly_category_summary (
  user_id uuid NOT NULL,
  month date NOT NULL,
  category_id uuid REFERENCES public.categories(id) ON DELETE CASCADE,
  total_amount numeric NOT NULL DEFAULT 0,
  transaction_count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, month, category_id)
);

-- Uncategorized spending (category_id IS NULL) stored with a sentinel row
-- We use a separate table for totals without category breakdown
CREATE TABLE public.monthly_totals (
  user_id uuid NOT NULL,
  month date NOT NULL,
  total_income numeric NOT NULL DEFAULT 0,
  total_expenses numeric NOT NULL DEFAULT 0,
  transaction_count integer NOT NULL DEFAULT 0,
  incomplete_count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, month)
);

-- RLS on aggregation tables
ALTER TABLE public.monthly_category_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_totals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own summaries" ON public.monthly_category_summary FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own summaries" ON public.monthly_category_summary FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can view own totals" ON public.monthly_totals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own totals" ON public.monthly_totals FOR ALL USING (auth.uid() = user_id);

-- Index for fast lookups
CREATE INDEX idx_monthly_category_summary_user_month ON public.monthly_category_summary(user_id, month);
CREATE INDEX idx_monthly_totals_user_month ON public.monthly_totals(user_id, month);

-- =============================================
-- Phase 2: Trigger to maintain aggregation tables
-- =============================================

CREATE OR REPLACE FUNCTION public.refresh_monthly_summary()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_month date;
  v_old_month date;
BEGIN
  -- Determine affected user and month(s)
  IF TG_OP = 'DELETE' THEN
    v_user_id := OLD.user_id;
    v_month := date_trunc('month', OLD.payment_date)::date;
  ELSIF TG_OP = 'UPDATE' THEN
    v_user_id := NEW.user_id;
    v_month := date_trunc('month', NEW.payment_date)::date;
    v_old_month := date_trunc('month', OLD.payment_date)::date;
  ELSE
    v_user_id := NEW.user_id;
    v_month := date_trunc('month', NEW.payment_date)::date;
  END IF;

  -- Refresh totals for affected month
  INSERT INTO monthly_totals (user_id, month, total_income, total_expenses, transaction_count, incomplete_count)
  SELECT 
    v_user_id,
    v_month,
    COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0),
    COUNT(*),
    COUNT(*) FILTER (WHERE category_id IS NULL)
  FROM transactions
  WHERE user_id = v_user_id AND date_trunc('month', payment_date)::date = v_month
  ON CONFLICT (user_id, month) DO UPDATE SET
    total_income = EXCLUDED.total_income,
    total_expenses = EXCLUDED.total_expenses,
    transaction_count = EXCLUDED.transaction_count,
    incomplete_count = EXCLUDED.incomplete_count;

  -- Refresh category summaries for affected month
  DELETE FROM monthly_category_summary WHERE user_id = v_user_id AND month = v_month;
  INSERT INTO monthly_category_summary (user_id, month, category_id, total_amount, transaction_count)
  SELECT 
    v_user_id,
    v_month,
    category_id,
    SUM(ABS(amount)),
    COUNT(*)
  FROM transactions
  WHERE user_id = v_user_id 
    AND date_trunc('month', payment_date)::date = v_month
    AND category_id IS NOT NULL
    AND amount < 0
  GROUP BY category_id;

  -- If month changed on UPDATE, also refresh the old month
  IF TG_OP = 'UPDATE' AND v_old_month IS DISTINCT FROM v_month THEN
    INSERT INTO monthly_totals (user_id, month, total_income, total_expenses, transaction_count, incomplete_count)
    SELECT 
      v_user_id,
      v_old_month,
      COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0),
      COUNT(*),
      COUNT(*) FILTER (WHERE category_id IS NULL)
    FROM transactions
    WHERE user_id = v_user_id AND date_trunc('month', payment_date)::date = v_old_month
    ON CONFLICT (user_id, month) DO UPDATE SET
      total_income = EXCLUDED.total_income,
      total_expenses = EXCLUDED.total_expenses,
      transaction_count = EXCLUDED.transaction_count,
      incomplete_count = EXCLUDED.incomplete_count;

    DELETE FROM monthly_category_summary WHERE user_id = v_user_id AND month = v_old_month;
    INSERT INTO monthly_category_summary (user_id, month, category_id, total_amount, transaction_count)
    SELECT 
      v_user_id,
      v_old_month,
      category_id,
      SUM(ABS(amount)),
      COUNT(*)
    FROM transactions
    WHERE user_id = v_user_id 
      AND date_trunc('month', payment_date)::date = v_old_month
      AND category_id IS NOT NULL
      AND amount < 0
    GROUP BY category_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_refresh_monthly_summary
AFTER INSERT OR UPDATE OR DELETE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.refresh_monthly_summary();

-- =============================================
-- Phase 3: Backfill aggregation tables from existing data
-- =============================================

INSERT INTO monthly_totals (user_id, month, total_income, total_expenses, transaction_count, incomplete_count)
SELECT 
  user_id,
  date_trunc('month', payment_date)::date,
  COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0),
  COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0),
  COUNT(*),
  COUNT(*) FILTER (WHERE category_id IS NULL)
FROM transactions
GROUP BY user_id, date_trunc('month', payment_date)::date
ON CONFLICT (user_id, month) DO NOTHING;

INSERT INTO monthly_category_summary (user_id, month, category_id, total_amount, transaction_count)
SELECT 
  user_id,
  date_trunc('month', payment_date)::date,
  category_id,
  SUM(ABS(amount)),
  COUNT(*)
FROM transactions
WHERE category_id IS NOT NULL AND amount < 0
GROUP BY user_id, date_trunc('month', payment_date)::date, category_id
ON CONFLICT (user_id, month, category_id) DO NOTHING;

-- =============================================
-- Phase 4: Add investment_type_id FK to investments
-- =============================================

ALTER TABLE public.investments ADD COLUMN investment_type_id uuid REFERENCES public.investment_types(id) ON DELETE SET NULL;

-- Backfill: match existing text names to type IDs
UPDATE public.investments i
SET investment_type_id = it.id
FROM public.investment_types it
WHERE i.user_id = it.user_id AND i.investment_type = it.name;

CREATE INDEX idx_investments_type_id ON public.investments(investment_type_id);

-- =============================================
-- Phase 5: Ensure all critical indexes exist (IF NOT EXISTS to avoid conflicts)
-- =============================================

CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON public.transactions(user_id, payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_payment_date_id ON public.transactions(user_id, payment_date DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_category_id ON public.transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_batch ON public.transactions(import_batch_id);
CREATE INDEX IF NOT EXISTS idx_budgets_user_category ON public.budgets(user_id, category_id);
CREATE INDEX IF NOT EXISTS idx_categories_user ON public.categories(user_id);
CREATE INDEX IF NOT EXISTS idx_monthly_settings_user_month ON public.monthly_settings(user_id, month);
CREATE INDEX IF NOT EXISTS idx_investments_user ON public.investments(user_id);
CREATE INDEX IF NOT EXISTS idx_investment_snapshots_investment_month ON public.investment_snapshots(investment_id, month DESC);

-- =============================================
-- Phase 6: Optimized RPCs using aggregation tables
-- =============================================

-- Drop old overloaded versions
DROP FUNCTION IF EXISTS public.get_monthly_summary(uuid, date, date);
DROP FUNCTION IF EXISTS public.get_monthly_summary(date, date);

CREATE OR REPLACE FUNCTION public.get_monthly_summary(p_month_start date, p_month_end date)
RETURNS json
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
DECLARE
  result JSON;
  v_user_id UUID;
  v_month DATE;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  v_month := date_trunc('month', p_month_start)::date;

  SELECT json_build_object(
    'total_income', COALESCE(mt.total_income, 0),
    'total_expenses', COALESCE(mt.total_expenses, 0),
    'transaction_count', COALESCE(mt.transaction_count, 0),
    'incomplete_count', COALESCE(mt.incomplete_count, 0),
    'category_spending', (
      SELECT COALESCE(json_agg(cat_spend), '[]'::json)
      FROM (
        SELECT 
          c.id, c.name, c.color, c.type,
          COALESCE(mcs.total_amount, 0) as spent
        FROM categories c
        LEFT JOIN monthly_category_summary mcs 
          ON mcs.category_id = c.id 
          AND mcs.user_id = v_user_id 
          AND mcs.month = v_month
        WHERE c.user_id = v_user_id AND c.archived = false
      ) cat_spend
    ),
    'weekly_spending', (
      SELECT COALESCE(json_agg(week_data ORDER BY week_start), '[]'::json)
      FROM (
        SELECT 
          date_trunc('week', t.payment_date)::date as week_start,
          COALESCE(SUM(ABS(t.amount)), 0) as spent
        FROM transactions t
        WHERE t.user_id = v_user_id
          AND t.payment_date >= p_month_start 
          AND t.payment_date <= p_month_end
          AND t.amount < 0
        GROUP BY date_trunc('week', t.payment_date)
      ) week_data
    )
  ) INTO result
  FROM monthly_totals mt
  WHERE mt.user_id = v_user_id AND mt.month = v_month;

  -- If no summary row exists yet, return zeros
  IF result IS NULL THEN
    result := json_build_object(
      'total_income', 0, 'total_expenses', 0,
      'transaction_count', 0, 'incomplete_count', 0,
      'category_spending', (
        SELECT COALESCE(json_agg(json_build_object('id', c.id, 'name', c.name, 'color', c.color, 'type', c.type, 'spent', 0)), '[]'::json)
        FROM categories c WHERE c.user_id = v_user_id AND c.archived = false
      ),
      'weekly_spending', '[]'::json
    );
  END IF;

  RETURN result;
END;
$$;

-- Drop old overloaded versions
DROP FUNCTION IF EXISTS public.get_yearly_summary(uuid, integer);
DROP FUNCTION IF EXISTS public.get_yearly_summary(integer);

CREATE OR REPLACE FUNCTION public.get_yearly_summary(p_year integer)
RETURNS json
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
DECLARE
  result JSON;
  v_user_id UUID;
  year_start DATE;
  year_end DATE;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  year_start := make_date(p_year, 1, 1);
  year_end := make_date(p_year, 12, 31);

  SELECT json_build_object(
    'monthly_data', (
      SELECT COALESCE(json_agg(month_data ORDER BY month_date), '[]'::json)
      FROM (
        SELECT 
          mt.month as month_date,
          to_char(mt.month, 'Mon') as month_name,
          mt.total_income as income,
          -- For fixed/variable breakdown we still need category join but on summary table
          COALESCE((
            SELECT SUM(mcs.total_amount) 
            FROM monthly_category_summary mcs
            JOIN categories c ON c.id = mcs.category_id AND c.type = 'fixed'
            WHERE mcs.user_id = v_user_id AND mcs.month = mt.month
          ), 0) as fixed_expenses,
          COALESCE((
            SELECT SUM(mcs.total_amount) 
            FROM monthly_category_summary mcs
            JOIN categories c ON c.id = mcs.category_id AND c.type = 'variable'
            WHERE mcs.user_id = v_user_id AND mcs.month = mt.month
          ), 0) as variable_expenses,
          (mt.total_income - mt.total_expenses) as savings
        FROM monthly_totals mt
        WHERE mt.user_id = v_user_id
          AND mt.month >= year_start AND mt.month <= year_end
      ) month_data
    ),
    'category_monthly_spending', (
      SELECT COALESCE(json_agg(cat_month), '[]'::json)
      FROM (
        SELECT 
          c.id, c.name, c.color, c.type::text,
          to_char(mcs.month, 'Mon') as month_name,
          mcs.total_amount as spent
        FROM monthly_category_summary mcs
        JOIN categories c ON c.id = mcs.category_id
        WHERE mcs.user_id = v_user_id
          AND mcs.month >= year_start AND mcs.month <= year_end
          AND c.archived = false AND c.type != 'income'
      ) cat_month
    ),
    'total_income', (
      SELECT COALESCE(SUM(mt.total_income), 0)
      FROM monthly_totals mt
      WHERE mt.user_id = v_user_id AND mt.month >= year_start AND mt.month <= year_end
    ),
    'total_expenses', (
      SELECT COALESCE(SUM(mt.total_expenses), 0)
      FROM monthly_totals mt
      WHERE mt.user_id = v_user_id AND mt.month >= year_start AND mt.month <= year_end
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- Drop old overloaded versions
DROP FUNCTION IF EXISTS public.get_investment_summary(uuid);
DROP FUNCTION IF EXISTS public.get_investment_summary();

CREATE OR REPLACE FUNCTION public.get_investment_summary()
RETURNS json
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
DECLARE
  result JSON;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT json_build_object(
    'investments', (
      SELECT COALESCE(json_agg(inv_data), '[]'::json)
      FROM (
        SELECT 
          i.id, i.name, i.investment_type, i.currency, i.initial_amount,
          COALESCE(
            (SELECT json_agg(json_build_object('month', s.month, 'total_value', s.total_value) ORDER BY s.month DESC)
             FROM investment_snapshots s WHERE s.investment_id = i.id),
            '[]'::json
          ) as snapshots
        FROM investments i
        WHERE i.user_id = v_user_id
        ORDER BY i.name
      ) inv_data
    ),
    'total_value', (
      SELECT COALESCE(SUM(
        COALESCE(
          (SELECT s.total_value FROM investment_snapshots s WHERE s.investment_id = i.id ORDER BY s.month DESC LIMIT 1),
          i.initial_amount
        )
      ), 0)
      FROM investments i
      WHERE i.user_id = v_user_id
    )
  ) INTO result;

  RETURN result;
END;
$$;
