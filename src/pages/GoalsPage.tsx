import { useState, useEffect, useCallback } from 'react';
import {
  Target,
  Plus,
  Pencil,
  Trash2,
  TrendingUp,
  TrendingDown,
  Check,
  ArrowDownLeft,
  ArrowUpRight,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import {
  getGoals,
  createGoal,
  updateGoal,
  deleteGoal,
  addGoalContribution,
  getGoalContributions,
} from '@/lib/api';
import { formatCurrency, formatDate, todayISO, CATEGORY_COLORS, CATEGORY_ICONS } from '@/lib/format';
import type { Goal, GoalContribution } from '@/types';
import * as LucideIcons from 'lucide-react';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import EmptyState from '@/components/EmptyState';

export default function GoalsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [deleteGoalId, setDeleteGoalId] = useState<string | null>(null);
  const [contributeGoal, setContributeGoal] = useState<Goal | null>(null);
  const [contributions, setContributions] = useState<GoalContribution[]>([]);

  // Form state
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [savedAmount, setSavedAmount] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [color, setColor] = useState(CATEGORY_COLORS[0]);
  const [icon, setIcon] = useState('target');

  // Contribution form
  const [contribAmount, setContribAmount] = useState('');
  const [contribDate, setContribDate] = useState(todayISO());
  const [contribType, setContribType] = useState<'deposit' | 'withdraw'>('deposit');

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const g = await getGoals(user.id);
    setGoals(g);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = () => {
    setEditingGoal(null);
    setName('');
    setTargetAmount('');
    setSavedAmount('');
    setTargetDate('');
    setColor(CATEGORY_COLORS[0]);
    setIcon('target');
    setFormOpen(true);
  };

  const handleEdit = (goal: Goal) => {
    setEditingGoal(goal);
    setName(goal.name);
    setTargetAmount(String(goal.target_amount));
    setSavedAmount(String(goal.saved_amount));
    setTargetDate(goal.target_date ?? '');
    setColor(goal.color);
    setIcon(goal.icon);
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!user) return;
    if (!name.trim() || !targetAmount) {
      showToast('Preencha nome e valor desejado.', 'error');
      return;
    }
    const target = parseFloat(targetAmount.replace(',', '.'));
    const saved = parseFloat((savedAmount || '0').replace(',', '.')) || 0;
    if (isNaN(target) || target <= 0) {
      showToast('Informe um valor desejado válido.', 'error');
      return;
    }
    try {
      if (editingGoal) {
        await updateGoal(editingGoal.id, {
          name: name.trim(),
          target_amount: target,
          target_date: targetDate || null,
          color,
          icon,
        });
        showToast('Meta atualizada!');
      } else {
        await createGoal(user.id, {
          name: name.trim(),
          target_amount: target,
          saved_amount: saved,
          target_date: targetDate || null,
          color,
          icon,
        });
        showToast('Meta criada!');
      }
      setFormOpen(false);
      load();
    } catch {
      showToast('Erro ao salvar meta.', 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteGoalId) return;
    try {
      await deleteGoal(deleteGoalId);
      showToast('Meta excluída.');
      load();
    } catch {
      showToast('Erro ao excluir meta.', 'error');
    }
  };

  const handleOpenContribute = async (goal: Goal) => {
    setContributeGoal(goal);
    setContribAmount('');
    setContribDate(todayISO());
    setContribType('deposit');
    const contribs = await getGoalContributions(goal.id);
    setContributions(contribs);
  };

  const handleOpenWithdraw = async (goal: Goal) => {
    setContributeGoal(goal);
    setContribAmount('');
    setContribDate(todayISO());
    setContribType('withdraw');
    const contribs = await getGoalContributions(goal.id);
    setContributions(contribs);
  };

  const handleAddContribution = async () => {
    if (!user || !contributeGoal) return;
    const val = parseFloat(contribAmount.replace(',', '.'));
    if (isNaN(val) || val <= 0) {
      showToast('Informe um valor válido.', 'error');
      return;
    }
    const signedVal = contribType === 'withdraw' ? -val : val;
    try {
      await addGoalContribution(user.id, contributeGoal.id, signedVal, contribDate);
      showToast(contribType === 'withdraw' ? 'Retirada registrada!' : 'Aporte adicionado!');
      setContributeGoal(null);
      load();
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes('retirar mais')) {
        showToast('Não é possível retirar mais do que já foi guardado.', 'error');
      } else {
        showToast('Erro ao registrar movimentação.', 'error');
      }
    }
  };

  const renderIcon = (iconName: string, size = 18, color?: string) => {
    const IconComp = (LucideIcons as unknown as Record<string, React.ComponentType<{ size?: number; color?: string }>>)[iconName];
    if (!IconComp) return <Target size={size} color={color} />;
    return <IconComp size={size} color={color} />;
  };

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
          <h2 className="text-xl font-bold text-ink-900 dark:text-ink-100">Metas financeiras</h2>
          <p className="text-sm text-ink-500 dark:text-ink-400 mt-0.5">
            Defina objetivos e acompanhe sua evolução
          </p>
        </div>
        <button onClick={handleAdd} className="btn-primary">
          <Plus size={18} /> Nova meta
        </button>
      </div>

      {goals.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Target size={28} />}
            title="Nenhuma meta ainda"
            description="Crie metas de economia como uma viagem, uma reserva de emergência ou aquele item que você tanto quer."
            action={
              <button onClick={handleAdd} className="btn-primary">
                <Plus size={16} /> Criar primeira meta
              </button>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {goals.map((goal) => {
            const pct = goal.target_amount > 0 ? (goal.saved_amount / goal.target_amount) * 100 : 0;
            const completed = pct >= 100;
            return (
              <div key={goal.id} className="card p-5 group hover:shadow-soft transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: goal.color + '20' }}>
                      {renderIcon(goal.icon, 22, goal.color)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink-900 dark:text-ink-100 truncate">{goal.name}</p>
                      {goal.target_date && (
                        <p className="text-xs text-ink-500 dark:text-ink-400 mt-0.5">
                          Meta: {formatDate(goal.target_date)}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleEdit(goal)}
                      className="p-1.5 rounded-lg text-ink-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20"
                      aria-label="Editar"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => setDeleteGoalId(goal.id)}
                      className="p-1.5 rounded-lg text-ink-400 hover:text-coral-600 hover:bg-coral-50 dark:hover:bg-coral-900/20"
                      aria-label="Excluir"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                <div className="flex justify-between items-baseline mb-2">
                  <div>
                    <span className="text-lg font-bold" style={{ color: goal.color }}>
                      {formatCurrency(goal.saved_amount)}
                    </span>
                    <span className="text-xs text-ink-400 ml-2">
                      falta {formatCurrency(Math.max(goal.target_amount - goal.saved_amount, 0))}
                    </span>
                  </div>
                  <span className="text-sm text-ink-500 dark:text-ink-400">
                    de {formatCurrency(goal.target_amount)}
                  </span>
                </div>

                <div className="h-3 rounded-full bg-ink-100 dark:bg-ink-800 overflow-hidden mb-2">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(pct, 100)}%`, background: goal.color }}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className={`text-xs font-medium ${completed ? 'text-brand-600 dark:text-brand-400' : 'text-ink-500 dark:text-ink-400'}`}>
                    {completed ? (
                      <span className="flex items-center gap-1"><Check size={12} /> Meta concluída!</span>
                    ) : (
                      `${pct.toFixed(0)}% concluído`
                    )}
                  </span>
                  <div className="flex gap-3">
                    {goal.saved_amount > 0 && (
                      <button
                        onClick={() => handleOpenWithdraw(goal)}
                        className="text-xs font-medium text-coral-600 dark:text-coral-400 hover:underline flex items-center gap-1"
                      >
                        <TrendingDown size={12} /> Retirar
                      </button>
                    )}
                    {!completed && (
                      <button
                        onClick={() => handleOpenContribute(goal)}
                        className="text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1"
                      >
                        <TrendingUp size={12} /> Aportar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingGoal ? 'Editar meta' : 'Nova meta'}
      >
        <div className="space-y-4">
          <div>
            <label className="label">Nome da meta *</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Reserva de emergência"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Valor desejado *</label>
              <input
                className="input"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                placeholder="5.000,00"
                inputMode="decimal"
              />
            </div>
            <div>
              <label className="label">Já guardado</label>
              <input
                className="input"
                value={savedAmount}
                onChange={(e) => setSavedAmount(e.target.value)}
                placeholder="0,00"
                inputMode="decimal"
                disabled={!!editingGoal}
              />
            </div>
          </div>
          <div>
            <label className="label">Data prevista (opcional)</label>
            <input
              type="date"
              className="input"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Cor</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-lg transition-all flex items-center justify-center ${
                    color === c ? 'ring-2 ring-offset-2 ring-offset-white dark:ring-offset-ink-900 ring-ink-400 scale-110' : ''
                  }`}
                  style={{ background: c }}
                >
                  {color === c && <Check size={16} className="text-white" />}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Ícone</label>
            <div className="grid grid-cols-8 gap-2 max-h-32 overflow-y-auto p-1">
              {['target', 'piggy-bank', 'wallet', 'plane', 'smartphone', 'home', 'car', 'gift', 'graduation-cap', 'heart', 'star', 'trophy', 'shield', 'banknote', 'credit-card', 'briefcase'].map((ic) => (
                <button
                  key={ic}
                  onClick={() => setIcon(ic)}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all border ${
                    icon === ic
                      ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30 text-brand-600'
                      : 'border-ink-200 dark:border-ink-700 text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-800'
                  }`}
                >
                  {renderIcon(ic, 18)}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button className="btn-secondary" onClick={() => setFormOpen(false)}>Cancelar</button>
            <button className="btn-primary" onClick={handleSave}>
              {editingGoal ? 'Salvar' : 'Criar meta'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Contribute/Withdraw modal */}
      <Modal
        open={contributeGoal !== null}
        onClose={() => setContributeGoal(null)}
        title={contribType === 'withdraw' ? `Retirar de: ${contributeGoal?.name ?? ''}` : `Aportar em: ${contributeGoal?.name ?? ''}`}
        size="sm"
      >
        <div className="space-y-4">
          <div className="rounded-xl bg-ink-50 dark:bg-ink-800 p-3 flex justify-between text-sm">
            <span className="text-ink-500 dark:text-ink-400">Acumulado: {formatCurrency(contributeGoal?.saved_amount ?? 0)}</span>
            <span className="text-ink-500 dark:text-ink-400">Meta: {formatCurrency(contributeGoal?.target_amount ?? 0)}</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">{contribType === 'withdraw' ? 'Valor da retirada' : 'Valor do aporte'}</label>
              <input
                className="input"
                value={contribAmount}
                onChange={(e) => setContribAmount(e.target.value)}
                placeholder="0,00"
                inputMode="decimal"
                autoFocus
              />
            </div>
            <div>
              <label className="label">Data</label>
              <input
                type="date"
                className="input"
                value={contribDate}
                onChange={(e) => setContribDate(e.target.value)}
              />
            </div>
          </div>
          {contributions.length > 0 && (
            <div className="max-h-32 overflow-y-auto rounded-xl border border-ink-200 dark:border-ink-700">
              <p className="text-xs font-medium text-ink-500 dark:text-ink-400 px-3 py-2 border-b border-ink-200 dark:border-ink-700">
                Histórico de movimentações
              </p>
              {contributions.slice(0, 8).map((c) => (
                <div key={c.id} className="flex justify-between px-3 py-2 text-sm">
                  <span className="text-ink-500 dark:text-ink-400">{formatDate(c.date)}</span>
                  <span className={`font-medium flex items-center gap-1 ${c.amount >= 0 ? 'text-brand-600 dark:text-brand-400' : 'text-coral-600 dark:text-coral-400'}`}>
                    {c.amount >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownLeft size={12} />}
                    {c.amount >= 0 ? '+' : ''}{formatCurrency(c.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button className="btn-secondary" onClick={() => setContributeGoal(null)}>Cancelar</button>
            <button className={contribType === 'withdraw' ? 'btn-danger' : 'btn-primary'} onClick={handleAddContribution}>
              {contribType === 'withdraw' ? 'Retirar' : 'Aportar'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteGoalId !== null}
        onClose={() => setDeleteGoalId(null)}
        onConfirm={handleDelete}
        title="Excluir meta"
        message="Tem certeza que deseja excluir esta meta? Todos os aportes registrados também serão removidos."
        confirmLabel="Excluir"
      />
    </div>
  );
}
