-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_transactions_user_payment_date 
ON public.transactions(user_id, payment_date DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_user_category_date 
ON public.transactions(user_id, category_id, payment_date DESC);

CREATE INDEX IF NOT EXISTS idx_investment_snapshots_investment_month 
ON public.investment_snapshots(investment_id, month DESC);

CREATE INDEX IF NOT EXISTS idx_budgets_user_category 
ON public.budgets(user_id, category_id);

CREATE INDEX IF NOT EXISTS idx_monthly_settings_user_month 
ON public.monthly_settings(user_id, month);

-- Create RPC function for monthly dashboard summary (aggregated data)
CREATE OR REPLACE FUNCTION public.get_monthly_summary(
  p_user_id UUID,
  p_month_start DATE,
  p_month_end DATE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_income', COALESCE(SUM(CASE WHEN t.amount > 0 THEN t.amount ELSE 0 END), 0),
    'total_expenses', COALESCE(SUM(CASE WHEN t.amount < 0 THEN ABS(t.amount) ELSE 0 END), 0),
    'transaction_count', COUNT(*),
    'incomplete_count', COUNT(*) FILTER (WHERE t.category_id IS NULL),
    'category_spending', (
      SELECT COALESCE(json_agg(cat_spend), '[]'::json)
      FROM (
        SELECT 
          c.id,
          c.name,
          c.color,
          c.type,
          COALESCE(SUM(ABS(t2.amount)), 0) as spent
        FROM categories c
        LEFT JOIN transactions t2 ON t2.category_id = c.id 
          AND t2.user_id = p_user_id
          AND t2.payment_date >= p_month_start 
          AND t2.payment_date <= p_month_end
          AND t2.amount < 0
        WHERE c.user_id = p_user_id AND c.archived = false
        GROUP BY c.id, c.name, c.color, c.type
      ) cat_spend
    ),
    'weekly_spending', (
      SELECT COALESCE(json_agg(week_data ORDER BY week_start), '[]'::json)
      FROM (
        SELECT 
          date_trunc('week', t3.payment_date)::date as week_start,
          COALESCE(SUM(ABS(t3.amount)), 0) as spent
        FROM transactions t3
        WHERE t3.user_id = p_user_id
          AND t3.payment_date >= p_month_start 
          AND t3.payment_date <= p_month_end
          AND t3.amount < 0
        GROUP BY date_trunc('week', t3.payment_date)
      ) week_data
    )
  ) INTO result
  FROM transactions t
  WHERE t.user_id = p_user_id
    AND t.payment_date >= p_month_start 
    AND t.payment_date <= p_month_end;

  RETURN result;
END;
$$;

-- Create RPC function for yearly dashboard summary
CREATE OR REPLACE FUNCTION public.get_yearly_summary(
  p_user_id UUID,
  p_year INTEGER
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  result JSON;
  year_start DATE;
  year_end DATE;
BEGIN
  year_start := make_date(p_year, 1, 1);
  year_end := make_date(p_year, 12, 31);

  SELECT json_build_object(
    'monthly_data', (
      SELECT COALESCE(json_agg(month_data ORDER BY month_date), '[]'::json)
      FROM (
        SELECT 
          date_trunc('month', t.payment_date)::date as month_date,
          to_char(date_trunc('month', t.payment_date), 'Mon') as month_name,
          COALESCE(SUM(CASE WHEN t.amount > 0 THEN t.amount ELSE 0 END), 0) as income,
          COALESCE(SUM(CASE WHEN t.amount < 0 AND c.type = 'fixed' THEN ABS(t.amount) ELSE 0 END), 0) as fixed_expenses,
          COALESCE(SUM(CASE WHEN t.amount < 0 AND c.type = 'variable' THEN ABS(t.amount) ELSE 0 END), 0) as variable_expenses,
          COALESCE(SUM(t.amount), 0) as savings
        FROM transactions t
        LEFT JOIN categories c ON c.id = t.category_id
        WHERE t.user_id = p_user_id
          AND t.payment_date >= year_start 
          AND t.payment_date <= year_end
        GROUP BY date_trunc('month', t.payment_date)
      ) month_data
    ),
    'category_monthly_spending', (
      SELECT COALESCE(json_agg(cat_month), '[]'::json)
      FROM (
        SELECT 
          c.id,
          c.name,
          c.color,
          c.type,
          to_char(date_trunc('month', t.payment_date), 'Mon') as month_name,
          COALESCE(SUM(ABS(t.amount)), 0) as spent
        FROM categories c
        LEFT JOIN transactions t ON t.category_id = c.id 
          AND t.user_id = p_user_id
          AND t.payment_date >= year_start 
          AND t.payment_date <= year_end
          AND t.amount < 0
        WHERE c.user_id = p_user_id AND c.archived = false AND c.type != 'income'
        GROUP BY c.id, c.name, c.color, c.type, date_trunc('month', t.payment_date)
      ) cat_month
    ),
    'total_income', (
      SELECT COALESCE(SUM(t.amount), 0)
      FROM transactions t
      WHERE t.user_id = p_user_id
        AND t.payment_date >= year_start 
        AND t.payment_date <= year_end
        AND t.amount > 0
    ),
    'total_expenses', (
      SELECT COALESCE(SUM(ABS(t.amount)), 0)
      FROM transactions t
      WHERE t.user_id = p_user_id
        AND t.payment_date >= year_start 
        AND t.payment_date <= year_end
        AND t.amount < 0
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- Create RPC function for investment evolution
CREATE OR REPLACE FUNCTION public.get_investment_summary(
  p_user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'investments', (
      SELECT COALESCE(json_agg(inv_data), '[]'::json)
      FROM (
        SELECT 
          i.id,
          i.name,
          i.investment_type,
          i.currency,
          i.initial_amount,
          (
            SELECT COALESCE(json_agg(snap ORDER BY s.month DESC), '[]'::json)
            FROM (
              SELECT s.month, s.total_value
              FROM investment_snapshots s
              WHERE s.investment_id = i.id
            ) snap
          ) as snapshots
        FROM investments i
        WHERE i.user_id = p_user_id
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
      WHERE i.user_id = p_user_id
    )
  ) INTO result;

  RETURN result;
END;
$$;