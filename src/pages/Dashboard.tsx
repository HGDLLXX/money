import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  PieChart as PieChartIcon,
  BarChart3,
  Target,
  ChevronRight,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  LineChart,
  Line,
} from 'recharts';
import { useOutletContext } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useMonth } from '@/context/MonthContext';
import {
  getMonthlySummary,
  getMonthlyTrend,
  getBalanceEvolution,
  getTransactions,
  getGoals,
  type MonthlySummary,
} from '@/lib/api';
import {
  formatCurrency,
  formatCurrencyShort,
  getPreviousMonth,
  formatMonthYear,
  formatDate,
} from '@/lib/format';
import type { Category, Transaction, Goal } from '@/types';

interface OutletContextType {
  categories: Category[];
  refreshCategories: () => void;
  handleNewTransaction: (type: 'income' | 'expense') => void;
}

export default function Dashboard() {
  const { user } = useAuth();
  const { month, year, label } = useMonth();
  const { categories, handleNewTransaction } = useOutletContext<OutletContextType>();
  const [summary, setSummary] = useState<MonthlySummary | null>(null);
  const [prevSummary, setPrevSummary] = useState<MonthlySummary | null>(null);
  const [trend, setTrend] = useState<{ label: string; income: number; expense: number; balance: number }[]>([]);
  const [balanceEvolution, setBalanceEvolution] = useState<{ label: string; balance: number; cumulative: number }[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    (async () => {
      const [s, prev, t, evol, recent, g] = await Promise.all([
        getMonthlySummary(user.id, month, year, categories),
        getMonthlySummary(user.id, getPreviousMonth(month, year).month, getPreviousMonth(month, year).year, categories),
        getMonthlyTrend(user.id, 6, month, year),
        getBalanceEvolution(user.id, 6, month, year),
        getTransactions(user.id, { orderBy: 'date_desc' }),
        getGoals(user.id),
      ]);
      setSummary(s);
      setPrevSummary(prev);
      setTrend(t);
      setBalanceEvolution(evol);
      setRecentTransactions(recent.slice(0, 6));
      setGoals(g);
      setLoading(false);
    })();
  }, [user, month, year, categories]);

  const balanceChange = useMemo(() => {
    if (!summary || !prevSummary) return null;
    const prev = prevSummary.balance;
    if (prev === 0) return null;
    return ((summary.balance - prev) / Math.abs(prev)) * 100;
  }, [summary, prevSummary]);

  const budgetUsed = useMemo(() => {
    if (!user || !summary) return 0;
    const budget = user.monthly_budget || 0;
    if (budget <= 0) return 0;
    return (summary.totalExpense / budget) * 100;
  }, [user, summary]);

  const budgetRemaining = (user?.monthly_budget ?? 0) - (summary?.totalExpense ?? 0);

  const donutData = useMemo(() => {
    if (!summary) return [];
    return summary.expenseByCategory.map((c) => ({
      name: c.categoryName,
      value: c.total,
      color: c.color,
      percentage: c.percentage,
    }));
  }, [summary]);

  const isDark = document.documentElement.classList.contains('dark');
  const axisColor = isDark ? '#94a3b8' : '#64748b';
  const gridColor = isDark ? '#334155' : '#e2e8f0';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-3 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Balance */}
        <div className="card p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-brand-50 dark:bg-brand-900/20 rounded-full -translate-y-8 translate-x-8" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center">
                <Wallet size={20} className="text-brand-600 dark:text-brand-400" />
              </div>
              {balanceChange !== null && (
                <span className={`badge ${balanceChange >= 0 ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300' : 'bg-coral-50 text-coral-700 dark:bg-coral-900/30 dark:text-coral-300'}`}>
                  {balanceChange >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                  {Math.abs(balanceChange).toFixed(1)}%
                </span>
              )}
            </div>
            <p className="text-sm text-ink-500 dark:text-ink-400 mb-1">Resultado do mês</p>
            <p className={`text-2xl font-bold ${summary && summary.balance >= 0 ? 'text-ink-900 dark:text-ink-100' : 'text-coral-600 dark:text-coral-400'}`}>
              {formatCurrency(summary?.balance ?? 0)}
            </p>
            <p className="text-xs text-ink-400 mt-1">
              {prevSummary && balanceChange !== null
                ? `${balanceChange >= 0 ? '+' : ''}${formatCurrency(summary!.balance - prevSummary.balance)} vs. mês anterior`
                : 'Sem comparação ainda'}
            </p>
          </div>
        </div>

        {/* Income */}
        <div className="card p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-brand-50 dark:bg-brand-900/20 rounded-full -translate-y-8 translate-x-8" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center">
                <TrendingUp size={20} className="text-brand-600 dark:text-brand-400" />
              </div>
            </div>
            <p className="text-sm text-ink-500 dark:text-ink-400 mb-1">Total de receitas</p>
            <p className="text-2xl font-bold text-brand-600 dark:text-brand-400">
              {formatCurrency(summary?.totalIncome ?? 0)}
            </p>
            <p className="text-xs text-ink-400 mt-1 capitalize">{label}</p>
          </div>
        </div>

        {/* Expense */}
        <div className="card p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-coral-50 dark:bg-coral-900/20 rounded-full -translate-y-8 translate-x-8" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-coral-100 dark:bg-coral-900/40 flex items-center justify-center">
                <TrendingDown size={20} className="text-coral-600 dark:text-coral-400" />
              </div>
            </div>
            <p className="text-sm text-ink-500 dark:text-ink-400 mb-1">Total de despesas</p>
            <p className="text-2xl font-bold text-coral-600 dark:text-coral-400">
              {formatCurrency(summary?.totalExpense ?? 0)}
            </p>
            <p className="text-xs text-ink-400 mt-1 capitalize">{label}</p>
          </div>
        </div>

        {/* Budget remaining */}
        <div className="card p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-50 dark:bg-amber-900/20 rounded-full -translate-y-8 translate-x-8" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                <PiggyBank size={20} className="text-amber-600 dark:text-amber-400" />
              </div>
              <span className="text-xs font-medium text-ink-500 dark:text-ink-400">
                {budgetUsed.toFixed(0)}% usado
              </span>
            </div>
            <p className="text-sm text-ink-500 dark:text-ink-400 mb-1">Orçamento restante</p>
            <p className={`text-2xl font-bold ${budgetRemaining >= 0 ? 'text-ink-900 dark:text-ink-100' : 'text-coral-600 dark:text-coral-400'}`}>
              {formatCurrency(budgetRemaining)}
            </p>
            <div className="mt-2 h-2 rounded-full bg-ink-100 dark:bg-ink-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  budgetUsed >= 100 ? 'bg-coral-500' : budgetUsed >= 80 ? 'bg-amber-500' : 'bg-brand-500'
                }`}
                style={{ width: `${Math.min(budgetUsed, 100)}%` }}
              />
            </div>
            <p className="text-xs text-ink-400 mt-1.5">
              Orçamento: {formatCurrency(user?.monthly_budget ?? 0)}
            </p>
          </div>
        </div>
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Donut chart */}
        <div className="card p-5 lg:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <PieChartIcon size={18} className="text-ink-400" />
              <h3 className="font-semibold text-ink-900 dark:text-ink-100">Gastos por categoria</h3>
            </div>
          </div>
          {donutData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <PieChartIcon size={32} className="text-ink-300 dark:text-ink-700 mb-2" />
              <p className="text-sm text-ink-500 dark:text-ink-400">
                Nenhuma despesa neste mês ainda.
              </p>
              <button
                onClick={() => handleNewTransaction('expense')}
                className="btn-primary mt-4"
              >
                <Plus size={16} /> Adicionar despesa
              </button>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={donutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {donutData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any, _name: any, props: any) => [
                      formatCurrency(Number(value)),
                      `${(props.payload as { percentage: number }).percentage.toFixed(1)}%`,
                    ]}
                    contentStyle={{
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                      fontSize: '13px',
                      background: isDark ? '#1e293b' : '#fff',
                      color: isDark ? '#f1f5f9' : '#0f172a',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-3">
                {donutData.slice(0, 5).map((entry, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: entry.color }} />
                      <span className="text-ink-600 dark:text-ink-400 truncate">{entry.name}</span>
                    </div>
                    <span className="text-ink-900 dark:text-ink-100 font-medium ml-2">
                      {entry.percentage.toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Income vs Expense bar chart */}
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 size={18} className="text-ink-400" />
              <h3 className="font-semibold text-ink-900 dark:text-ink-100">Receitas x Despesas</h3>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis dataKey="label" stroke={axisColor} fontSize={12} tickLine={false} axisLine={false} />
              <YAxis
                stroke={axisColor}
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => formatCurrencyShort(v)}
              />
              <Tooltip
                formatter={(value: any) => formatCurrency(Number(value))}
                contentStyle={{
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  fontSize: '13px',
                  background: isDark ? '#1e293b' : '#fff',
                  color: isDark ? '#f1f5f9' : '#0f172a',
                }}
              />
              <Legend
                formatter={(v: any) => <span className="text-sm text-ink-600 dark:text-ink-400">{v}</span>}
                iconType="circle"
              />
              <Bar dataKey="income" name="Receitas" fill="#10b981" radius={[6, 6, 0, 0]} />
              <Bar dataKey="expense" name="Despesas" fill="#ef4444" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Balance evolution + recent transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Balance evolution line chart */}
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={18} className="text-ink-400" />
            <h3 className="font-semibold text-ink-900 dark:text-ink-100">Evolução acumulada do resultado</h3>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={balanceEvolution}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis dataKey="label" stroke={axisColor} fontSize={12} tickLine={false} axisLine={false} />
              <YAxis
                stroke={axisColor}
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => formatCurrencyShort(v)}
              />
              <Tooltip
                formatter={(value: any) => formatCurrency(Number(value))}
                contentStyle={{
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  fontSize: '13px',
                  background: isDark ? '#1e293b' : '#fff',
                  color: isDark ? '#f1f5f9' : '#0f172a',
                }}
              />
              <Line
                type="monotone"
                dataKey="cumulative"
                name="Resultado acumulado"
                stroke="#10b981"
                strokeWidth={3}
                dot={{ fill: '#10b981', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Recent transactions */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-ink-900 dark:text-ink-100">Movimentações recentes</h3>
            <Link to="/expenses" className="text-xs text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-0.5">
              Ver tudo <ChevronRight size={14} />
            </Link>
          </div>
          {recentTransactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Wallet size={28} className="text-ink-300 dark:text-ink-700 mb-2" />
              <p className="text-sm text-ink-500 dark:text-ink-400 mb-3">
                Nenhuma movimentação ainda.
              </p>
              <button onClick={() => handleNewTransaction('expense')} className="btn-primary text-sm">
                <Plus size={16} /> Começar
              </button>
            </div>
          ) : (
            <div className="space-y-1">
              {recentTransactions.map((tx) => {
                const cat = categories.find((c) => c.id === tx.category_id);
                return (
                  <div key={tx.id} className="flex items-center gap-3 py-2.5 px-2 -mx-2 rounded-lg hover:bg-ink-50 dark:hover:bg-ink-800/50 transition-colors">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: (cat?.color ?? '#64748b') + '20' }}
                    >
                      {tx.type === 'income' ? (
                        <ArrowUpRight size={16} className="text-brand-600" />
                      ) : (
                        <ArrowDownRight size={16} className="text-coral-600" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink-900 dark:text-ink-100 truncate">{tx.name}</p>
                      <p className="text-xs text-ink-500 dark:text-ink-400">
                        {cat?.name ?? 'Sem categoria'} · {formatDate(tx.date)}
                      </p>
                    </div>
                    <span className={`text-sm font-semibold flex-shrink-0 ${tx.type === 'income' ? 'text-brand-600 dark:text-brand-400' : 'text-coral-600 dark:text-coral-400'}`}>
                      {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Goals preview */}
      {goals.length > 0 && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Target size={18} className="text-ink-400" />
              <h3 className="font-semibold text-ink-900 dark:text-ink-100">Suas metas</h3>
            </div>
            <Link to="/goals" className="text-xs text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-0.5">
              Gerenciar <ChevronRight size={14} />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {goals.slice(0, 3).map((goal) => {
              const pct = goal.target_amount > 0 ? (goal.saved_amount / goal.target_amount) * 100 : 0;
              return (
                <div key={goal.id} className="rounded-xl border border-ink-200 dark:border-ink-700 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: goal.color + '20' }}>
                      <Target size={16} style={{ color: goal.color }} />
                    </div>
                    <span className="text-sm font-medium text-ink-900 dark:text-ink-100 truncate">{goal.name}</span>
                  </div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-ink-500 dark:text-ink-400">{formatCurrency(goal.saved_amount)}</span>
                    <span className="text-ink-500 dark:text-ink-400">{formatCurrency(goal.target_amount)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-ink-100 dark:bg-ink-800 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(pct, 100)}%`, background: goal.color }} />
                  </div>
                  <p className="text-xs text-ink-400 mt-1.5">{pct.toFixed(0)}% concluído</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {summary && summary.transactionCount === 0 && donutData.length === 0 && recentTransactions.length === 0 && (
        <div className="card p-8 text-center">
          <h3 className="text-lg font-semibold text-ink-800 dark:text-ink-200 mb-2">
            Bem-vindo ao Grana<span className="text-brand-600">+</span>!
          </h3>
          <p className="text-sm text-ink-500 dark:text-ink-400 max-w-md mx-auto mb-4">
            Comece adicionando sua primeira movimentação para acompanhar seus ganhos e gastos.
            Você também pode definir um orçamento mensal nas configurações.
          </p>
          <div className="flex justify-center gap-3">
            <button onClick={() => handleNewTransaction('expense')} className="btn-primary">
              <Plus size={16} /> Adicionar despesa
            </button>
            <button onClick={() => handleNewTransaction('income')} className="btn-secondary">
              <Plus size={16} /> Adicionar receita
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
