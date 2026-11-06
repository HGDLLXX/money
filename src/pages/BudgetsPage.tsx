import { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { PieChart as PieIcon, Pencil, AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useMonth } from '@/context/MonthContext';
import { useToast } from '@/context/ToastContext';
import {
  getBudgets,
  upsertBudget,
  deleteBudget,
  carryOverBudgets,
  getTransactions,
} from '@/lib/api';
import { formatCurrency, getMonthRange, toISODate } from '@/lib/format';
import type { Category, Budget, Transaction } from '@/types';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import EmptyState from '@/components/EmptyState';

interface OutletContextType {
  categories: Category[];
  refreshCategories: () => void;
  handleNewTransaction: (type: 'income' | 'expense') => void;
}

export default function BudgetsPage() {
  const { user } = useAuth();
  const { month, year, label } = useMonth();
  const { categories, refreshCategories } = useOutletContext<OutletContextType>();
  const { showToast } = useToast();

  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [expenses, setExpenses] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [deleteBudgetId, setDeleteBudgetId] = useState<string | null>(null);

  const expenseCategories = categories.filter((c) => c.type === 'expense' || c.type === 'both');

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    await carryOverBudgets(user.id, month, year);
    const buds = await getBudgets(user.id, month, year);
    setBudgets(buds);

    const { start, end } = getMonthRange(month, year);
    const txs = await getTransactions(user.id, {
      type: 'expense',
      startDate: toISODate(start),
      endDate: toISODate(end),
    });
    const map: Record<string, number> = {};
    for (const tx of txs as Transaction[]) {
      const key = tx.category_id ?? 'uncategorized';
      map[key] = (map[key] ?? 0) + tx.amount;
    }
    setExpenses(map);
    setLoading(false);
  }, [user, month, year]);

  useEffect(() => {
    load();
  }, [load]);

  const getBudget = (catId: string): Budget | undefined =>
    budgets.find((b) => b.category_id === catId);

  const handleEdit = (catId: string) => {
    const b = getBudget(catId);
    setEditingCatId(catId);
    setEditValue(b ? String(b.limit_amount) : '');
  };

  const handleSave = async () => {
    if (!user || !editingCatId) return;
    const val = parseFloat(editValue.replace(',', '.'));
    if (isNaN(val) || val < 0) {
      showToast('Informe um valor válido.', 'error');
      return;
    }
    try {
      await upsertBudget(user.id, editingCatId, val, month, year);
      showToast('Orçamento salvo!');
      setEditingCatId(null);
      load();
      refreshCategories();
    } catch {
      showToast('Erro ao salvar orçamento.', 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteBudgetId) return;
    try {
      await deleteBudget(deleteBudgetId);
      showToast('Orçamento removido.');
      load();
    } catch {
      showToast('Erro ao remover orçamento.', 'error');
    }
  };

  const totalBudget = budgets.reduce((sum, b) => sum + b.limit_amount, 0);
  const totalSpent = budgets.reduce((sum, b) => sum + (expenses[b.category_id] ?? 0), 0);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-3 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div>
        <h2 className="text-xl font-bold text-ink-900 dark:text-ink-100">Orçamentos por categoria</h2>
        <p className="text-sm text-ink-500 dark:text-ink-400 mt-0.5">
          Defina limites de gastos para cada categoria em {label}
        </p>
      </div>

      {/* Summary banner */}
      {budgets.length > 0 && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-ink-500 dark:text-ink-400">Orçamento total vs. gasto</p>
            <span className="text-xs font-medium text-ink-400">
              {totalSpent > 0 && totalBudget > 0 ? ((totalSpent / totalBudget) * 100).toFixed(0) : 0}% usado
            </span>
          </div>
          <div className="flex items-end justify-between mb-3">
            <div>
              <p className="text-2xl font-bold text-ink-900 dark:text-ink-100">{formatCurrency(totalBudget)}</p>
              <p className="text-xs text-ink-400 mt-0.5">Orçado</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-coral-600 dark:text-coral-400">{formatCurrency(totalSpent)}</p>
              <p className="text-xs text-ink-400 mt-0.5">Gasto</p>
            </div>
          </div>
          <div className="h-3 rounded-full bg-ink-100 dark:bg-ink-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                totalSpent / totalBudget >= 1 ? 'bg-coral-500' : totalSpent / totalBudget >= 0.8 ? 'bg-amber-500' : 'bg-brand-500'
              }`}
              style={{ width: `${Math.min((totalSpent / totalBudget) * 100, 100)}%` }}
            />
          </div>
        </div>
      )}

      {expenseCategories.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<PieIcon size={28} />}
            title="Nenhuma categoria de despesa"
            description="Crie categorias primeiro para depois definir orçamentos."
          />
        </div>
      ) : (
        <div className="space-y-3">
          {expenseCategories.map((cat) => {
            const budget = getBudget(cat.id);
            const spent = expenses[cat.id] ?? 0;
            const limit = budget?.limit_amount ?? 0;
            const pct = limit > 0 ? (spent / limit) * 100 : 0;
            const remaining = limit - spent;
            const status: 'normal' | 'warning' | 'exceeded' =
              !budget ? 'normal' : pct >= 100 ? 'exceeded' : pct >= 80 ? 'warning' : 'normal';

            const statusColor =
              status === 'exceeded' ? 'text-coral-600 dark:text-coral-400' :
              status === 'warning' ? 'text-amber-600 dark:text-amber-400' :
              'text-brand-600 dark:text-brand-400';

            const barColor =
              status === 'exceeded' ? 'bg-coral-500' :
              status === 'warning' ? 'bg-amber-500' :
              'bg-brand-500';

            return (
              <div key={cat.id} className="card p-4 group">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: cat.color + '20' }}>
                      <div className="w-3 h-3 rounded-full" style={{ background: cat.color }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink-900 dark:text-ink-100 truncate">{cat.name}</p>
                      {budget ? (
                        <p className={`text-xs ${statusColor} flex items-center gap-1`}>
                          {status === 'exceeded' && <AlertTriangle size={11} />}
                          {status === 'normal' && <CheckCircle2 size={11} />}
                          {status === 'exceeded'
                            ? `Excedido em ${formatCurrency(Math.abs(remaining))}`
                            : status === 'warning'
                            ? `Restam ${formatCurrency(remaining)}`
                            : `${formatCurrency(remaining)} disponível`}
                        </p>
                      ) : (
                        <p className="text-xs text-ink-400">Sem orçamento definido</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-sm font-semibold text-ink-900 dark:text-ink-100">
                        {formatCurrency(spent)}
                      </p>
                      <p className="text-xs text-ink-400">
                        de {budget ? formatCurrency(limit) : '—'}
                      </p>
                    </div>
                    <button
                      onClick={() => handleEdit(cat.id)}
                      className="p-2 rounded-lg text-ink-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors"
                      aria-label="Editar orçamento"
                    >
                      <Pencil size={15} />
                    </button>
                    {budget && (
                      <button
                        onClick={() => setDeleteBudgetId(budget.id)}
                        className="p-2 rounded-lg text-ink-400 hover:text-coral-600 hover:bg-coral-50 dark:hover:bg-coral-900/20 transition-colors opacity-0 group-hover:opacity-100"
                        aria-label="Remover orçamento"
                      >
                        <X size={15} />
                      </button>
                    )}
                  </div>
                </div>
                {budget && (
                  <div className="h-2.5 rounded-full bg-ink-100 dark:bg-ink-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Edit modal */}
      <Modal
        open={editingCatId !== null}
        onClose={() => setEditingCatId(null)}
        title="Definir orçamento"
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="label">Limite de gastos para {expenseCategories.find((c) => c.id === editingCatId)?.name ?? ''}</label>
            <input
              className="input"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              placeholder="0,00"
              inputMode="decimal"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-3">
            <button className="btn-secondary" onClick={() => setEditingCatId(null)}>Cancelar</button>
            <button className="btn-primary" onClick={handleSave}>Salvar</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteBudgetId !== null}
        onClose={() => setDeleteBudgetId(null)}
        onConfirm={handleDelete}
        title="Remover orçamento"
        message="Tem certeza que deseja remover este orçamento? Você pode criá-lo novamente a qualquer momento."
        confirmLabel="Remover"
      />
    </div>
  );
}
