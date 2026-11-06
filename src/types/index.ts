export type TransactionType = 'income' | 'expense';

export type RecurrenceFrequency = 'weekly' | 'monthly' | 'annual';

export type PaymentMethod =
  | 'cash'
  | 'debit'
  | 'credit'
  | 'pix'
  | 'transfer'
  | 'other';

export interface Profile {
  id: string;
  name: string;
  currency: string;
  date_format: string;
  monthly_budget: number;
  notify_budget: boolean;
  notify_goals: boolean;
  theme: 'light' | 'dark' | 'system';
  created_at: string;
}

export interface Category {
  id: string;
  user_id: string;
  name: string;
  color: string;
  icon: string;
  type: TransactionType | 'both';
  created_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  type: TransactionType;
  name: string;
  amount: number;
  category_id: string | null;
  date: string; // ISO date
  payment_method: PaymentMethod | null;
  description: string | null;
  is_recurring: boolean;
  recurring_id: string | null;
  created_at: string;
}

export interface RecurringTransaction {
  id: string;
  user_id: string;
  type: TransactionType;
  name: string;
  amount: number;
  category_id: string | null;
  frequency: RecurrenceFrequency;
  start_date: string;
  next_date: string;
  day_of_month: number;
  payment_method: PaymentMethod | null;
  description: string | null;
  is_paused: boolean;
  created_at: string;
}

export interface Budget {
  id: string;
  user_id: string;
  category_id: string;
  limit_amount: number;
  month: number; // 1-12
  year: number;
  created_at: string;
}

export interface Goal {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  saved_amount: number;
  target_date: string | null;
  color: string;
  icon: string;
  created_at: string;
}

export interface GoalContribution {
  id: string;
  goal_id: string;
  user_id: string;
  amount: number; // positive = deposit, negative = withdrawal
  date: string;
  created_at: string;
}
