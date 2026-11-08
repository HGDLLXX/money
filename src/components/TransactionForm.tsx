import { useState, useEffect } from 'react';
import { Repeat } from 'lucide-react';
import type { Category, Transaction, TransactionType, PaymentMethod, RecurrenceFrequency } from '@/types';
import { PAYMENT_METHODS, todayISO } from '@/lib/format';
import { createTransaction, updateTransaction, createRecurringTransaction } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';

interface TransactionFormProps {
  type: TransactionType;
  categories: Category[];
  editingTransaction?: Transaction | null;
  onSaved: () => void;
  onCancel: () => void;
}

export default function TransactionForm({
  type,
  categories,
  editingTransaction,
  onSaved,
  onCancel,
}: TransactionFormProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [date, setDate] = useState(todayISO());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>('');
  const [description, setDescription] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState<RecurrenceFrequency>('monthly');
  const [saving, setSaving] = useState(false);

  const filteredCategories = categories.filter(
    (c) => c.type === type || c.type === 'both'
  );

  useEffect(() => {
    if (editingTransaction) {
      setName(editingTransaction.name);
      setAmount(String(editingTransaction.amount));
      setCategoryId(editingTransaction.category_id ?? '');
      setDate(editingTransaction.date);
      setPaymentMethod((editingTransaction.payment_method as PaymentMethod) ?? '');
      setDescription(editingTransaction.description ?? '');
    }
  }, [editingTransaction]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!name.trim() || !amount) {
      showToast('Preencha nome e valor.', 'error');
      return;
    }
    const amt = parseFloat(amount.replace(',', '.'));
    if (isNaN(amt) || amt <= 0) {
      showToast('Informe um valor válido.', 'error');
      return;
    }

    setSaving(true);
    try {
      if (editingTransaction) {
        await updateTransaction(editingTransaction.id, {
          name: name.trim(),
          amount: amt,
          category_id: categoryId || null,
          date,
          payment_method: (paymentMethod || null) as PaymentMethod | null,
          description: description.trim() || null,
        });
        showToast(type === 'income' ? 'Receita atualizada!' : 'Despesa atualizada!');
      } else {
        let recurringId: string | null = null;
        if (isRecurring) {
          const rec = await createRecurringTransaction(user.id, {
            type,
            name: name.trim(),
            amount: amt,
            category_id: categoryId || null,
            frequency,
            start_date: date,
            payment_method: (paymentMethod || null) as PaymentMethod | null,
            description: description.trim() || null,
          });
          recurringId = rec.id;
        }
        await createTransaction(user.id, {
          type,
          name: name.trim(),
          amount: amt,
          category_id: categoryId || null,
          date,
          payment_method: (paymentMethod || null) as PaymentMethod | null,
          description: description.trim() || null,
          is_recurring: isRecurring,
          recurring_id: recurringId,
        });
        showToast(type === 'income' ? 'Receita adicionada!' : 'Despesa adicionada!');
      }
      onSaved();
    } catch {
      showToast('Erro ao salvar. Tente novamente.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="label">Nome *</label>
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={type === 'income' ? 'Ex: Salário mensal' : 'Ex: Almoço'}
          autoFocus
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Valor *</label>
          <input
            className="input"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0,00"
            inputMode="decimal"
          />
        </div>
        <div>
          <label className="label">Data *</label>
          <input
            type="date"
            className="input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="label">Categoria</label>
        <select
          className="input"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        >
          <option value="">Sem categoria</option>
          {filteredCategories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="label">Forma de pagamento</label>
        <select
          className="input"
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod | '')}
        >
          <option value="">Selecione</option>
          {PAYMENT_METHODS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="label">Descrição (opcional)</label>
        <textarea
          className="input min-h-[72px] resize-none"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Notas adicionais..."
        />
      </div>

      {!editingTransaction && (
        <div className="rounded-xl border border-ink-200 dark:border-ink-700 p-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isRecurring}
              onChange={(e) => setIsRecurring(e.target.checked)}
              className="w-4 h-4 rounded accent-brand-600"
            />
            <Repeat size={16} className="text-ink-500" />
            <span className="text-sm font-medium text-ink-700 dark:text-ink-300">
              Movimentação recorrente
            </span>
          </label>
          {isRecurring && (
            <div className="mt-3 ml-7">
              <label className="label">Repetir</label>
              <select
                className="input"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as RecurrenceFrequency)}
              >
                <option value="weekly">Semanalmente</option>
                <option value="monthly">Mensalmente</option>
                <option value="annual">Anualmente</option>
              </select>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Salvando...' : editingTransaction ? 'Salvar alterações' : 'Adicionar'}
        </button>
      </div>
    </form>
  );
}
