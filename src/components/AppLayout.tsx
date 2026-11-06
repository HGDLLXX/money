import { useState, useEffect, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import Modal from './Modal';
import TransactionForm from './TransactionForm';
import { useAuth } from '@/context/AuthContext';
import { getCategories } from '@/lib/api';
import { processRecurringTransactions } from '@/lib/api';
import type { Category } from '@/types';

export default function AppLayout() {
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddType, setQuickAddType] = useState<'income' | 'expense'>('expense');
  const [categories, setCategories] = useState<Category[]>([]);

  const refreshCategories = useCallback(async () => {
    if (!user) return;
    const cats = await getCategories(user.id);
    setCategories(cats);
  }, [user]);

  useEffect(() => {
    refreshCategories();
  }, [refreshCategories]);

  // Process recurring transactions on mount
  useEffect(() => {
    if (user) {
      processRecurringTransactions(user.id).then(() => {
        refreshCategories();
      });
    }
  }, [user, refreshCategories]);

  const handleNewTransaction = (type: 'income' | 'expense') => {
    setQuickAddType(type);
    setQuickAddOpen(true);
  };

  return (
    <div className="flex min-h-screen bg-ink-50 dark:bg-ink-950">
      <Sidebar mobileOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          onMenuClick={() => setMobileMenuOpen(true)}
          onNewTransaction={() => handleNewTransaction('expense')}
        />
        <main className="flex-1 p-4 lg:p-8 animate-fade-in">
          <Outlet context={{ categories, refreshCategories, handleNewTransaction }} />
        </main>
      </div>

      {/* Quick add modal with type selection */}
      <Modal
        open={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        title="Nova movimentação"
        size={quickAddType ? 'md' : 'sm'}
      >
        <QuickAddWrapper
          type={quickAddType}
          setType={setQuickAddType}
          categories={categories}
          onSaved={() => {
            setQuickAddOpen(false);
            refreshCategories();
          }}
          onCancel={() => setQuickAddOpen(false)}
        />
      </Modal>
    </div>
  );
}

function QuickAddWrapper({
  type,
  setType,
  categories,
  onSaved,
  onCancel,
}: {
  type: 'income' | 'expense';
  setType: (t: 'income' | 'expense') => void;
  categories: Category[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  return (
    <div>
      <div className="flex gap-2 mb-5 p-1 rounded-xl bg-ink-100 dark:bg-ink-800">
        <button
          onClick={() => setType('expense')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
            type === 'expense'
              ? 'bg-white dark:bg-ink-900 text-coral-600 dark:text-coral-400 shadow-sm'
              : 'text-ink-500 dark:text-ink-400'
          }`}
        >
          Despesa
        </button>
        <button
          onClick={() => setType('income')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
            type === 'income'
              ? 'bg-white dark:bg-ink-900 text-brand-600 dark:text-brand-400 shadow-sm'
              : 'text-ink-500 dark:text-ink-400'
          }`}
        >
          Receita
        </button>
      </div>
      <TransactionForm
        type={type}
        categories={categories}
        onSaved={onSaved}
        onCancel={onCancel}
      />
    </div>
  );
}
