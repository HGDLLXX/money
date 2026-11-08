import { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Plus,
  Pencil,
  Trash2,
  Tags,
  Check,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getCategorySpending,
} from '@/lib/api';
import { formatCurrency, CATEGORY_COLORS, CATEGORY_ICONS } from '@/lib/format';
import type { Category, TransactionType } from '@/types';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import EmptyState from '@/components/EmptyState';
import * as LucideIcons from 'lucide-react';

interface OutletContextType {
  categories: Category[];
  refreshCategories: () => void;
  handleNewTransaction: (type: 'income' | 'expense') => void;
}

type TabType = 'expense' | 'income';

export default function CategoriesPage() {
  const { user } = useAuth();
  const { categories, refreshCategories } = useOutletContext<OutletContextType>();
  const { showToast } = useToast();
  const [tab, setTab] = useState<TabType>('expense');
  const [formOpen, setFormOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [deleteCat, setDeleteCat] = useState<Category | null>(null);
  const [spendingMap, setSpendingMap] = useState<Record<string, number>>({});

  // Form state
  const [name, setName] = useState('');
  const [color, setColor] = useState(CATEGORY_COLORS[0]);
  const [icon, setIcon] = useState(CATEGORY_ICONS[0]);
  const [catType, setCatType] = useState<TransactionType | 'both'>('expense');

  // Delete reassign state
  const [reassignTo, setReassignTo] = useState<string>('none');

  const loadSpending = useCallback(async () => {
    if (!user) return;
    const map: Record<string, number> = {};
    for (const cat of categories) {
      map[cat.id] = await getCategorySpending(user.id, cat.id);
    }
    setSpendingMap(map);
  }, [user, categories]);

  useEffect(() => {
    loadSpending();
  }, [loadSpending]);

  const filteredCategories = categories.filter(
    (c) => c.type === tab || c.type === 'both'
  );

  const handleAdd = () => {
    setEditingCat(null);
    setName('');
    setColor(CATEGORY_COLORS[Math.floor(Math.random() * CATEGORY_COLORS.length)]);
    setIcon(CATEGORY_ICONS[0]);
    setCatType(tab);
    setFormOpen(true);
  };

  const handleEdit = (cat: Category) => {
    setEditingCat(cat);
    setName(cat.name);
    setColor(cat.color);
    setIcon(cat.icon);
    setCatType(cat.type);
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!user) return;
    if (!name.trim()) {
      showToast('Informe um nome para a categoria.', 'error');
      return;
    }
    try {
      if (editingCat) {
        await updateCategory(editingCat.id, { name: name.trim(), color, icon, type: catType });
        showToast('Categoria atualizada!');
      } else {
        await createCategory(user.id, { name: name.trim(), color, icon, type: catType });
        showToast('Categoria criada!');
      }
      setFormOpen(false);
      refreshCategories();
    } catch {
      showToast('Erro ao salvar categoria.', 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteCat || !user) return;
    try {
      await deleteCategory(deleteCat.id, reassignTo === 'none' ? null : reassignTo);
      showToast('Categoria excluída.');
      refreshCategories();
      setReassignTo('none');
    } catch {
      showToast('Erro ao excluir categoria.', 'error');
    }
  };

  const renderIcon = (iconName: string, size = 18, color?: string) => {
    const IconComponent = (LucideIcons as unknown as Record<string, React.ComponentType<{ size?: number; color?: string }>>)[iconName];
    if (!IconComponent) return <Tags size={size} color={color} />;
    return <IconComponent size={size} color={color} />;
  };

  // Categories available for reassignment (same type, not the one being deleted)
  const reassignOptions = categories.filter(
    (c) => c.id !== deleteCat?.id && (c.type === deleteCat?.type || c.type === 'both')
  );

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-ink-900 dark:text-ink-100">Categorias</h2>
          <p className="text-sm text-ink-500 dark:text-ink-400 mt-0.5">
            Organize seus gastos e receitas do seu jeito
          </p>
        </div>
        <button onClick={handleAdd} className="btn-primary">
          <Plus size={18} /> Nova categoria
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 rounded-xl bg-ink-100 dark:bg-ink-800 w-fit">
        <button
          onClick={() => setTab('expense')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            tab === 'expense' ? 'bg-white dark:bg-ink-900 text-ink-900 dark:text-ink-100 shadow-sm' : 'text-ink-500 dark:text-ink-400'
          }`}
        >
          Categorias de despesa
        </button>
        <button
          onClick={() => setTab('income')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            tab === 'income' ? 'bg-white dark:bg-ink-900 text-ink-900 dark:text-ink-100 shadow-sm' : 'text-ink-500 dark:text-ink-400'
          }`}
        >
          Categorias de receita
        </button>
      </div>

      {/* Grid */}
      {filteredCategories.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Tags size={28} />}
            title="Nenhuma categoria"
            description="Crie categorias personalizadas para organizar melhor suas movimentações."
            action={
              <button onClick={handleAdd} className="btn-primary">
                <Plus size={16} /> Criar categoria
              </button>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCategories.map((cat) => {
            const spent = spendingMap[cat.id] ?? 0;
            return (
              <div key={cat.id} className="card p-4 group hover:shadow-soft transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: cat.color + '20' }}
                    >
                      {renderIcon(cat.icon, 20, cat.color)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink-900 dark:text-ink-100 truncate">{cat.name}</p>
                      <p className="text-xs text-ink-500 dark:text-ink-400 capitalize">
                        {cat.type === 'both' ? 'Receitas e despesas' : cat.type === 'income' ? 'Receita' : 'Despesa'}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleEdit(cat)}
                      className="p-1.5 rounded-lg text-ink-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20"
                      aria-label="Editar"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => setDeleteCat(cat)}
                      className="p-1.5 rounded-lg text-ink-400 hover:text-coral-600 hover:bg-coral-50 dark:hover:bg-coral-900/20"
                      aria-label="Excluir"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
                <div className="border-t border-ink-100 dark:border-ink-800 pt-3">
                  <p className="text-xs text-ink-500 dark:text-ink-400">Total gasto</p>
                  <p className="text-lg font-bold text-coral-600 dark:text-coral-400 mt-0.5">
                    {formatCurrency(spent)}
                  </p>
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
        title={editingCat ? 'Editar categoria' : 'Nova categoria'}
      >
        <div className="space-y-4">
          <div>
            <label className="label">Nome</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Academia"
              autoFocus
            />
          </div>

          <div>
            <label className="label">Tipo</label>
            <div className="flex gap-2 p-1 rounded-xl bg-ink-100 dark:bg-ink-800">
              <button
                onClick={() => setCatType('expense')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                  catType === 'expense' ? 'bg-white dark:bg-ink-900 text-coral-600 shadow-sm' : 'text-ink-500'
                }`}
              >
                Despesa
              </button>
              <button
                onClick={() => setCatType('income')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                  catType === 'income' ? 'bg-white dark:bg-ink-900 text-brand-600 shadow-sm' : 'text-ink-500'
                }`}
              >
                Receita
              </button>
              <button
                onClick={() => setCatType('both')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                  catType === 'both' ? 'bg-white dark:bg-ink-900 text-ink-900 shadow-sm' : 'text-ink-500'
                }`}
              >
                Ambos
              </button>
            </div>
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
                  aria-label={`Cor ${c}`}
                >
                  {color === c && <Check size={16} className="text-white" />}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Ícone</label>
            <div className="grid grid-cols-8 gap-2 max-h-40 overflow-y-auto p-1">
              {CATEGORY_ICONS.map((ic) => (
                <button
                  key={ic}
                  onClick={() => setIcon(ic)}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all border ${
                    icon === ic
                      ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30 text-brand-600'
                      : 'border-ink-200 dark:border-ink-700 text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-800'
                  }`}
                  aria-label={`Ícone ${ic}`}
                >
                  {renderIcon(ic, 18)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button className="btn-secondary" onClick={() => setFormOpen(false)}>Cancelar</button>
            <button className="btn-primary" onClick={handleSave}>
              {editingCat ? 'Salvar' : 'Criar categoria'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete confirmation with reassign */}
      <Modal
        open={deleteCat !== null}
        onClose={() => { setDeleteCat(null); setReassignTo('none'); }}
        title="Excluir categoria"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-ink-600 dark:text-ink-400">
            Ao excluir a categoria <strong className="text-ink-900 dark:text-ink-100">{deleteCat?.name}</strong>,
            as movimentações associadas precisam ser realocadas. O histórico financeiro não será apagado.
          </p>
          <div>
            <label className="label">Mover movimentações para</label>
            <select
              className="input"
              value={reassignTo}
              onChange={(e) => setReassignTo(e.target.value)}
            >
              <option value="none">Deixar sem categoria</option>
              {reassignOptions.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button className="btn-secondary" onClick={() => { setDeleteCat(null); setReassignTo('none'); }}>
              Cancelar
            </button>
            <button className="btn-danger" onClick={handleDelete}>
              Excluir categoria
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
