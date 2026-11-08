import { useState, useEffect, useCallback, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  FileBarChart,
  Download,
  TrendingUp,
  TrendingDown,
  Wallet,
  PieChart as PieIcon,
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
import { useAuth } from '@/context/AuthContext';
import { useMonth } from '@/context/MonthContext';
import { getTransactions, getMonthlyTrend, getBalanceEvolution } from '@/lib/api';
import {
  formatCurrency,
  formatCurrencyShort,
  formatDate,
  getMonthRange,
  toISODate,
  getMonthsAgo,
  downloadCSV,
} from '@/lib/format';
import type { Category, Transaction } from '@/types';
import EmptyState from '@/components/EmptyState';

interface OutletContextType {
  categories: Category[];
  refreshCategories: () => void;
  handleNewTransaction: (type: 'income' | 'expense') => void;
}

type Period = 'month' | '3months' | '6months' | 'year';

export default function ReportsPage() {
  const { user } = useAuth();
  const { month, year, label } = useMonth();
  const { categories } = useOutletContext<OutletContextType>();

  const [period, setPeriod] = useState<Period>('month');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [trend, setTrend] = useState<{ label: string; income: number; expense: number; balance: number }[]>([]);
  const [evolution, setEvolution] = useState<{ label: string; balance: number; cumulative: number }[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    let startMonth = month;
    let startYear = year;
    let months = 1;

    if (period === '3months') {
      const ago = getMonthsAgo(month, year, 2);
      startMonth = ago.month;
      startYear = ago.year;
      months = 3;
    } else if (period === '6months') {
      const ago = getMonthsAgo(month, year, 5);
      startMonth = ago.month;
      startYear = ago.year;
      months = 6;
    } else if (period === 'year') {
      startMonth = 1;
      startYear = year;
      months = 12;
    }

    const startDate = toISODate(new Date(startYear, startMonth - 1, 1));
    const endDate = toISODate(new Date(year, month, 0));

    const filters: Parameters<typeof getTransactions>[1] = {
      startDate,
      endDate,
      orderBy: 'date_desc',
    };
    if (categoryFilter !== 'all') filters.categoryId = categoryFilter;

    const [txs, t, evol] = await Promise.all([
      getTransactions(user.id, filters),
      getMonthlyTrend(user.id, months, month, year),
      getBalanceEvolution(user.id, months, month, year),
    ]);

    setTransactions(txs);
    setTrend(t);
    setEvolution(evol);
    setLoading(false);
  }, [user, period, month, year, categoryFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const summary = useMemo(() => {
    const income = transactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const byCategory: Record<string, { income: number; expense: number }> = {};
    for (const tx of transactions) {
      const key = tx.category_id ?? 'uncategorized';
      if (!byCategory[key]) byCategory[key] = { income: 0, expense: 0 };
      byCategory[key][tx.type] += tx.amount;
    }
    return { income, expense, balance: income - expense, byCategory };
  }, [transactions]);

  const categoryBreakdown = useMemo(() => {
    return Object.entries(summary.byCategory)
      .map(([catId, amounts]) => {
        const cat = categories.find((c) => c.id === catId);
        return {
          id: catId,
          name: cat?.name ?? 'Sem categoria',
          color: cat?.color ?? '#64748b',
          income: amounts.income,
          expense: amounts.expense,
          total: amounts.expense + amounts.income,
        };
      })
      .sort((a, b) => b.expense - a.expense);
  }, [summary, categories]);

  const donutData = categoryBreakdown
    .filter((c) => c.expense > 0)
    .map((c) => ({ name: c.name, value: c.expense, color: c.color }));

  const handleExportCSV = () => {
    const rows: (string | number)[][] = [
      ['Data', 'Tipo', 'Nome', 'Categoria', 'Forma de pagamento', 'Valor', 'Descrição'],
    ];
    for (const tx of transactions) {
      const cat = categories.find((c) => c.id === tx.category_id);
      rows.push([
        formatDate(tx.date),
        tx.type === 'income' ? 'Receita' : 'Despesa',
        tx.name,
        cat?.name ?? 'Sem categoria',
        tx.payment_method ?? '',
        tx.amount,
        tx.description ?? '',
      ]);
    }
    const filename = `granaplus_relatorio_${period}_${year}_${month.toString().padStart(2, '0')}.csv`;
    downloadCSV(filename, rows);
  };

  const isDark = document.documentElement.classList.contains('dark');
  const axisColor = isDark ? '#94a3b8' : '#64748b';
  const gridColor = isDark ? '#334155' : '#e2e8f0';

  const periodLabel = period === 'month' ? label :
    period === '3months' ? 'Últimos 3 meses' :
    period === '6months' ? 'Últimos 6 meses' :
    `Ano de ${year}`;

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-3 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-ink-900 dark:text-ink-100">Relatórios</h2>
          <p className="text-sm text-ink-500 dark:text-ink-400 mt-0.5">
            Analise seus gastos e receitas por período
          </p>
        </div>
        <button onClick={handleExportCSV} className="btn-secondary" disabled={transactions.length === 0}>
          <Download size={16} /> Exportar CSV
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Período</label>
          <select className="input" value={period} onChange={(e) => setPeriod(e.target.value as Period)}>
            <option value="month">Apenas {label}</option>
            <option value="3months">Últimos 3 meses</option>
            <option value="6months">Últimos 6 meses</option>
            <option value="year">Ano inteiro ({year})</option>
          </select>
        </div>
        <div>
          <label className="label">Categoria</label>
          <select className="input" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="all">Todas as categorias</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {transactions.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<FileBarChart size={28} />}
            title="Sem dados para este período"
            description="Não há movimentações no período selecionado. Tente outro período ou adicione novas movimentações."
          />
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="card p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center">
                  <TrendingUp size={20} className="text-brand-600 dark:text-brand-400" />
                </div>
                <p className="text-sm text-ink-500 dark:text-ink-400">Receitas</p>
              </div>
              <p className="text-2xl font-bold text-brand-600 dark:text-brand-400">{formatCurrency(summary.income)}</p>
            </div>
            <div className="card p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-coral-100 dark:bg-coral-900/40 flex items-center justify-center">
                  <TrendingDown size={20} className="text-coral-600 dark:text-coral-400" />
                </div>
                <p className="text-sm text-ink-500 dark:text-ink-400">Despesas</p>
              </div>
              <p className="text-2xl font-bold text-coral-600 dark:text-coral-400">{formatCurrency(summary.expense)}</p>
            </div>
            <div className="card p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-ink-100 dark:bg-ink-800 flex items-center justify-center">
                  <Wallet size={20} className="text-ink-600 dark:text-ink-400" />
                </div>
                <p className="text-sm text-ink-500 dark:text-ink-400">Saldo</p>
              </div>
              <p className={`text-2xl font-bold ${summary.balance >= 0 ? 'text-ink-900 dark:text-ink-100' : 'text-coral-600 dark:text-coral-400'}`}>
                {formatCurrency(summary.balance)}
              </p>
            </div>
          </div>

          {/* Charts */}
          {period !== 'month' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <FileBarChart size={18} className="text-ink-400" />
                  <h3 className="font-semibold text-ink-900 dark:text-ink-100">Receitas x Despesas</h3>
                </div>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                    <XAxis dataKey="label" stroke={axisColor} fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke={axisColor} fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => formatCurrencyShort(v)} />
                    <Tooltip
                      formatter={(v: any) => formatCurrency(Number(v))}
                      contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '13px', background: isDark ? '#1e293b' : '#fff', color: isDark ? '#f1f5f9' : '#0f172a' }}
                    />
                    <Legend formatter={(v: any) => <span className="text-sm text-ink-600 dark:text-ink-400">{v}</span>} iconType="circle" />
                    <Bar dataKey="income" name="Receitas" fill="#10b981" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="expense" name="Despesas" fill="#ef4444" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp size={18} className="text-ink-400" />
                  <h3 className="font-semibold text-ink-900 dark:text-ink-100">Evolução do saldo</h3>
                </div>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={evolution}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                    <XAxis dataKey="label" stroke={axisColor} fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke={axisColor} fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => formatCurrencyShort(v)} />
                    <Tooltip
                      formatter={(v: any) => formatCurrency(Number(v))}
                      contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '13px', background: isDark ? '#1e293b' : '#fff', color: isDark ? '#f1f5f9' : '#0f172a' }}
                    />
                    <Line type="monotone" dataKey="cumulative" name="Saldo acumulado" stroke="#10b981" strokeWidth={3} dot={{ fill: '#10b981', r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Category breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <PieIcon size={18} className="text-ink-400" />
                <h3 className="font-semibold text-ink-900 dark:text-ink-100">Gastos por categoria</h3>
              </div>
              {donutData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={donutData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={2} dataKey="value">
                        {donutData.map((e, i) => <Cell key={i} fill={e.color} stroke="none" />)}
                      </Pie>
                      <Tooltip
                        formatter={(v: any) => formatCurrency(Number(v))}
                        contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '13px', background: isDark ? '#1e293b' : '#fff', color: isDark ? '#f1f5f9' : '#0f172a' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2 mt-3">
                    {categoryBreakdown.filter((c) => c.expense > 0).map((c) => (
                      <div key={c.id} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: c.color }} />
                          <span className="text-ink-600 dark:text-ink-400 truncate">{c.name}</span>
                        </div>
                        <span className="text-ink-900 dark:text-ink-100 font-medium">{formatCurrency(c.expense)}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-ink-500 dark:text-ink-400 text-center py-12">Nenhuma despesa no período.</p>
              )}
            </div>

            {/* Detailed category table */}
            <div className="card p-5">
              <h3 className="font-semibold text-ink-900 dark:text-ink-100 mb-4">Detalhamento por categoria</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-ink-200 dark:border-ink-800 text-xs text-ink-500 dark:text-ink-400 uppercase">
                      <th className="text-left font-medium py-2 pr-4">Categoria</th>
                      <th className="text-right font-medium py-2 px-2">Receitas</th>
                      <th className="text-right font-medium py-2 px-2">Despesas</th>
                      <th className="text-right font-medium py-2 pl-2">Saldo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                    {categoryBreakdown.map((c) => (
                      <tr key={c.id}>
                        <td className="py-2.5 pr-4">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: c.color }} />
                            <span className="text-ink-700 dark:text-ink-300">{c.name}</span>
                          </div>
                        </td>
                        <td className="text-right py-2.5 px-2 text-brand-600 dark:text-brand-400 font-medium">{formatCurrency(c.income)}</td>
                        <td className="text-right py-2.5 px-2 text-coral-600 dark:text-coral-400 font-medium">{formatCurrency(c.expense)}</td>
                        <td className={`text-right py-2.5 pl-2 font-semibold ${c.income - c.expense >= 0 ? 'text-ink-900 dark:text-ink-100' : 'text-coral-600 dark:text-coral-400'}`}>
                          {formatCurrency(c.income - c.expense)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <p className="text-xs text-ink-400 text-center">
            {transactions.length} movimentações · {periodLabel}
          </p>
        </>
      )}
    </div>
  );
}
