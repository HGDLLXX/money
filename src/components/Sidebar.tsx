import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  TrendingDown,
  TrendingUp,
  Tags,
  Target,
  Repeat,
  PieChart,
  Settings,
  Wallet,
  LogOut,
  X,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/expenses', label: 'Despesas', icon: TrendingDown },
  { to: '/income', label: 'Receitas', icon: TrendingUp },
  { to: '/categories', label: 'Categorias', icon: Tags },
  { to: '/budgets', label: 'Orçamentos', icon: PieChart },
  { to: '/goals', label: 'Metas', icon: Target },
  { to: '/recurring', label: 'Recorrentes', icon: Repeat },
  { to: '/reports', label: 'Relatórios', icon: PieChart },
  { to: '/settings', label: 'Configurações', icon: Settings },
];

interface SidebarProps {
  mobileOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = () => {
    signOut();
    navigate('/login');
  };

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-ink-950/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 lg:z-30 h-screen w-72 bg-white dark:bg-ink-900 border-r border-ink-200 dark:border-ink-800 flex flex-col transition-transform duration-300 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-ink-200 dark:border-ink-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center">
              <Wallet size={20} className="text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-ink-900 dark:text-ink-100">
              Grana<span className="text-brand-600">+</span>
            </span>
          </div>
          <button
            className="lg:hidden rounded-lg p-1 text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-800"
            onClick={onClose}
            aria-label="Fechar menu"
          >
            <X size={20} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1 no-scrollbar">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300'
                    : 'text-ink-600 dark:text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800 hover:text-ink-900 dark:hover:text-ink-200'
                }`
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="border-t border-ink-200 dark:border-ink-800 p-3">
          <div className="flex items-center gap-3 px-3 py-2 mb-1">
            <div className="w-9 h-9 rounded-full bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center text-brand-700 dark:text-brand-300 font-semibold text-sm flex-shrink-0">
              {user?.name?.charAt(0).toUpperCase() ?? '?'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink-900 dark:text-ink-100 truncate">
                {user?.name}
              </p>
              <p className="text-xs text-ink-500 dark:text-ink-400 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-600 dark:text-ink-400 hover:bg-coral-50 dark:hover:bg-coral-900/20 hover:text-coral-600 dark:hover:text-coral-400 transition-all w-full"
          >
            <LogOut size={18} />
            Sair
          </button>
        </div>
      </aside>
    </>
  );
}
