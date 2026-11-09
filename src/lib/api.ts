import { supabase } from './supabase';
import type {
  Profile,
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

// ---------- PROFILES ----------

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}

export async function updateProfile(
  userId: string,
  updates: Partial<Pick<Profile, 'name' | 'currency' | 'date_format' | 'monthly_budget' | 'notify_budget' | 'notify_goals' | 'theme'>>
): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}

// ---------- CATEGORIES ----------

export async function getCategories(userId: string): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data as Category[]) ?? [];
}

export async function createCategory(
  userId: string,
  data: { name: string; color: string; icon: string; type: TransactionType | 'both' }
): Promise<Category> {
  const { data: row, error } = await supabase
    .from('categories')
    .insert({ user_id: userId, name: data.name, color: data.color, icon: data.icon, type: data.type })
    .select()
    .single();
  if (error) throw error;
  return row as Category;
}

export async function updateCategory(
  id: string,
  updates: { name?: string; color?: string; icon?: string; type?: TransactionType | 'both' }
): Promise<Category | null> {
  const { data, error } = await supabase
    .from('categories')
    .update(updates)
    .eq('id', id)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data as Category | null;
}

export async function deleteCategory(
  id: string,
  reassignTo: string | null
): Promise<void> {
  const { error } = await supabase.rpc('delete_category', {
    p_category_id: id,
    p_reassign_to: reassignTo,
  });
  if (error) throw error;
}

export async function getCategorySpending(
  userId: string,
  categoryId: string
): Promise<number> {
  const { data, error } = await supabase
    .from('transactions')
    .select('amount')
    .eq('user_id', userId)
    .eq('category_id', categoryId)
    .eq('type', 'expense');
  if (error) throw error;
  return (data ?? []).reduce((sum, r) => sum + Number(r.amount), 0);
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
    limit?: number;
  }
): Promise<Transaction[]> {
  let query = supabase.from('transactions').select('*').eq('user_id', userId);

  if (filters?.type) query = query.eq('type', filters.type);
  if (filters?.categoryId) query = query.eq('category_id', filters.categoryId);
  if (filters?.startDate) query = query.gte('date', filters.startDate);
  if (filters?.endDate) query = query.lte('date', filters.endDate);
  if (filters?.search) query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
  if (filters?.limit) query = query.limit(filters.limit);

  if (filters?.orderBy === 'date_asc') query = query.order('date', { ascending: true }).order('created_at', { ascending: true });
  else if (filters?.orderBy === 'amount_desc') query = query.order('amount', { ascending: false });
  else if (filters?.orderBy === 'amount_asc') query = query.order('amount', { ascending: true });
  else query = query.order('date', { ascending: false }).order('created_at', { ascending: false });

  const { data, error } = await query;
  if (error) throw error;
  return (data as Transaction[]) ?? [];
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
  const { data: row, error } = await supabase
    .from('transactions')
    .insert({
      user_id: userId,
      type: data.type,
      name: data.name,
      amount: data.amount,
      category_id: data.category_id,
      date: data.date,
      payment_method: data.payment_method,
      description: data.description,
      is_recurring: data.is_recurring ?? false,
      recurring_id: data.recurring_id ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return row as Transaction;
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
  const { data, error } = await supabase
    .from('transactions')
    .update(updates)
    .eq('id', id)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data as Transaction | null;
}

export async function deleteTransaction(id: string): Promise<void> {
  const { error } = await supabase.from('transactions').delete().eq('id', id);
  if (error) throw error;
}

// ---------- RECURRING TRANSACTIONS ----------

export async function getRecurringTransactions(userId: string): Promise<RecurringTransaction[]> {
  const { data, error } = await supabase
    .from('recurring_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('next_date', { ascending: true });
  if (error) throw error;
  return (data as RecurringTransaction[]) ?? [];
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
  const { data: rpcData, error } = await supabase.rpc('create_recurring_with_transaction', {
    p_user_id: userId,
    p_type: data.type,
    p_name: data.name,
    p_amount: data.amount,
    p_category_id: data.category_id,
    p_frequency: data.frequency,
    p_start_date: data.start_date,
    p_payment_method: data.payment_method,
    p_description: data.description,
  });
  if (error) throw error;

  // Fetch the created recurring row
  const recurringId = rpcData as string;
  const { data: row, error: fetchError } = await supabase
    .from('recurring_transactions')
    .select('*')
    .eq('id', recurringId)
    .single();
  if (fetchError) throw fetchError;
  return row as RecurringTransaction;
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
  const { data, error } = await supabase
    .from('recurring_transactions')
    .update(updates)
    .eq('id', id)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data as RecurringTransaction | null;
}

export async function deleteRecurringTransaction(id: string): Promise<void> {
  const { error } = await supabase.from('recurring_transactions').delete().eq('id', id);
  if (error) throw error;
}

// Process recurring transactions for the current user via RPC (server-side function)
export async function processRecurringTransactions(userId: string): Promise<void> {
  const { error } = await supabase.rpc('process_recurring_transactions');
  if (error) {
    // Non-fatal — the edge function cron also processes these
    console.warn('processRecurringTransactions warning:', error.message);
  }
}

// Trigger the edge function (no user session needed)
export async function triggerRecurringProcessing(): Promise<void> {
  try {
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-recurring`;
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) {
      console.warn('Recurring processing trigger failed:', response.status);
    }
  } catch (err) {
    console.warn('Recurring processing trigger error:', err);
  }
}

// ---------- BUDGETS ----------

export async function getBudgets(
  userId: string,
  month: number,
  year: number
): Promise<Budget[]> {
  const { data, error } = await supabase
    .from('budgets')
    .select('*')
    .eq('user_id', userId)
    .eq('month', month)
    .eq('year', year);
  if (error) throw error;
  return (data as Budget[]) ?? [];
}

export async function upsertBudget(
  userId: string,
  categoryId: string,
  limitAmount: number,
  month: number,
  year: number
): Promise<Budget> {
  // Check if exists
  const { data: existing } = await supabase
    .from('budgets')
    .select('id')
    .eq('user_id', userId)
    .eq('category_id', categoryId)
    .eq('month', month)
    .eq('year', year)
    .maybeSingle();

  if (existing) {
    const { data, error } = await supabase
      .from('budgets')
      .update({ limit_amount: limitAmount })
      .eq('id', (existing as { id: string }).id)
      .select()
      .single();
    if (error) throw error;
    return data as Budget;
  }

  const { data, error } = await supabase
    .from('budgets')
    .insert({
      user_id: userId,
      category_id: categoryId,
      limit_amount: limitAmount,
      month,
      year,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Budget;
}

export async function deleteBudget(id: string): Promise<void> {
  const { error } = await supabase.from('budgets').delete().eq('id', id);
  if (error) throw error;
}

export async function carryOverBudgets(
  userId: string,
  month: number,
  year: number
): Promise<void> {
  const current = await getBudgets(userId, month, year);
  if (current.length > 0) return;

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const prevBudgets = await getBudgets(userId, prevMonth, prevYear);
  for (const b of prevBudgets) {
    await upsertBudget(userId, b.category_id, b.limit_amount, month, year);
  }
}

// ---------- GOALS ----------

export async function getGoals(userId: string): Promise<Goal[]> {
  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data as Goal[]) ?? [];
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
  const { data: row, error } = await supabase
    .from('goals')
    .insert({
      user_id: userId,
      name: data.name,
      target_amount: data.target_amount,
      saved_amount: data.saved_amount ?? 0,
      target_date: data.target_date,
      color: data.color,
      icon: data.icon,
    })
    .select()
    .single();
  if (error) throw error;
  return row as Goal;
}

export async function updateGoal(
  id: string,
  updates: { name?: string; target_amount?: number; target_date?: string | null; color?: string; icon?: string }
): Promise<Goal | null> {
  const { data, error } = await supabase
    .from('goals')
    .update(updates)
    .eq('id', id)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data as Goal | null;
}

export async function deleteGoal(id: string): Promise<void> {
  const { error } = await supabase.from('goals').delete().eq('id', id);
  if (error) throw error;
}

// Atomic contribution via RPC — positive amount = deposit, negative = withdrawal
export async function addGoalContribution(
  _userId: string,
  goalId: string,
  amount: number,
  date: string
): Promise<GoalContribution> {
  const { data, error } = await supabase.rpc('add_goal_contribution', {
    p_goal_id: goalId,
    p_amount: amount,
    p_date: date,
  });
  if (error) throw error;
  return data as GoalContribution;
}

export async function getGoalContributions(goalId: string): Promise<GoalContribution[]> {
  const { data, error } = await supabase
    .from('goal_contributions')
    .select('*')
    .eq('goal_id', goalId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as GoalContribution[]) ?? [];
}

// ---------- ANALYTICS ----------

export interface MonthlySummary {
  totalIncome: number;
  totalExpense: number;
  balance: number; // resultado do mês = receitas - despesas
  expenseByCategory: { categoryId: string; categoryName: string; color: string; icon: string; total: number; percentage: number }[];
  transactionCount: number;
  dailyAverage: number;
}

export async function getMonthlySummary(
  userId: string,
  month: number,
  year: number,
  categories: Category[]
): Promise<MonthlySummary> {
  const startDate = toISODate(new Date(year, month - 1, 1));
  const endDate = toISODate(new Date(year, month, 0));
  const daysInMonth = new Date(year, month, 0).getDate();

  const { data: txs, error } = await supabase
    .from('transactions')
    .select('type, amount, category_id')
    .eq('user_id', userId)
    .gte('date', startDate)
    .lte('date', endDate);
  if (error) throw error;

  const rows = txs ?? [];
  let totalIncome = 0;
  let totalExpense = 0;
  const byCat: Record<string, number> = {};

  for (const r of rows as { type: string; amount: number; category_id: string | null }[]) {
    if (r.type === 'income') {
      totalIncome += Number(r.amount);
    } else {
      totalExpense += Number(r.amount);
      const key = r.category_id ?? 'uncategorized';
      byCat[key] = (byCat[key] ?? 0) + Number(r.amount);
    }
  }

  const expenseByCategory = Object.entries(byCat)
    .map(([catId, total]) => {
      const cat = categories.find((c) => c.id === catId);
      return {
        categoryId: catId,
        categoryName: cat?.name ?? 'Sem categoria',
        color: cat?.color ?? '#64748b',
        icon: cat?.icon ?? 'more-horizontal',
        total,
        percentage: totalExpense > 0 ? (total / totalExpense) * 100 : 0,
      };
    })
    .sort((a, b) => b.total - a.total);

  return {
    totalIncome,
    totalExpense,
    balance: totalIncome - totalExpense,
    expenseByCategory,
    transactionCount: rows.length,
    dailyAverage: totalExpense / daysInMonth,
  };
}

export async function getMonthlyTrend(
  userId: string,
  months: number,
  endMonth: number,
  endYear: number
): Promise<{ month: number; year: number; label: string; income: number; expense: number; balance: number }[]> {
  const result: { month: number; year: number; label: string; income: number; expense: number; balance: number }[] = [];

  for (let i = months - 1; i >= 0; i--) {
    let cm = endMonth;
    let cy = endYear;
    for (let j = 0; j < i; j++) {
      if (cm === 1) { cm = 12; cy = cy - 1; } else { cm = cm - 1; }
    }

    const startDate = toISODate(new Date(cy, cm - 1, 1));
    const endDate = toISODate(new Date(cy, cm, 0));

    const { data, error } = await supabase
      .from('transactions')
      .select('type, amount')
      .eq('user_id', userId)
      .gte('date', startDate)
      .lte('date', endDate);
    if (error) throw error;

    let income = 0;
    let expense = 0;
    for (const r of (data ?? []) as { type: string; amount: number }[]) {
      if (r.type === 'income') income += Number(r.amount);
      else expense += Number(r.amount);
    }

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

// Cumulative balance evolution — includes all history before the displayed period
export async function getBalanceEvolution(
  userId: string,
  months: number,
  endMonth: number,
  endYear: number
): Promise<{ label: string; balance: number; cumulative: number }[]> {
  // Calculate the start of the display period
  let startMonth = endMonth;
  let startYear = endYear;
  for (let i = 0; i < months - 1; i++) {
    if (startMonth === 1) { startMonth = 12; startYear = startYear - 1; } else { startMonth = startMonth - 1; }
  }
  const periodStart = toISODate(new Date(startYear, startMonth - 1, 1));

  // Get the sum of all income and expense BEFORE the display period for the starting balance
  const { data: preData, error: preError } = await supabase
    .from('transactions')
    .select('type, amount')
    .eq('user_id', userId)
    .lt('date', periodStart);
  if (preError) throw preError;

  let startingBalance = 0;
  for (const r of (preData ?? []) as { type: string; amount: number }[]) {
    if (r.type === 'income') startingBalance += Number(r.amount);
    else startingBalance -= Number(r.amount);
  }

  // Get monthly trends for the display period
  const trends = await getMonthlyTrend(userId, months, endMonth, endYear);

  let cumulative = startingBalance;
  return trends.map((t) => {
    cumulative += t.balance;
    return { label: t.label, balance: t.balance, cumulative };
  });
}

// Helper: get total balance across ALL transactions (for account-level info)
export async function getTotalBalance(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from('transactions')
    .select('type, amount')
    .eq('user_id', userId);
  if (error) throw error;

  let balance = 0;
  for (const r of (data ?? []) as { type: string; amount: number }[]) {
    if (r.type === 'income') balance += Number(r.amount);
    else balance -= Number(r.amount);
  }
  return balance;
}

// ---------- DATA EXPORT / IMPORT (PGlite migration) ----------

export interface ExportData {
  categories: Category[];
  transactions: Transaction[];
  recurring_transactions: RecurringTransaction[];
  budgets: Budget[];
  goals: Goal[];
  goal_contributions: GoalContribution[];
  exported_at: string;
  version: number;
}

export async function exportAllData(userId: string): Promise<ExportData> {
  const [categories, transactions, recurring, budgets, goals] = await Promise.all([
    getCategories(userId),
    getTransactions(userId),
    getRecurringTransactions(userId),
    supabase.from('budgets').select('*').eq('user_id', userId).then(r => (r.data as Budget[]) ?? []),
    getGoals(userId),
  ]);

  // Get all goal contributions
  const allContributions: GoalContribution[] = [];
  for (const g of goals) {
    const contribs = await getGoalContributions(g.id);
    allContributions.push(...contribs);
  }

  return {
    categories,
    transactions,
    recurring_transactions: recurring,
    budgets,
    goals,
    goal_contributions: allContributions,
    exported_at: new Date().toISOString(),
    version: 1,
  };
}

export function downloadJSON(data: ExportData): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `granaplus_backup_${new Date().toISOString().split('T')[0]}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

// Import data from a JSON file into Supabase — maps old category IDs to new ones
export async function importData(
  userId: string,
  data: ExportData
): Promise<{ imported: { categories: number; transactions: number; recurring: number; budgets: number; goals: number }; error?: string }> {
  try {
    const result = {
      categories: 0,
      transactions: 0,
      recurring: 0,
      budgets: 0,
      goals: 0,
    };

    // Map old category IDs to new IDs
    const categoryIdMap: Record<string, string> = {};

    // Import categories
    for (const cat of data.categories ?? []) {
      const newCat = await createCategory(userId, {
        name: cat.name,
        color: cat.color,
        icon: cat.icon,
        type: cat.type,
      });
      categoryIdMap[cat.id] = newCat.id;
      result.categories++;
    }

    // Map old recurring IDs to new IDs
    const recurringIdMap: Record<string, string> = {};

    // Import recurring transactions
    for (const rec of data.recurring_transactions ?? []) {
      const newRec = await createRecurringTransaction(userId, {
        type: rec.type,
        name: rec.name,
        amount: rec.amount,
        category_id: rec.category_id ? (categoryIdMap[rec.category_id] ?? null) : null,
        frequency: rec.frequency,
        start_date: rec.start_date,
        payment_method: rec.payment_method,
        description: rec.description,
      });
      recurringIdMap[rec.id] = newRec.id;
      result.recurring++;
    }

    // Import transactions
    for (const tx of data.transactions ?? []) {
      await createTransaction(userId, {
        type: tx.type,
        name: tx.name,
        amount: tx.amount,
        category_id: tx.category_id ? (categoryIdMap[tx.category_id] ?? null) : null,
        date: tx.date,
        payment_method: tx.payment_method,
        description: tx.description,
        is_recurring: tx.is_recurring,
        recurring_id: tx.recurring_id ? (recurringIdMap[tx.recurring_id] ?? null) : null,
      });
      result.transactions++;
    }

    // Import budgets
    for (const b of data.budgets ?? []) {
      const newCatId = categoryIdMap[b.category_id];
      if (newCatId) {
        await upsertBudget(userId, newCatId, b.limit_amount, b.month, b.year);
        result.budgets++;
      }
    }

    // Import goals + contributions
    const goalIdMap: Record<string, string> = {};
    for (const goal of data.goals ?? []) {
      const newGoal = await createGoal(userId, {
        name: goal.name,
        target_amount: goal.target_amount,
        saved_amount: 0, // will be rebuilt from contributions
        target_date: goal.target_date,
        color: goal.color,
        icon: goal.icon,
      });
      goalIdMap[goal.id] = newGoal.id;
      result.goals++;
    }

    // Import goal contributions via RPC (atomically updates saved_amount)
    for (const contrib of data.goal_contributions ?? []) {
      const newGoalId = goalIdMap[contrib.goal_id];
      if (newGoalId) {
        try {
          await addGoalContribution(userId, newGoalId, contrib.amount, contrib.date);
        } catch {
          // skip invalid contributions
        }
      }
    }

    return { imported: result };
  } catch (err) {
    return { imported: { categories: 0, transactions: 0, recurring: 0, budgets: 0, goals: 0 }, error: (err as Error).message };
  }
}

// Helper
function toISODate(date: Date): string {
  return date.toISOString().split('T')[0];
}
