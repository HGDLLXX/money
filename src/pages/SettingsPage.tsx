import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User as UserIcon,
  Mail,
  Globe,
  Calendar,
  Wallet,
  Bell,
  Moon,
  Sun,
  Monitor,
  LogOut,
  Check,
  Tags,
  Link,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import { formatCurrency } from '@/lib/format';
import type { Theme } from '@/context/ThemeContext';

export default function SettingsPage() {
  const { user, updateUserProfile, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [monthlyBudget, setMonthlyBudget] = useState(String(user?.monthly_budget ?? 0));
  const [notifyBudget, setNotifyBudget] = useState(user?.notify_budget ?? true);
  const [notifyGoals, setNotifyGoals] = useState(user?.notify_goals ?? true);
  const [saving, setSaving] = useState(false);

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await updateUserProfile({ name: name.trim() });
      showToast('Perfil atualizado!');
    } catch {
      showToast('Erro ao salvar.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBudget = async () => {
    const val = parseFloat(monthlyBudget.replace(',', '.'));
    if (isNaN(val) || val < 0) {
      showToast('Orçamento inválido.', 'error');
      return;
    }
    setSaving(true);
    try {
      await updateUserProfile({ monthly_budget: val });
      showToast('Orçamento atualizado!');
    } catch {
      showToast('Erro ao salvar.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNotifications = async () => {
    setSaving(true);
    try {
      await updateUserProfile({ notify_budget: notifyBudget, notify_goals: notifyGoals });
      showToast('Preferências salvas!');
    } catch {
      showToast('Erro ao salvar.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleThemeChange = async (t: Theme) => {
    setTheme(t);
    if (user) {
      await updateUserProfile({ theme: t });
    }
  };

  const handleSignOut = () => {
    signOut();
    navigate('/login');
  };

  if (!user) return null;

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <h2 className="text-xl font-bold text-ink-900 dark:text-ink-100">Configurações</h2>
        <p className="text-sm text-ink-500 dark:text-ink-400 mt-0.5">
          Personalize sua conta e preferências
        </p>
      </div>

      {/* Profile */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <UserIcon size={18} className="text-ink-400" />
          <h3 className="font-semibold text-ink-900 dark:text-ink-100">Perfil</h3>
        </div>
        <div className="space-y-4">
          <div>
            <label className="label">Nome</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="label">E-mail</label>
            <div className="relative">
              <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
              <input className="input pl-11 opacity-70 cursor-not-allowed" value={email} disabled />
            </div>
            <p className="text-xs text-ink-400 mt-1">O e-mail não pode ser alterado.</p>
          </div>
          <div className="flex justify-end">
            <button onClick={handleSaveProfile} className="btn-primary" disabled={saving}>
              Salvar perfil
            </button>
          </div>
        </div>
      </div>

      {/* Appearance */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          {theme === 'dark' ? <Moon size={18} className="text-ink-400" /> : theme === 'light' ? <Sun size={18} className="text-ink-400" /> : <Monitor size={18} className="text-ink-400" />}
          <h3 className="font-semibold text-ink-900 dark:text-ink-100">Aparência</h3>
        </div>
        <label className="label">Tema</label>
        <div className="grid grid-cols-3 gap-3">
          {[
            { value: 'light' as Theme, label: 'Claro', icon: <Sun size={20} /> },
            { value: 'dark' as Theme, label: 'Escuro', icon: <Moon size={20} /> },
            { value: 'system' as Theme, label: 'Sistema', icon: <Monitor size={20} /> },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleThemeChange(opt.value)}
              className={`flex flex-col items-center gap-2 py-4 rounded-xl border-2 transition-all ${
                theme === opt.value
                  ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400'
                  : 'border-ink-200 dark:border-ink-700 text-ink-500 dark:text-ink-400 hover:border-ink-300 dark:hover:border-ink-600'
              }`}
            >
              {opt.icon}
              <span className="text-sm font-medium">{opt.label}</span>
              {theme === opt.value && <Check size={14} />}
            </button>
          ))}
        </div>
      </div>

      {/* Budget */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Wallet size={18} className="text-ink-400" />
          <h3 className="font-semibold text-ink-900 dark:text-ink-100">Orçamento mensal</h3>
        </div>
        <p className="text-sm text-ink-500 dark:text-ink-400 mb-3">
          Defina quanto você planeja gastar por mês. O dashboard usa esse valor para calcular quanto ainda resta.
        </p>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="label">Orçamento mensal (R$)</label>
            <input
              className="input"
              value={monthlyBudget}
              onChange={(e) => setMonthlyBudget(e.target.value)}
              placeholder="3.000,00"
              inputMode="decimal"
            />
          </div>
          <button onClick={handleSaveBudget} className="btn-primary" disabled={saving}>
            Salvar
          </button>
        </div>
        <p className="text-xs text-ink-400 mt-2">Orçamento atual: {formatCurrency(user.monthly_budget)}</p>
      </div>

      {/* Regional */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Globe size={18} className="text-ink-400" />
          <h3 className="font-semibold text-ink-900 dark:text-ink-100">Regional</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Moeda</label>
            <div className="input flex items-center gap-2 cursor-not-allowed opacity-70">
              <span>Real brasileiro (R$)</span>
            </div>
          </div>
          <div>
            <label className="label flex items-center gap-1.5">
              <Calendar size={14} /> Formato de data
            </label>
            <div className="input flex items-center gap-2 cursor-not-allowed opacity-70">
              <span>dd/MM/yyyy</span>
            </div>
          </div>
        </div>
        <p className="text-xs text-ink-400 mt-3">
          O Grana+ usa Real brasileiro e formato de data brasileiro por padrão.
        </p>
      </div>

      {/* Notifications */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Bell size={18} className="text-ink-400" />
          <h3 className="font-semibold text-ink-900 dark:text-ink-100">Notificações</h3>
        </div>
        <div className="space-y-3">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <p className="text-sm font-medium text-ink-700 dark:text-ink-300">Avisos de orçamento</p>
              <p className="text-xs text-ink-500 dark:text-ink-400">Alertar quando estiver próximo do limite de gastos</p>
            </div>
            <button
              onClick={() => setNotifyBudget(!notifyBudget)}
              className={`relative w-11 h-6 rounded-full transition-colors ${notifyBudget ? 'bg-brand-600' : 'bg-ink-300 dark:bg-ink-700'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${notifyBudget ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </label>
          <div className="border-t border-ink-100 dark:border-ink-800" />
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <p className="text-sm font-medium text-ink-700 dark:text-ink-300">Lembretes de metas</p>
              <p className="text-xs text-ink-500 dark:text-ink-400">Avisar sobre o progresso das suas metas de economia</p>
            </div>
            <button
              onClick={() => setNotifyGoals(!notifyGoals)}
              className={`relative w-11 h-6 rounded-full transition-colors ${notifyGoals ? 'bg-brand-600' : 'bg-ink-300 dark:bg-ink-700'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${notifyGoals ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </label>
        </div>
        <div className="flex justify-end mt-4">
          <button onClick={handleSaveNotifications} className="btn-primary" disabled={saving}>
            Salvar preferências
          </button>
        </div>
      </div>

      {/* Links */}
      <div className="card p-5">
        <h3 className="font-semibold text-ink-900 dark:text-ink-100 mb-3">Gerenciar</h3>
        <div className="space-y-1">
          <button
            onClick={() => navigate('/categories')}
            className="flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-sm text-ink-700 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-800 transition-colors"
          >
            <span className="flex items-center gap-3">
              <Tags size={16} className="text-ink-400" />
              Categorias
            </span>
            <Link size={14} className="text-ink-400" />
          </button>
        </div>
      </div>

      {/* Danger zone */}
      <div className="card p-5 border-coral-200 dark:border-coral-900/40">
        <h3 className="font-semibold text-coral-700 dark:text-coral-400 mb-3">Conta</h3>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-coral-600 dark:text-coral-400 hover:bg-coral-50 dark:hover:bg-coral-900/20 transition-colors"
        >
          <LogOut size={16} /> Sair da conta
        </button>
      </div>
    </div>
  );
}
