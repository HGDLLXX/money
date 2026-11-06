import { getDb, hashPassword } from './db';
import { seedDefaultCategories } from './db';
import type {
  User,
  Category,
  Transaction,
  RecurringTransaction,
  Budget,
  Goal,
  GoalContribution,
  TransactionType,
  RecurrenceFrequency,
  PaymentMethod,
} from '@/types';
import { addMonths, addWeeks, addYears, toISODate, todayISO } from './format';

function uuid(): string {
  return crypto.randomUUID();
}

// ---------- AUTH ----------

export async function signUp(
  email: string,
  name: string,
  password: string
): Promise<{ user?: User; error?: string }> {
  const db = await getDb();
  const existing = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
  if (existing.rows.length > 0) {
    return { error: 'Já existe uma conta com este e-mail.' };
  }
  const id = uuid();
  const passwordHash = await hashPassword(password);
  await db.query(
    `INSERT INTO users (id, email, name, password_hash) VALUES ($1, $2, $3, $4)`,
    [id, email.toLowerCase(), name, passwordHash]
  );
  await seedDefaultCategories(id);
  const user = await getUserById(id);
  return { user: user ?? undefined };
}

export async function signIn(
  email: string,
  password: string
): Promise<{ user?: User; error?: string }> {
  const db = await getDb();
  const passwordHash = await hashPassword(password);
  const result = await db.query(
    'SELECT * FROM users WHERE email = $1 AND password_hash = $2',
    [email.toLowerCase(), passwordHash]
  );
  if (result.rows.length === 0) {
    return { error: 'E-mail ou senha incorretos.' };
  }
  return { user: result.rows[0] as User };
}

export async function getUserById(id: string): Promise<User | null> {
  const db = await getDb();
  const result = await db.query('SELECT * FROM users WHERE id = $1', [id]);
  return (result.rows[0] as User) ?? null;
}

export async function updateUser(
  id: string,
  updates: Partial<Pick<User, 'name' | 'currency' | 'date_format' | 'monthly_budget' | 'notify_budget' | 'notify_goals' | 'theme'>>
): Promise<User | null> {
  const db = await getDb();
  const fields: string[] = [];
  const values: (string | number | boolean)[] = [];
  let idx = 1;
  for (const [key, value] of Object.entries(updates)) {
    fields.push(`${key} = $${idx}`);
    values.push(value);
    idx++;
  }
  if (fields.length === 0) return getUserById(id);
  values.push(id);
  const result = await db.query(
    `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  return (result.rows[0] as User) ?? null;
}

export async function updatePassword(
  email: string,
  newPassword: string
): Promise<{ error?: string }> {
  const db = await getDb();
  const passwordHash = await hashPassword(newPassword);
  const result = await db.query(
    'UPDATE users SET password_hash = $1 WHERE email = $2 RETURNING id',
    [passwordHash, email.toLowerCase()]
  );
  if (result.rows.length === 0) {
    return { error: 'Nenhuma conta encontrada com este e-mail.' };
  }
  return {};
}

// ---------- CATEGORIES ----------

export async function getCategories(userId: string): Promise<Category[]> {
  const db = await getDb();
  const result = await db.query(
    'SELECT * FROM categories WHERE user_id = $1 ORDER BY created_at ASC',
    [userId]
  );
  return result.rows as Category[];
}

export async function createCategory(
  userId: string,
  data: { name: string; color: string; icon: string; type: TransactionType | 'both' }
): Promise<Category> {
  const db = await getDb();
  const id = uuid();
  await db.query(
    `INSERT INTO categories (id, user_id, name, color, icon, type) VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, userId, data.name, data.color, data.icon, data.type]
  );
  const result = await db.query('SELECT * FROM categories WHERE id = $1', [id]);
  return result.rows[0] as Category;
}

export async function updateCategory(
  id: string,
  updates: { name?: string; color?: string; icon?: string; type?: TransactionType | 'both' }
): Promise<Category | null> {
  const db = await getDb();
  const fields: string[] = [];
  const values: (string)[] = [];
  let idx = 1;
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue;
    fields.push(`${key} = $${idx}`);
    values.push(value);
    idx++;
  }
  if (fields.length === 0) return null;
  values.push(id);
  const result = await db.query(
    `UPDATE categories SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  return (result.rows[0] as Category) ?? null;
}

export async function deleteCategory(
  id: string,
  reassignTo: string | null
): Promise<void> {
  const db = await getDb();
  if (reassignTo) {
    await db.query('UPDATE transactions SET category_id = $1 WHERE category_id = $2', [
      reassignTo,
      id,
    ]);
    await db.query('UPDATE recurring_transactions SET category_id = $1 WHERE category_id = $2', [
      reassignTo,
      id,
    ]);
    await db.query('DELETE FROM budgets WHERE category_id = $1', [id]);
  } else {
    await db.query('UPDATE transactions SET category_id = NULL WHERE category_id = $1', [id]);
    await db.query('UPDATE recurring_transactions SET category_id = NULL WHERE category_id = $1', [id]);
    await db.query('DELETE FROM budgets WHERE category_id = $1', [id]);
  }
  await db.query('DELETE FROM categories WHERE id = $1', [id]);
}

export async function getCategorySpending(
  userId: string,
  categoryId: string
): Promise<number> {
  const db = await getDb();
  const result = await db.query(
    `SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = $1 AND category_id = $2 AND type = 'expense'`,
    [userId, categoryId]
  );
  return Number((result.rows[0] as { total: string }).total);
}

// ---------- TRANSACTIONS ----------

export async function getTransactions(
  userId: string,
  filters?: {
    type?: TransactionType;
    categoryId?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
    orderBy?: 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc';
  }
): Promise<Transaction[]> {
  const db = await getDb();
  const conditions = ['user_id = $1'];
  const values: (string | number)[] = [userId];
  let idx = 2;

  if (filters?.type) {
    conditions.push(`type = $${idx}`);
    values.push(filters.type);
    idx++;
  }
  if (filters?.categoryId) {
    conditions.push(`category_id = $${idx}`);
    values.push(filters.categoryId);
    idx++;
  }
  if (filters?.startDate) {
    conditions.push(`date >= $${idx}`);
    values.push(filters.startDate);
    idx++;
  }
  if (filters?.endDate) {
    conditions.push(`date <= $${idx}`);
    values.push(filters.endDate);
    idx++;
  }
  if (filters?.search) {
    conditions.push(`(name ILIKE $${idx} OR description ILIKE $${idx})`);
    values.push(`%${filters.search}%`);
    idx++;
  }

  let orderBy = 'date DESC, created_at DESC';
  if (filters?.orderBy === 'date_asc') orderBy = 'date ASC, created_at ASC';
  if (filters?.orderBy === 'amount_desc') orderBy = 'amount DESC';
  if (filters?.orderBy === 'amount_asc') orderBy = 'amount ASC';

  const result = await db.query(
    `SELECT * FROM transactions WHERE ${conditions.join(' AND ')} ORDER BY ${orderBy}`,
    values
  );
  return result.rows as Transaction[];
}

export async function createTransaction(
  userId: string,
  data: {
    type: TransactionType;
    name: string;
    amount: number;
    category_id: string | null;
    date: string;
    payment_method: PaymentMethod | null;
    description: string | null;
    is_recurring?: boolean;
    recurring_id?: string | null;
  }
): Promise<Transaction> {
  const db = await getDb();
  const id = uuid();
  await db.query(
    `INSERT INTO transactions (id, user_id, type, name, amount, category_id, date, payment_method, description, is_recurring, recurring_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      id,
      userId,
      data.type,
      data.name,
      data.amount,
      data.category_id,
      data.date,
      data.payment_method,
      data.description,
      data.is_recurring ?? false,
      data.recurring_id ?? null,
    ]
  );
  const result = await db.query('SELECT * FROM transactions WHERE id = $1', [id]);
  return result.rows[0] as Transaction;
}

export async function updateTransaction(
  id: string,
  updates: {
    name?: string;
    amount?: number;
    category_id?: string | null;
    date?: string;
    payment_method?: PaymentMethod | null;
    description?: string | null;
  }
): Promise<Transaction | null> {
  const db = await getDb();
  const fields: string[] = [];
  const values: (string | number | null)[] = [];
  let idx = 1;
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue;
    fields.push(`${key} = $${idx}`);
    values.push(value);
    idx++;
  }
  if (fields.length === 0) return null;
  values.push(id);
  const result = await db.query(
    `UPDATE transactions SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  return (result.rows[0] as Transaction) ?? null;
}

export async function deleteTransaction(id: string): Promise<void> {
  const db = await getDb();
  await db.query('DELETE FROM transactions WHERE id = $1', [id]);
}

// ---------- RECURRING TRANSACTIONS ----------

export async function getRecurringTransactions(userId: string): Promise<RecurringTransaction[]> {
  const db = await getDb();
  const result = await db.query(
    'SELECT * FROM recurring_transactions WHERE user_id = $1 ORDER BY next_date ASC',
    [userId]
  );
  return result.rows as RecurringTransaction[];
}

export async function createRecurringTransaction(
  userId: string,
  data: {
    type: TransactionType;
    name: string;
    amount: number;
    category_id: string | null;
    frequency: RecurrenceFrequency;
    start_date: string;
    payment_method: PaymentMethod | null;
    description: string | null;
  }
): Promise<RecurringTransaction> {
  const db = await getDb();
  const id = uuid();
  await db.query(
    `INSERT INTO recurring_transactions (id, user_id, type, name, amount, category_id, frequency, start_date, next_date, payment_method, description)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, $9, $10)`,
    [
      id,
      userId,
      data.type,
      data.name,
      data.amount,
      data.category_id,
      data.frequency,
      data.start_date,
      data.payment_method,
      data.description,
    ]
  );
  const result = await db.query('SELECT * FROM recurring_transactions WHERE id = $1', [id]);
  return result.rows[0] as RecurringTransaction;
}

export async function updateRecurringTransaction(
  id: string,
  updates: {
    name?: string;
    amount?: number;
    category_id?: string | null;
    frequency?: RecurrenceFrequency;
    payment_method?: PaymentMethod | null;
    description?: string | null;
    is_paused?: boolean;
    next_date?: string;
  }
): Promise<RecurringTransaction | null> {
  const db = await getDb();
  const fields: string[] = [];
  const values: (string | number | boolean | null)[] = [];
  let idx = 1;
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue;
    fields.push(`${key} = $${idx}`);
    values.push(value);
    idx++;
  }
  if (fields.length === 0) return null;
  values.push(id);
  const result = await db.query(
    `UPDATE recurring_transactions SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  return (result.rows[0] as RecurringTransaction) ?? null;
}

export async function deleteRecurringTransaction(id: string): Promise<void> {
  const db = await getDb();
  await db.query('DELETE FROM recurring_transactions WHERE id = $1', [id]);
}

// Generate due recurring transactions up to today (dedup by recurring_id + date)
export async function processRecurringTransactions(userId: string): Promise<void> {
  const db = await getDb();
  const today = todayISO();

  // Get all active recurring transactions where next_date <= today
  const recurring = await db.query(
    `SELECT * FROM recurring_transactions WHERE user_id = $1 AND is_paused = FALSE AND next_date <= $2`,
    [userId, today]
  );

  for (const rec of recurring.rows as RecurringTransaction[]) {
    let currentDate = parseDate(rec.next_date);
    const todayDate = new Date(today + 'T00:00:00');

    while (currentDate <= todayDate) {
      const dateStr = toISODate(currentDate);

      // Check if transaction already exists for this recurring + date
      const existing = await db.query(
        `SELECT id FROM transactions WHERE user_id = $1 AND recurring_id = $2 AND date = $3`,
        [userId, rec.id, dateStr]
      );

      if (existing.rows.length === 0) {
        const txId = uuid();
        await db.query(
          `INSERT INTO transactions (id, user_id, type, name, amount, category_id, date, payment_method, description, is_recurring, recurring_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE, $10)`,
          [
            txId,
            userId,
            rec.type,
            rec.name,
            rec.amount,
            rec.category_id,
            dateStr,
            rec.payment_method,
            rec.description,
            rec.id,
          ]
        );
      }

      // Advance to next occurrence
      if (rec.frequency === 'weekly') {
        currentDate = addWeeks(currentDate, 1);
      } else if (rec.frequency === 'monthly') {
        currentDate = addMonths(currentDate, 1);
      } else {
        currentDate = addYears(currentDate, 1);
      }
    }

    // Update next_date to the first future occurrence
    let nextDate = parseDate(rec.next_date);
    while (nextDate <= todayDate) {
      if (rec.frequency === 'weekly') {
        nextDate = addWeeks(nextDate, 1);
      } else if (rec.frequency === 'monthly') {
        nextDate = addMonths(nextDate, 1);
      } else {
        nextDate = addYears(nextDate, 1);
      }
    }
    await db.query(
      `UPDATE recurring_transactions SET next_date = $1 WHERE id = $2`,
      [toISODate(nextDate), rec.id]
    );
  }
}

function parseDate(iso: string): Date {
  return new Date(iso + 'T00:00:00');
}

// ---------- BUDGETS ----------

export async function getBudgets(
  userId: string,
  month: number,
  year: number
): Promise<Budget[]> {
  const db = await getDb();
  const result = await db.query(
    'SELECT * FROM budgets WHERE user_id = $1 AND month = $2 AND year = $3',
    [userId, month, year]
  );
  return result.rows as Budget[];
}

export async function upsertBudget(
  userId: string,
  categoryId: string,
  limitAmount: number,
  month: number,
  year: number
): Promise<Budget> {
  const db = await getDb();
  const existing = await db.query(
    'SELECT id FROM budgets WHERE user_id = $1 AND category_id = $2 AND month = $3 AND year = $4',
    [userId, categoryId, month, year]
  );
  if (existing.rows.length > 0) {
    const id = (existing.rows[0] as Budget).id;
    await db.query('UPDATE budgets SET limit_amount = $1 WHERE id = $2', [limitAmount, id]);
    const result = await db.query('SELECT * FROM budgets WHERE id = $1', [id]);
    return result.rows[0] as Budget;
  }
  const id = uuid();
  await db.query(
    `INSERT INTO budgets (id, user_id, category_id, limit_amount, month, year) VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, userId, categoryId, limitAmount, month, year]
  );
  const result = await db.query('SELECT * FROM budgets WHERE id = $1', [id]);
  return result.rows[0] as Budget;
}

export async function deleteBudget(id: string): Promise<void> {
  const db = await getDb();
  await db.query('DELETE FROM budgets WHERE id = $1', [id]);
}

// Copy previous month's budgets to current month if none exist
export async function carryOverBudgets(
  userId: string,
  month: number,
  year: number
): Promise<void> {
  const db = await getDb();
  const current = await getBudgets(userId, month, year);
  if (current.length > 0) return;

  // Try previous month
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const prevBudgets = await getBudgets(userId, prevMonth, prevYear);
  for (const b of prevBudgets) {
    await upsertBudget(userId, b.category_id, b.limit_amount, month, year);
  }
}

// ---------- GOALS ----------

export async function getGoals(userId: string): Promise<Goal[]> {
  const db = await getDb();
  const result = await db.query(
    'SELECT * FROM goals WHERE user_id = $1 ORDER BY created_at ASC',
    [userId]
  );
  return result.rows as Goal[];
}

export async function createGoal(
  userId: string,
  data: {
    name: string;
    target_amount: number;
    saved_amount?: number;
    target_date: string | null;
    color: string;
    icon: string;
  }
): Promise<Goal> {
  const db = await getDb();
  const id = uuid();
  await db.query(
    `INSERT INTO goals (id, user_id, name, target_amount, saved_amount, target_date, color, icon)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      id,
      userId,
      data.name,
      data.target_amount,
      data.saved_amount ?? 0,
      data.target_date,
      data.color,
      data.icon,
    ]
  );
  const result = await db.query('SELECT * FROM goals WHERE id = $1', [id]);
  return result.rows[0] as Goal;
}

export async function updateGoal(
  id: string,
  updates: { name?: string; target_amount?: number; target_date?: string | null; color?: string; icon?: string }
): Promise<Goal | null> {
  const db = await getDb();
  const fields: string[] = [];
  const values: (string | number | null)[] = [];
  let idx = 1;
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue;
    fields.push(`${key} = $${idx}`);
    values.push(value);
    idx++;
  }
  if (fields.length === 0) return null;
  values.push(id);
  const result = await db.query(
    `UPDATE goals SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  return (result.rows[0] as Goal) ?? null;
}

export async function deleteGoal(id: string): Promise<void> {
  const db = await getDb();
  await db.query('DELETE FROM goals WHERE id = $1', [id]);
}

export async function addGoalContribution(
  userId: string,
  goalId: string,
  amount: number,
  date: string
): Promise<GoalContribution> {
  const db = await getDb();
  const id = uuid();
  await db.query(
    `INSERT INTO goal_contributions (id, goal_id, user_id, amount, date) VALUES ($1, $2, $3, $4, $5)`,
    [id, goalId, userId, amount, date]
  );
  await db.query(
    `UPDATE goals SET saved_amount = saved_amount + $1 WHERE id = $2`,
    [amount, goalId]
  );
  const result = await db.query('SELECT * FROM goal_contributions WHERE id = $1', [id]);
  return result.rows[0] as GoalContribution;
}

export async function getGoalContributions(goalId: string): Promise<GoalContribution[]> {
  const db = await getDb();
  const result = await db.query(
    'SELECT * FROM goal_contributions WHERE goal_id = $1 ORDER BY date DESC, created_at DESC',
    [goalId]
  );
  return result.rows as GoalContribution[];
}

// ---------- ANALYTICS ----------

export interface MonthlySummary {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  expenseByCategory: { categoryId: string; categoryName: string; color: string; icon: string; total: number; percentage: number }[];
  transactionCount: number;
}

export async function getMonthlySummary(
  userId: string,
  month: number,
  year: number,
  categories: Category[]
): Promise<MonthlySummary> {
  const db = await getDb();
  const startDate = toISODate(new Date(year, month - 1, 1));
  const endDate = toISODate(new Date(year, month, 0));

  const incomeResult = await db.query(
    `SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = $1 AND type = 'income' AND date >= $2 AND date <= $3`,
    [userId, startDate, endDate]
  );
  const expenseResult = await db.query(
    `SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = $1 AND type = 'expense' AND date >= $2 AND date <= $3`,
    [userId, startDate, endDate]
  );
  const countResult = await db.query(
    `SELECT COUNT(*) as count FROM transactions WHERE user_id = $1 AND date >= $2 AND date <= $3`,
    [userId, startDate, endDate]
  );

  const totalIncome = Number((incomeResult.rows[0] as { total: string }).total);
  const totalExpense = Number((expenseResult.rows[0] as { total: string }).total);

  // Expense by category
  const categoryResult = await db.query(
    `SELECT category_id, SUM(amount) as total FROM transactions
     WHERE user_id = $1 AND type = 'expense' AND date >= $2 AND date <= $3
     GROUP BY category_id ORDER BY total DESC`,
    [userId, startDate, endDate]
  );

  const expenseByCategory = (categoryResult.rows as { category_id: string | null; total: string }[]).map(
    (row) => {
      const cat = categories.find((c) => c.id === row.category_id);
      return {
        categoryId: row.category_id ?? 'uncategorized',
        categoryName: cat?.name ?? 'Sem categoria',
        color: cat?.color ?? '#64748b',
        icon: cat?.icon ?? 'more-horizontal',
        total: Number(row.total),
        percentage: totalExpense > 0 ? (Number(row.total) / totalExpense) * 100 : 0,
      };
    }
  );

  return {
    totalIncome,
    totalExpense,
    balance: totalIncome - totalExpense,
    expenseByCategory,
    transactionCount: Number((countResult.rows[0] as { count: string }).count),
  };
}

export async function getMonthlyTrend(
  userId: string,
  months: number,
  endMonth: number,
  endYear: number
): Promise<{ month: number; year: number; label: string; income: number; expense: number; balance: number }[]> {
  const db = await getDb();
  const result: { month: number; year: number; label: string; income: number; expense: number; balance: number }[] = [];

  for (let i = months - 1; i >= 0; i--) {
    let m = endMonth;
    let y = endYear;
    for (let j = 0; j < i; j++) {
      m = m === 1 ? 12 : m - 1;
      y = m === 12 && endMonth === 1 ? y - 1 : y;
    }
    // recalc properly
    let cm = endMonth;
    let cy = endYear;
    for (let j = 0; j < i; j++) {
      if (cm === 1) {
        cm = 12;
        cy = cy - 1;
      } else {
        cm = cm - 1;
      }
    }

    const startDate = toISODate(new Date(cy, cm - 1, 1));
    const endDate = toISODate(new Date(cy, cm, 0));

    const incomeRes = await db.query(
      `SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = $1 AND type = 'income' AND date >= $2 AND date <= $3`,
      [userId, startDate, endDate]
    );
    const expenseRes = await db.query(
      `SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = $1 AND type = 'expense' AND date >= $2 AND date <= $3`,
      [userId, startDate, endDate]
    );

    const income = Number((incomeRes.rows[0] as { total: string }).total);
    const expense = Number((expenseRes.rows[0] as { total: string }).total);

    const date = new Date(cy, cm - 1, 1);
    result.push({
      month: cm,
      year: cy,
      label: date.toLocaleDateString('pt-BR', { month: 'short' }),
      income,
      expense,
      balance: income - expense,
    });
  }

  return result;
}

export async function getBalanceEvolution(
  userId: string,
  months: number,
  endMonth: number,
  endYear: number
): Promise<{ label: string; balance: number; cumulative: number }[]> {
  const trends = await getMonthlyTrend(userId, months, endMonth, endYear);
  let cumulative = 0;
  return trends.map((t) => {
    cumulative += t.balance;
    return { label: t.label, balance: t.balance, cumulative };
  });
}
