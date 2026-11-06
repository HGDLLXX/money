import { useState, useEffect, useMemo, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  ArrowDownRight,
  ArrowUpRight,
  Filter,
  ArrowUpDown,
  X,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useMonth } from '@/context/MonthContext';
import { useToast } from '@/context/ToastContext';
import { getTransactions, deleteTransaction } from '@/lib/api';
import { formatCurrency, formatDate, getPaymentMethodLabel, getMonthRange, toISODate } from '@/lib/format';
import type { Category, Transaction, TransactionType } from '@/types';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import EmptyState from '@/components/EmptyState';
import TransactionForm from '@/components/TransactionForm';

interface OutletContextType {
  categories: Category[];
  refreshCategories: () => void;
  handleNewTransaction: (type: 'income' | 'expense') => void;
}

interface TransactionListProps {
  type: TransactionType;
}

export default function TransactionList({ type }: TransactionListProps) {
  const { user } = useAuth();
  const { month, year, label } = useMonth();
  const { categories, refreshCategories } = useOutletContext<OutletContextType>();
  const { showToast } = useToast();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [periodFilter, setPeriodFilter] = useState<'month' | 'all'>('month');
  const [orderBy, setOrderBy] = useState<'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc'>('date_desc');
  const [showFilters, setShowFilters] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filteredCategories = categories.filter((c) => c.type === type || c.type === 'both');

  const loadTransactions = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const filters: Parameters<typeof getTransactions>[1] = {
      type,
      orderBy,
      search: search || undefined,
    };
    if (categoryFilter !== 'all') filters.categoryId = categoryFilter;
    if (periodFilter === 'month') {
      const { start, end } = getMonthRange(month, year);
      filters.startDate = toISODate(start);
      filters.endDate = toISODate(end);
    }
    const data = await getTransactions(user.id, filters);
    setTransactions(data);
    setLoading(false);
  }, [user, type, orderBy, search, categoryFilter, periodFilter, month, year]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const handleEdit = (tx: Transaction) => {
    setEditingTx(tx);
    setFormOpen(true);
  };

  const handleAdd = () => {
    setEditingTx(null);
    setFormOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteTransaction(deleteId);
      showToast(type === 'income' ? 'Receita excluída.' : 'Despesa excluída.');
      loadTransactions();
    } catch {
      showToast('Erro ao excluir.', 'error');
    }
  };

  const total = useMemo(() => transactions.reduce((sum, tx) => sum + tx.amount, 0), [transactions]);

  const isExpense = type === 'expense';
  const pageTitle = isExpense ? 'Despesas' : 'Receitas';
  const emptyIcon = isExpense ? <ArrowDownRight size={28} /> : <ArrowUpRight size={28} />;
  const accentColor = isExpense ? 'text-coral-600 dark:text-coral-400' : 'text-brand-600 dark:text-brand-400';

  const hasFilters = search || categoryFilter !== 'all' || periodFilter !== 'month';

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-ink-900 dark:text-ink-100">{pageTitle}</h2>
          <p className="text-sm text-ink-500 dark:text-ink-400 mt-0.5">
            {periodFilter === 'month' ? `${label} · ` : ''}{transactions.length} {transactions.length === 1 ? 'lançamento' : 'lançamentos'}
          </p>
        </div>
        <button onClick={handleAdd} className="btn-primary">
          <Plus size={18} />
          <span>{isExpense ? 'Nova despesa' : 'Nova receita'}</span>
        </button>
      </div>

      {/* Total banner */}
      <div className={`card p-5 ${isExpense ? 'border-l-4 border-l-coral-500' : 'border-l-4 border-l-brand-500'}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-ink-500 dark:text-ink-400">
              {isExpense ? 'Total gasto' : 'Total recebido'}
              {periodFilter === 'month' && ` em ${label}`}
            </p>
            <p className={`text-3xl font-bold ${accentColor} mt-1`}>{formatCurrency(total)}</p>
          </div>
        </div>
      </div>

      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            className="input pl-11"
            placeholder={isExpense ? 'Buscar despesa...' : 'Buscar receita...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600"
            >
              <X size={16} />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`btn-secondary ${showFilters || hasFilters ? 'ring-2 ring-brand-500' : ''}`}
        >
          <Filter size={16} /> Filtros
        </button>
        <div className="relative">
          <select
            className="input pl-10 appearance-none cursor-pointer"
            value={orderBy}
            onChange={(e) => setOrderBy(e.target.value as typeof orderBy)}
          >
            <option value="date_desc">Mais recentes</option>
            <option value="date_asc">Mais antigas</option>
            <option value="amount_desc">Maior valor</option>
            <option value="amount_asc">Menor valor</option>
          </select>
          <ArrowUpDown size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
        </div>
      </div>

      {/* Expandable filters */}
      {showFilters && (
        <div className="card p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in">
          <div>
            <label className="label">Categoria</label>
            <select
              className="input"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="all">Todas as categorias</option>
              {filteredCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Período</label>
            <select
              className="input"
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value as 'month' | 'all')}
            >
              <option value="month">Apenas {label}</option>
              <option value="all">Todos os períodos</option>
            </select>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-3 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
        </div>
      ) : transactions.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={emptyIcon}
            title={isExpense ? 'Nenhuma despesa encontrada' : 'Nenhuma receita encontrada'}
            description={
              hasFilters
                ? 'Tente ajustar os filtros ou a busca para encontrar suas movimentações.'
                : isExpense
                ? 'Comece a registrar seus gastos para acompanhar para onde seu dinheiro está indo.'
                : 'Cadastre suas fontes de renda para saber quanto dinheiro está entrando.'
            }
            action={
              hasFilters ? (
                <button
                  className="btn-secondary"
                  onClick={() => { setSearch(''); setCategoryFilter('all'); setPeriodFilter('month'); }}
                >
                  Limpar filtros
                </button>
              ) : (
                <button onClick={handleAdd} className="btn-primary">
                  <Plus size={16} /> {isExpense ? 'Adicionar despesa' : 'Adicionar receita'}
                </button>
              )
            }
          />
        </div>
      ) : (
        <div className="card overflow-hidden">
          {/* Desktop header */}
          <div className="hidden sm:grid grid-cols-12 gap-4 px-5 py-3 border-b border-ink-200 dark:border-ink-800 text-xs font-medium text-ink-500 dark:text-ink-400 uppercase tracking-wider">
            <div className="col-span-5">Nome</div>
            <div className="col-span-3">Categoria</div>
            <div className="col-span-2">Data</div>
            <div className="col-span-2 text-right">Valor</div>
          </div>
          <div className="divide-y divide-ink-100 dark:divide-ink-800">
            {transactions.map((tx) => {
              const cat = categories.find((c) => c.id === tx.category_id);
              return (
                <div
                  key={tx.id}
                  className="grid grid-cols-12 gap-2 sm:gap-4 px-4 sm:px-5 py-3.5 items-center hover:bg-ink-50 dark:hover:bg-ink-800/40 transition-colors group"
                >
                  <div className="col-span-12 sm:col-span-5 flex items-center gap-3 min-w-0">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: (cat?.color ?? '#64748b') + '20' }}
                    >
                      {isExpense ? (
                        <ArrowDownRight size={16} className="text-coral-600 dark:text-coral-400" />
                      ) : (
                        <ArrowUpRight size={16} className="text-brand-600 dark:text-brand-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink-900 dark:text-ink-100 truncate">{tx.name}</p>
                      <p className="text-xs text-ink-500 dark:text-ink-400 sm:hidden">
                        {cat?.name ?? 'Sem categoria'} · {formatDate(tx.date)}
                      </p>
                      {tx.description && (
                        <p className="text-xs text-ink-400 dark:text-ink-500 truncate hidden sm:block">{tx.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="hidden sm:flex col-span-3 items-center gap-2 min-w-0">
                    {cat && (
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: cat.color }} />
                    )}
                    <span className="text-sm text-ink-600 dark:text-ink-400 truncate">
                      {cat?.name ?? 'Sem categoria'}
                    </span>
                  </div>
                  <div className="hidden sm:block col-span-2 text-sm text-ink-500 dark:text-ink-400">
                    {formatDate(tx.date)}
                  </div>
                  <div className="col-span-12 sm:col-span-2 flex items-center justify-between sm:justify-end gap-2">
                    <span className={`text-sm font-semibold ${accentColor}`}>
                      {isExpense ? '-' : '+'}{formatCurrency(tx.amount)}
                    </span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleEdit(tx)}
                        className="p-1.5 rounded-lg text-ink-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20"
                        aria-label="Editar"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => setDeleteId(tx.id)}
                        className="p-1.5 rounded-lg text-ink-400 hover:text-coral-600 hover:bg-coral-50 dark:hover:bg-coral-900/20"
                        aria-label="Excluir"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Edit modal */}
      <Modal
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditingTx(null); }}
        title={editingTx ? (isExpense ? 'Editar despesa' : 'Editar receita') : (isExpense ? 'Nova despesa' : 'Nova receita')}
      >
        <TransactionForm
          type={type}
          categories={categories}
          editingTransaction={editingTx}
          onSaved={() => {
            setFormOpen(false);
            setEditingTx(null);
            loadTransactions();
            refreshCategories();
          }}
          onCancel={() => { setFormOpen(false); setEditingTx(null); }}
        />
      </Modal>

      <ConfirmDialog
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Excluir movimentação"
        message="Tem certeza que deseja excluir esta movimentação? Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
      />
    </div>
  );
}
