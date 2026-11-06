import { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Repeat,
  Plus,
  Pencil,
  Trash2,
  Pause,
  Play,
  Calendar,
  ArrowDownRight,
  ArrowUpRight,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import {
  getRecurringTransactions,
  createRecurringTransaction,
  updateRecurringTransaction,
  deleteRecurringTransaction,
} from '@/lib/api';
import { formatCurrency, formatDate, PAYMENT_METHODS, todayISO } from '@/lib/format';
import type { Category, RecurringTransaction, TransactionType, RecurrenceFrequency, PaymentMethod } from '@/types';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import EmptyState from '@/components/EmptyState';

interface OutletContextType {
  categories: Category[];
  refreshCategories: () => void;
  handleNewTransaction: (type: 'income' | 'expense') => void;
}

const FREQ_LABELS: Record<RecurrenceFrequency, string> = {
  weekly: 'Semanal',
  monthly: 'Mensal',
  annual: 'Anual',
};

export default function RecurringPage() {
  const { user } = useAuth();
  const { categories, refreshCategories } = useOutletContext<OutletContextType>();
  const { showToast } = useToast();

  const [items, setItems] = useState<RecurringTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringTransaction | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Form
  const [type, setType] = useState<TransactionType>('expense');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [frequency, setFrequency] = useState<RecurrenceFrequency>('monthly');
  const [startDate, setStartDate] = useState(todayISO());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>('');
  const [description, setDescription] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const data = await getRecurringTransactions(user.id);
    setItems(data);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = () => {
    setEditing(null);
    setType('expense');
    setName('');
    setAmount('');
    setCategoryId('');
    setFrequency('monthly');
    setStartDate(todayISO());
    setPaymentMethod('');
    setDescription('');
    setFormOpen(true);
  };

  const handleEdit = (item: RecurringTransaction) => {
    setEditing(item);
    setType(item.type);
    setName(item.name);
    setAmount(String(item.amount));
    setCategoryId(item.category_id ?? '');
    setFrequency(item.frequency);
    setStartDate(item.start_date);
    setPaymentMethod((item.payment_method as PaymentMethod) ?? '');
    setDescription(item.description ?? '');
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!user) return;
    if (!name.trim() || !amount) {
      showToast('Preencha nome e valor.', 'error');
      return;
    }
    const amt = parseFloat(amount.replace(',', '.'));
    if (isNaN(amt) || amt <= 0) {
      showToast('Valor inválido.', 'error');
      return;
    }
    try {
      const payload = {
        type,
        name: name.trim(),
        amount: amt,
        category_id: categoryId || null,
        frequency,
        start_date: startDate,
        payment_method: (paymentMethod || null) as PaymentMethod | null,
        description: description.trim() || null,
      };
      if (editing) {
        await updateRecurringTransaction(editing.id, {
          name: payload.name,
          amount: payload.amount,
          category_id: payload.category_id,
          frequency: payload.frequency,
          payment_method: payload.payment_method,
          description: payload.description,
        });
        showToast('Recorrência atualizada!');
      } else {
        await createRecurringTransaction(user.id, payload);
        showToast('Recorrência criada!');
      }
      setFormOpen(false);
      load();
      refreshCategories();
    } catch {
      showToast('Erro ao salvar.', 'error');
    }
  };

  const handleTogglePause = async (item: RecurringTransaction) => {
    try {
      await updateRecurringTransaction(item.id, { is_paused: !item.is_paused });
      showToast(item.is_paused ? 'Recorrência retomada.' : 'Recorrência pausada.');
      load();
    } catch {
      showToast('Erro ao alterar status.', 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteRecurringTransaction(deleteId);
      showToast('Recorrência cancelada.');
      load();
    } catch {
      showToast('Erro ao cancelar.', 'error');
    }
  };

  const filteredCategories = categories.filter(
    (c) => c.type === type || c.type === 'both'
  );

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-3 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-ink-900 dark:text-ink-100">Movimentações recorrentes</h2>
          <p className="text-sm text-ink-500 dark:text-ink-400 mt-0.5">
            Receitas e despesas que se repetem automaticamente
          </p>
        </div>
        <button onClick={handleAdd} className="btn-primary">
          <Plus size={18} /> Nova recorrência
        </button>
      </div>

      {items.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Repeat size={28} />}
            title="Nenhuma recorrência cadastrada"
            description="Crie movimentações recorrentes para salário, aluguel, assinaturas e outros lançamentos que se repetem. O sistema gera os lançamentos automaticamente nas datas previstas."
            action={
              <button onClick={handleAdd} className="btn-primary">
                <Plus size={16} /> Criar recorrência
              </button>
            }
          />
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const cat = categories.find((c) => c.id === item.category_id);
            const isExpense = item.type === 'expense';
            return (
              <div key={item.id} className={`card p-4 group ${item.is_paused ? 'opacity-60' : ''}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: (cat?.color ?? '#64748b') + '20' }}
                    >
                      {isExpense ? (
                        <ArrowDownRight size={18} className="text-coral-600 dark:text-coral-400" />
                      ) : (
                        <ArrowUpRight size={18} className="text-brand-600 dark:text-brand-400" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-ink-900 dark:text-ink-100 truncate">{item.name}</p>
                        <span className="badge bg-ink-100 dark:bg-ink-800 text-ink-600 dark:text-ink-400">
                          <Repeat size={10} /> {FREQ_LABELS[item.frequency]}
                        </span>
                        {item.is_paused && (
                          <span className="badge bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                            <Pause size={10} /> Pausada
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-ink-500 dark:text-ink-400 flex-wrap">
                        <span className={`font-semibold ${isExpense ? 'text-coral-600 dark:text-coral-400' : 'text-brand-600 dark:text-brand-400'}`}>
                          {isExpense ? '-' : '+'}{formatCurrency(item.amount)}
                        </span>
                        <span>·</span>
                        <span>{cat?.name ?? 'Sem categoria'}</span>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          <Calendar size={11} /> Próxima: {formatDate(item.next_date)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleTogglePause(item)}
                      className="p-2 rounded-lg text-ink-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                      aria-label={item.is_paused ? 'Retomar' : 'Pausar'}
                      title={item.is_paused ? 'Retomar' : 'Pausar'}
                    >
                      {item.is_paused ? <Play size={15} /> : <Pause size={15} />}
                    </button>
                    <button
                      onClick={() => handleEdit(item)}
                      className="p-2 rounded-lg text-ink-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors"
                      aria-label="Editar"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => setDeleteId(item.id)}
                      className="p-2 rounded-lg text-ink-400 hover:text-coral-600 hover:bg-coral-50 dark:hover:bg-coral-900/20 transition-colors"
                      aria-label="Cancelar"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Form modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Editar recorrência' : 'Nova recorrência'}
      >
        <div className="space-y-4">
          <div className="flex gap-2 p-1 rounded-xl bg-ink-100 dark:bg-ink-800">
            <button
              onClick={() => setType('expense')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                type === 'expense' ? 'bg-white dark:bg-ink-900 text-coral-600 shadow-sm' : 'text-ink-500'
              }`}
            >
              Despesa
            </button>
            <button
              onClick={() => setType('income')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                type === 'income' ? 'bg-white dark:bg-ink-900 text-brand-600 shadow-sm' : 'text-ink-500'
              }`}
            >
              Receita
            </button>
          </div>

          <div>
            <label className="label">Nome *</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Aluguel" autoFocus />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Valor *</label>
              <input className="input" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" inputMode="decimal" />
            </div>
            <div>
              <label className="label">Repetir</label>
              <select className="input" value={frequency} onChange={(e) => setFrequency(e.target.value as RecurrenceFrequency)}>
                <option value="weekly">Semanalmente</option>
                <option value="monthly">Mensalmente</option>
                <option value="annual">Anualmente</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Data de início</label>
              <input type="date" className="input" value={startDate} onChange={(e) => setStartDate(e.target.value)} disabled={!!editing} />
            </div>
            <div>
              <label className="label">Forma de pagamento</label>
              <select className="input" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod | '')}>
                <option value="">Selecione</option>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Categoria</label>
            <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Sem categoria</option>
              {filteredCategories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Descrição (opcional)</label>
            <textarea className="input min-h-[60px] resize-none" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Notas..." />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button className="btn-secondary" onClick={() => setFormOpen(false)}>Cancelar</button>
            <button className="btn-primary" onClick={handleSave}>
              {editing ? 'Salvar' : 'Criar recorrência'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Cancelar recorrência"
        message="Tem certeza que deseja cancelar esta recorrência? As movimentações já geradas não serão afetadas, mas novas não serão criadas automaticamente."
        confirmLabel="Cancelar recorrência"
      />
    </div>
  );
}
