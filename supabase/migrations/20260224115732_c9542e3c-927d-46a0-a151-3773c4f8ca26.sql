CREATE OR REPLACE FUNCTION public.get_yearly_summary(p_year integer)
 RETURNS json
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
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
          mcs.month as month_date,
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
$function$;