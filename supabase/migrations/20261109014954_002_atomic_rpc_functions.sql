/*
# Atomic RPC functions for category deletion and recurring creation

## Purpose
1. `delete_category(p_category_id uuid, p_reassign_to uuid)` — atomically reassigns
   all transactions, recurring_transactions, and deletes budgets referencing the
   category, then deletes the category itself. All in a single transaction so a
   failure at any step rolls back the entire operation (no orphaned references).
2. `create_recurring_with_transaction(p_user_id, p_type, p_name, p_amount, p_category_id,
   p_frequency, p_start_date, p_payment_method, p_description)` — atomically creates
   a recurring_transaction row AND its first transaction row together, linking them
   via recurring_id. Prevents the race where a recurring rule exists but its initial
   transaction was never created.

## Security
- Both functions are SECURITY DEFINER with a fixed search_path, so they run with the
  owner's privileges and bypass RLS for the internal writes. This is required because
  the caller (authenticated role) already owns the rows — the SECURITY DEFINER is only
  to guarantee atomicity, not to escalate privileges.
- REVOKE EXECUTE FROM PUBLIC, anon; GRANT EXECUTE TO authenticated only.
- Both functions verify the caller owns the target rows via auth.uid() before acting.
- Also revoke the over-broad anon CRUD grants on all tables: this app requires
  sign-in, so anon should not have table access (policies already return zero rows
  to anon, but least-privilege says don't grant what isn't used).

## Tables affected
- categories, transactions, recurring_transactions, budgets (read/write within RPC)
*/

-- ============================================================
-- 1) delete_category — atomic reassign + delete
-- ============================================================
CREATE OR REPLACE FUNCTION delete_category(p_category_id uuid, p_reassign_to uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
BEGIN
  -- Verify the caller owns this category
  SELECT user_id INTO v_owner FROM categories WHERE id = p_category_id;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Categoria não encontrada';
  END IF;
  IF v_owner <> auth.uid() THEN
    RAISE EXCEPTION 'Você não tem permissão para excluir esta categoria';
  END IF;

  -- If reassigning, verify the target category belongs to the same user
  IF p_reassign_to IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM categories WHERE id = p_reassign_to AND user_id = v_owner) THEN
      RAISE EXCEPTION 'Categoria de destino inválida';
    END IF;

    UPDATE transactions SET category_id = p_reassign_to WHERE category_id = p_category_id;
    UPDATE recurring_transactions SET category_id = p_reassign_to WHERE category_id = p_category_id;
  ELSE
    UPDATE transactions SET category_id = NULL WHERE category_id = p_category_id;
    UPDATE recurring_transactions SET category_id = NULL WHERE category_id = p_category_id;
  END IF;

  -- Delete budgets tied to this category (budgets are per-category)
  DELETE FROM budgets WHERE category_id = p_category_id;

  -- Finally delete the category
  DELETE FROM categories WHERE id = p_category_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION delete_category(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION delete_category(uuid, uuid) TO authenticated;

-- ============================================================
-- 2) create_recurring_with_transaction — atomic recurring + first tx
-- ============================================================
CREATE OR REPLACE FUNCTION create_recurring_with_transaction(
  p_user_id uuid,
  p_type text,
  p_name text,
  p_amount numeric,
  p_category_id uuid,
  p_frequency text,
  p_start_date date,
  p_payment_method text,
  p_description text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recurring_id uuid;
  v_day_of_month int;
  v_owner uuid;
BEGIN
  -- Verify the caller matches p_user_id
  IF p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Você não pode criar dados para outro usuário';
  END IF;

  -- If category provided, verify ownership
  IF p_category_id IS NOT NULL THEN
    SELECT user_id INTO v_owner FROM categories WHERE id = p_category_id;
    IF v_owner IS NULL OR v_owner <> p_user_id THEN
      RAISE EXCEPTION 'Categoria inválida';
    END IF;
  END IF;

  v_day_of_month := EXTRACT(DAY FROM p_start_date)::int;

  -- Create the recurring rule
  INSERT INTO recurring_transactions (
    user_id, type, name, amount, category_id, frequency,
    start_date, next_date, day_of_month, payment_method, description
  )
  VALUES (
    p_user_id, p_type, p_name, p_amount, p_category_id, p_frequency,
    p_start_date, p_start_date, v_day_of_month, p_payment_method, p_description
  )
  RETURNING id INTO v_recurring_id;

  -- Create the initial transaction, linked to the recurring rule
  INSERT INTO transactions (
    user_id, type, name, amount, category_id, date,
    payment_method, description, is_recurring, recurring_id
  )
  VALUES (
    p_user_id, p_type, p_name, p_amount, p_category_id, p_start_date,
    p_payment_method, p_description, true, v_recurring_id
  );

  RETURN v_recurring_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION create_recurring_with_transaction(uuid, text, text, numeric, uuid, text, date, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION create_recurring_with_transaction(uuid, text, text, numeric, uuid, text, date, text, text) TO authenticated;

-- ============================================================
-- 3) Tighten grants: remove anon CRUD (sign-in app, least privilege)
-- ============================================================
REVOKE SELECT, INSERT, UPDATE, DELETE ON profiles FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON categories FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON transactions FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON recurring_transactions FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON budgets FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON goals FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON goal_contributions FROM anon;
