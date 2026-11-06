import { PGlite } from '@electric-sql/pglite';
import CATEGORY_PRESETS from './categoryPresets';

let dbInstance: PGlite | null = null;

export async function getDb(): Promise<PGlite> {
  if (dbInstance) return dbInstance;

  const db = new PGlite('idb://granaplus');

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      currency TEXT NOT NULL DEFAULT 'BRL',
      date_format TEXT NOT NULL DEFAULT 'dd/MM/yyyy',
      monthly_budget NUMERIC(12,2) NOT NULL DEFAULT 0,
      notify_budget BOOLEAN NOT NULL DEFAULT TRUE,
      notify_goals BOOLEAN NOT NULL DEFAULT TRUE,
      theme TEXT NOT NULL DEFAULT 'system',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      icon TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'both',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK (type IN ('income','expense')),
      name TEXT NOT NULL,
      amount NUMERIC(12,2) NOT NULL,
      category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
      date DATE NOT NULL,
      payment_method TEXT,
      description TEXT,
      is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
      recurring_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS recurring_transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK (type IN ('income','expense')),
      name TEXT NOT NULL,
      amount NUMERIC(12,2) NOT NULL,
      category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
      frequency TEXT NOT NULL CHECK (frequency IN ('weekly','monthly','annual')),
      start_date DATE NOT NULL,
      next_date DATE NOT NULL,
      payment_method TEXT,
      description TEXT,
      is_paused BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS budgets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      limit_amount NUMERIC(12,2) NOT NULL,
      month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
      year INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(user_id, category_id, month, year)
    );

    CREATE TABLE IF NOT EXISTS goals (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      target_amount NUMERIC(12,2) NOT NULL,
      saved_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
      target_date DATE,
      color TEXT NOT NULL DEFAULT '#10b981',
      icon TEXT NOT NULL DEFAULT 'target',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS goal_contributions (
      id TEXT PRIMARY KEY,
      goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount NUMERIC(12,2) NOT NULL,
      date DATE NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, date);
    CREATE INDEX IF NOT EXISTS idx_transactions_user_type ON transactions(user_id, type);
    CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
    CREATE INDEX IF NOT EXISTS idx_categories_user ON categories(user_id);
    CREATE INDEX IF NOT EXISTS idx_budgets_user ON budgets(user_id, year, month);
    CREATE INDEX IF NOT EXISTS idx_goals_user ON goals(user_id);
    CREATE INDEX IF NOT EXISTS idx_recurring_user ON recurring_transactions(user_id);
  `);

  dbInstance = db;
  return db;
}

export async function seedDefaultCategories(userId: string): Promise<void> {
  const db = await getDb();
  for (const cat of CATEGORY_PRESETS) {
    const id = crypto.randomUUID();
    await db.query(
      `INSERT INTO categories (id, user_id, name, color, icon, type) VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, userId, cat.name, cat.color, cat.icon, cat.type]
    );
  }
}

// Simple password hashing (not cryptographically strong, but obfuscates)
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`granaplus_salt_${password}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
