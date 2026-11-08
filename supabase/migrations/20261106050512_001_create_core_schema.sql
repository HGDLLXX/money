/*
# Grana+ Core Schema — Multi-user financial management

## Overview
Creates the complete database schema for the Grana+ personal finance app.
Each user sees only their own data, enforced by Row Level Security on every table.
All user-owned tables use `user_id uuid NOT NULL DEFAULT auth.uid()` so frontend
inserts that omit user_id still satisfy RLS.

## New Tables

1. `profiles` — User profile data (supplements auth.users; never stores passwords or hashes)
   - `id` uuid, PK, references auth.users(id) ON DELETE CASCADE
   - `name` text
   - `currency` text (default 'BRL')
   - `date_format` text (default 'dd/MM/yyyy')
   - `monthly_budget` numeric(12,2) (default 0) — overall monthly budget
   - `notify_budget` boolean (default true)
   - `notify_goals` boolean (default true)
   - `theme` text (default 'system')
   - `created_at` timestamptz

2. `categories` — User-customizable categories for income/expense
   - `id` uuid, PK
   - `user_id` uuid, references auth.users, DEFAULT auth.uid()
   - `name`, `color`, `icon` text
   - `type` text ('income' | 'expense' | 'both')
   - `created_at` timestamptz

3. `transactions` — Individual income/expense entries
   - `id` uuid, PK
   - `user_id` uuid, references auth.users, DEFAULT auth.uid()
   - `type` text CHECK ('income' | 'expense')
   - `name` text
   - `amount` numeric(12,2)
   - `category_id` uuid FK -> categories(id) ON DELETE SET NULL
   - `date` date
   - `payment_method` text (nullable)
   - `description` text (nullable)
   - `is_recurring` boolean (default false)
   - `recurring_id` uuid (nullable, no FK to avoid cascade issues)
   - `created_at` timestamptz
   - Unique constraint: (user_id, recurring_id, date) WHERE recurring_id IS NOT NULL — prevents duplicate recurring postings

4. `recurring_transactions` — Recurring income/expense templates
   - `id` uuid, PK
   - `user_id` uuid, references auth.users, DEFAULT auth.uid()
   - `type`, `name`, `amount`, `category_id` (FK SET NULL)
   - `frequency` text CHECK ('weekly' | 'monthly' | 'annual')
   - `start_date` date, `next_date` date
   - `day_of_month` int — preserves original day for monthly/annual recurrence
   - `payment_method`, `description` (nullable)
   - `is_paused` boolean (default false)
   - `created_at` timestamptz

5. `budgets` — Per-category monthly budget limits
   - `id` uuid, PK
   - `user_id` uuid, references auth.users, DEFAULT auth.uid()
   - `category_id` uuid FK -> categories(id) ON DELETE CASCADE
   - `limit_amount` numeric(12,2)
   - `month` int CHECK (1-12), `year` int
   - `created_at` timestamptz
   - Unique: (user_id, category_id, month, year) — one budget per category per month

6. `goals` — Savings goals
   - `id` uuid, PK
   - `user_id` uuid, references auth.users, DEFAULT auth.uid()
   - `name`, `color`, `icon` text
   - `target_amount` numeric(12,2)
   - `saved_amount` numeric(12,2) (default 0) — kept in sync by RPC
   - `target_date` date (nullable)
   - `created_at` timestamptz

7. `goal_contributions` — History of deposits and withdrawals on goals
   - `id` uuid, PK
   - `goal_id` uuid FK -> goals(id) ON DELETE CASCADE
   - `user_id` uuid, references auth.users, DEFAULT auth.uid()
   - `amount` numeric(12,2) — positive for deposit, negative for withdrawal
   - `date` date
   - `created_at` timestamptz

## RPC Functions (SECURITY DEFINER, atomic operations)

1. `add_goal_contribution(p_goal_id uuid, p_amount numeric, p_date date)` — atomically
   inserts a contribution and updates the goal's saved_amount. Rejects withdrawals
   exceeding saved_amount. Returns the contribution row.

2. `process_recurring_transactions()` — Processes all active recurring transactions
   for ALL users whose next_date <= today. Generates transaction rows with proper
   day-of-month preservation (e.g., day 31 -> 28 in Feb -> 31 in Mar). Updates
   next_date to the first future occurrence. Uses the unique constraint to prevent
   duplicates. SECURITY DEFINER so it can run from an edge function cron without
   requiring a specific user session.

## Security

- RLS enabled on ALL tables.
- ALL policies scope to `authenticated` role with `auth.uid() = user_id` ownership checks.
- `profiles` uses `auth.uid() = id`.
- `goal_contributions` ownership checked via EXISTS on goals table.
- Grants: only `authenticated` gets CRUD on user tables; `service_role` gets CRUD for the edge function.
- RPC functions: REVOKE EXECUTE FROM PUBLIC, anon; GRANT EXECUTE TO authenticated, service_role.

## Indexes

- transactions: (user_id, date), (user_id, type), (category_id), (recurring_id, date)
- categories: (user_id)
- budgets: (user_id, year, month), (user_id, category_id, month, year)
- goals: (user_id)
- recurring_transactions: (user_id), (next_date) WHERE is_paused = false
- goal_contributions: (goal_id, date)
*/

-- ============ PROFILES ============
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  currency text NOT NULL DEFAULT 'BRL',
  date_format text NOT NULL DEFAULT 'dd/MM/yyyy',
  monthly_budget numeric(12,2) NOT NULL DEFAULT 0,
  notify_budget boolean NOT NULL DEFAULT true,
  notify_goals boolean NOT NULL DEFAULT true,
  theme text NOT NULL DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON profiles TO service_role;

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ============ CATEGORIES ============
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#64748b',
  icon text NOT NULL DEFAULT 'more-horizontal',
  type text NOT NULL DEFAULT 'both' CHECK (type IN ('income','expense','both')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON categories TO service_role;

DROP POLICY IF EXISTS "select_own_categories" ON categories;
CREATE POLICY "select_own_categories" ON categories FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_categories" ON categories;
CREATE POLICY "insert_own_categories" ON categories FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_categories" ON categories;
CREATE POLICY "update_own_categories" ON categories FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_categories" ON categories;
CREATE POLICY "delete_own_categories" ON categories FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============ TRANSACTIONS ============
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('income','expense')),
  name text NOT NULL,
  amount numeric(12,2) NOT NULL,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  date date NOT NULL,
  payment_method text,
  description text,
  is_recurring boolean NOT NULL DEFAULT false,
  recurring_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint to prevent duplicate recurring postings on the same date
CREATE UNIQUE INDEX IF NOT EXISTS uq_transactions_recurring_date
  ON transactions (user_id, recurring_id, date)
  WHERE recurring_id IS NOT NULL;

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON transactions TO service_role;

DROP POLICY IF EXISTS "select_own_transactions" ON transactions;
CREATE POLICY "select_own_transactions" ON transactions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_transactions" ON transactions;
CREATE POLICY "insert_own_transactions" ON transactions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_transactions" ON transactions;
CREATE POLICY "update_own_transactions" ON transactions FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_transactions" ON transactions;
CREATE POLICY "delete_own_transactions" ON transactions FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============ RECURRING TRANSACTIONS ============
CREATE TABLE IF NOT EXISTS recurring_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('income','expense')),
  name text NOT NULL,
  amount numeric(12,2) NOT NULL,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  frequency text NOT NULL CHECK (frequency IN ('weekly','monthly','annual')),
  start_date date NOT NULL,
  next_date date NOT NULL,
  day_of_month int NOT NULL DEFAULT 1,
  payment_method text,
  description text,
  is_paused boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE recurring_transactions ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON recurring_transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON recurring_transactions TO service_role;

DROP POLICY IF EXISTS "select_own_recurring" ON recurring_transactions;
CREATE POLICY "select_own_recurring" ON recurring_transactions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_recurring" ON recurring_transactions;
CREATE POLICY "insert_own_recurring" ON recurring_transactions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_recurring" ON recurring_transactions;
CREATE POLICY "update_own_recurring" ON recurring_transactions FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_recurring" ON recurring_transactions;
CREATE POLICY "delete_own_recurring" ON recurring_transactions FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============ BUDGETS ============
CREATE TABLE IF NOT EXISTS budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  limit_amount numeric(12,2) NOT NULL,
  month int NOT NULL CHECK (month BETWEEN 1 AND 12),
  year int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, category_id, month, year)
);

ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON budgets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON budgets TO service_role;

DROP POLICY IF EXISTS "select_own_budgets" ON budgets;
CREATE POLICY "select_own_budgets" ON budgets FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_budgets" ON budgets;
CREATE POLICY "insert_own_budgets" ON budgets FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_budgets" ON budgets;
CREATE POLICY "update_own_budgets" ON budgets FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_budgets" ON budgets;
CREATE POLICY "delete_own_budgets" ON budgets FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============ GOALS ============
CREATE TABLE IF NOT EXISTS goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  target_amount numeric(12,2) NOT NULL,
  saved_amount numeric(12,2) NOT NULL DEFAULT 0,
  target_date date,
  color text NOT NULL DEFAULT '#10b981',
  icon text NOT NULL DEFAULT 'target',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON goals TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON goals TO service_role;

DROP POLICY IF EXISTS "select_own_goals" ON goals;
CREATE POLICY "select_own_goals" ON goals FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_goals" ON goals;
CREATE POLICY "insert_own_goals" ON goals FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_goals" ON goals;
CREATE POLICY "update_own_goals" ON goals FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_goals" ON goals;
CREATE POLICY "delete_own_goals" ON goals FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============ GOAL CONTRIBUTIONS ============
CREATE TABLE IF NOT EXISTS goal_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id uuid NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE goal_contributions ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, DELETE ON goal_contributions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON goal_contributions TO service_role;

DROP POLICY IF EXISTS "select_own_contributions" ON goal_contributions;
CREATE POLICY "select_own_contributions" ON goal_contributions FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM goals WHERE goals.id = goal_contributions.goal_id AND goals.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_contributions" ON goal_contributions;
CREATE POLICY "insert_own_contributions" ON goal_contributions FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM goals WHERE goals.id = goal_contributions.goal_id AND goals.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_own_contributions" ON goal_contributions;
CREATE POLICY "delete_own_contributions" ON goal_contributions FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM goals WHERE goals.id = goal_contributions.goal_id AND goals.user_id = auth.uid())
  );

-- ============ INDEXES ============
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions (user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_type ON transactions (user_id, type);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions (category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_recurring ON transactions (recurring_id, date) WHERE recurring_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_categories_user ON categories (user_id);
CREATE INDEX IF NOT EXISTS idx_budgets_user_month ON budgets (user_id, year, month);
CREATE INDEX IF NOT EXISTS idx_budgets_user_cat ON budgets (user_id, category_id, month, year);
CREATE INDEX IF NOT EXISTS idx_goals_user ON goals (user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_user ON recurring_transactions (user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_next ON recurring_transactions (next_date) WHERE is_paused = false;
CREATE INDEX IF NOT EXISTS idx_contributions_goal ON goal_contributions (goal_id, date DESC);

-- ============ RPC: add_goal_contribution ============
-- Atomically inserts a contribution and updates goal.saved_amount.
-- Positive amount = deposit, negative = withdrawal.
-- Rejects withdrawal exceeding saved_amount.
CREATE OR REPLACE FUNCTION add_goal_contribution(p_goal_id uuid, p_amount numeric, p_date date)
RETURNS goal_contributions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_goal goals%ROWTYPE;
  v_new_saved numeric(12,2);
  v_contrib goal_contributions%ROWTYPE;
BEGIN
  -- Lock the goal row to prevent concurrent issues
  SELECT * INTO v_goal FROM goals WHERE id = p_goal_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Meta não encontrada';
  END IF;

  -- Verify ownership via auth.uid()
  IF v_goal.user_id != auth.uid() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  -- Validate amount
  IF p_amount = 0 THEN
    RAISE EXCEPTION 'O valor não pode ser zero';
  END IF;

  v_new_saved := v_goal.saved_amount + p_amount;

  -- Prevent withdrawing more than saved
  IF v_new_saved < 0 THEN
    RAISE EXCEPTION 'Não é possível retirar mais do que já foi guardado';
  END IF;

  -- Insert contribution
  INSERT INTO goal_contributions (goal_id, user_id, amount, date)
  VALUES (p_goal_id, auth.uid(), p_amount, p_date)
  RETURNING * INTO v_contrib;

  -- Update goal saved_amount
  UPDATE goals SET saved_amount = v_new_saved WHERE id = p_goal_id;

  RETURN v_contrib;
END;
$$;

REVOKE EXECUTE ON FUNCTION add_goal_contribution(uuid, numeric, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION add_goal_contribution(uuid, numeric, date) TO authenticated, service_role;

-- ============ RPC: process_recurring_transactions ============
-- Processes all active recurring transactions for ALL users whose next_date <= today.
-- Generates transaction rows with day-of-month preservation.
-- Uses the unique index to prevent duplicates.
-- SECURITY DEFINER so it can run from an edge function without a user session.
CREATE OR REPLACE FUNCTION process_recurring_transactions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec RECORD;
  v_today date := CURRENT_DATE;
  v_current_date date;
  v_next_date date;
  v_day int;
  v_last_day int;
BEGIN
  FOR v_rec IN
    SELECT * FROM recurring_transactions
    WHERE is_paused = false AND next_date <= v_today
  LOOP
    v_current_date := v_rec.next_date;

    WHILE v_current_date <= v_today LOOP
      -- Insert transaction (unique index prevents duplicates)
      BEGIN
        INSERT INTO transactions (user_id, type, name, amount, category_id, date, payment_method, description, is_recurring, recurring_id)
        VALUES (v_rec.user_id, v_rec.type, v_rec.name, v_rec.amount, v_rec.category_id, v_current_date, v_rec.payment_method, v_rec.description, true, v_rec.id);
      EXCEPTION WHEN unique_violation THEN
        -- Already exists, skip
        NULL;
      END;

      -- Advance to next occurrence with day-of-month preservation
      IF v_rec.frequency = 'weekly' THEN
        v_current_date := v_current_date + INTERVAL '7 days';
      ELSIF v_rec.frequency = 'monthly' THEN
        v_day := v_rec.day_of_month;
        v_current_date := v_current_date + INTERVAL '1 month';
        -- Clamp to last day of target month if day_of_month exceeds it
        v_last_day := EXTRACT(DAY FROM (DATE_TRUNC('month', v_current_date) + INTERVAL '1 month - 1 day'));
        IF v_day > v_last_day THEN
          v_current_date := DATE_TRUNC('month', v_current_date) + INTERVAL '1 month - 1 day';
        ELSE
          v_current_date := DATE_TRUNC('month', v_current_date) + (v_day - 1) * INTERVAL '1 day';
        END IF;
      ELSIF v_rec.frequency = 'annual' THEN
        v_day := v_rec.day_of_month;
        v_current_date := v_current_date + INTERVAL '1 year';
        v_last_day := EXTRACT(DAY FROM (DATE_TRUNC('month', v_current_date) + INTERVAL '1 month - 1 day'));
        IF v_day > v_last_day THEN
          v_current_date := DATE_TRUNC('month', v_current_date) + INTERVAL '1 month - 1 day';
        ELSE
          v_current_date := DATE_TRUNC('month', v_current_date) + (v_day - 1) * INTERVAL '1 day';
        END IF;
      END IF;
    END LOOP;

    -- Compute next future occurrence
    v_next_date := v_rec.next_date;
    WHILE v_next_date <= v_today LOOP
      IF v_rec.frequency = 'weekly' THEN
        v_next_date := v_next_date + INTERVAL '7 days';
      ELSIF v_rec.frequency = 'monthly' THEN
        v_day := v_rec.day_of_month;
        v_next_date := v_next_date + INTERVAL '1 month';
        v_last_day := EXTRACT(DAY FROM (DATE_TRUNC('month', v_next_date) + INTERVAL '1 month - 1 day'));
        IF v_day > v_last_day THEN
          v_next_date := DATE_TRUNC('month', v_next_date) + INTERVAL '1 month - 1 day';
        ELSE
          v_next_date := DATE_TRUNC('month', v_next_date) + (v_day - 1) * INTERVAL '1 day';
        END IF;
      ELSIF v_rec.frequency = 'annual' THEN
        v_day := v_rec.day_of_month;
        v_next_date := v_next_date + INTERVAL '1 year';
        v_last_day := EXTRACT(DAY FROM (DATE_TRUNC('month', v_next_date) + INTERVAL '1 month - 1 day'));
        IF v_day > v_last_day THEN
          v_next_date := DATE_TRUNC('month', v_next_date) + INTERVAL '1 month - 1 day';
        ELSE
          v_next_date := DATE_TRUNC('month', v_next_date) + (v_day - 1) * INTERVAL '1 day';
        END IF;
      END IF;
    END LOOP;

    UPDATE recurring_transactions SET next_date = v_next_date WHERE id = v_rec.id;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION process_recurring_transactions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION process_recurring_transactions() TO authenticated, service_role;

-- ============ TRIGGER: Auto-create profile on signup ============
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', ''));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
