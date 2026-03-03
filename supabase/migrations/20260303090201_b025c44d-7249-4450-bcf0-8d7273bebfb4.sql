
CREATE OR REPLACE FUNCTION public.increment_import_rule_usage(p_increments JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item JSONB;
  v_rule_id UUID;
  v_increment INTEGER;
  v_array_len INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_increments IS NULL OR jsonb_typeof(p_increments) <> 'array' THEN
    RETURN;
  END IF;

  -- Limit array length to prevent excessive iterations
  v_array_len := jsonb_array_length(p_increments);
  IF v_array_len > 500 THEN
    RAISE EXCEPTION 'Too many rule increments (max 500)';
  END IF;

  FOR item IN SELECT * FROM jsonb_array_elements(p_increments)
  LOOP
    -- Validate types before casting
    BEGIN
      v_rule_id := (item->>'rule_id')::uuid;
      v_increment := COALESCE((item->>'increment')::integer, 0);
    EXCEPTION WHEN OTHERS THEN
      -- Skip malformed entries instead of failing the whole batch
      CONTINUE;
    END;

    IF v_rule_id IS NULL OR v_increment <= 0 THEN
      CONTINUE;
    END IF;

    -- Cap individual increment to prevent abuse
    IF v_increment > 10000 THEN
      v_increment := 10000;
    END IF;

    UPDATE public.import_rules
    SET
      times_applied = COALESCE(times_applied, 0) + v_increment,
      last_applied_at = NOW(),
      updated_at = NOW()
    WHERE id = v_rule_id
      AND user_id = auth.uid();
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_import_rule_usage(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_import_rule_usage(JSONB) TO authenticated;
