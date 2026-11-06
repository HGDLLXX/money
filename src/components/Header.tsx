import { Menu, Sun, Moon, Monitor, ChevronLeft, ChevronRight, Plus, Calendar } from 'lucide-react';
import { useMonth } from '@/context/MonthContext';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { useState, useRef, useEffect } from 'react';
import { formatMonthYear } from '@/lib/format';

interface HeaderProps {
  onMenuClick: () => void;
  onNewTransaction: () => void;
}

export default function Header({ onMenuClick, onNewTransaction }: HeaderProps) {
  const { user } = useAuth();
  const { month, year, label, goToPrevious, goToNext, goToCurrent } = useMonth();
  const { theme, setTheme } = useTheme();
  const [themeOpen, setThemeOpen] = useState(false);
  const themeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (themeRef.current && !themeRef.current.contains(e.target as Node)) {
        setThemeOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  const firstName = user?.name?.split(' ')[0] ?? '';

  const themeIcon = theme === 'light' ? <Sun size={16} /> : theme === 'dark' ? <Moon size={16} /> : <Monitor size={16} />;

  return (
    <header className="sticky top-0 z-30 bg-white/80 dark:bg-ink-900/80 backdrop-blur-lg border-b border-ink-200 dark:border-ink-800">
      <div className="flex items-center justify-between gap-4 px-4 lg:px-8 py-3.5">
        <div className="flex items-center gap-3 min-w-0">
          <button
            className="lg:hidden rounded-lg p-2 text-ink-600 dark:text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800"
            onClick={onMenuClick}
            aria-label="Abrir menu"
          >
            <Menu size={20} />
          </button>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-ink-900 dark:text-ink-100 truncate">
              {greeting}, {firstName}
            </h1>
            <p className="text-xs text-ink-500 dark:text-ink-400 hidden sm:block">
              Acompanhe suas finanças de perto
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Month selector */}
          <div className="flex items-center gap-1 rounded-xl border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 px-1 py-1">
            <button
              onClick={goToPrevious}
              className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-800 transition-colors"
              aria-label="Mês anterior"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="flex items-center gap-1.5 px-1 min-w-[120px] justify-center">
              <Calendar size={14} className="text-ink-400" />
              <span className="text-sm font-medium text-ink-700 dark:text-ink-300 capitalize">
                {label}
              </span>
            </div>
            <button
              onClick={goToNext}
              className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-800 transition-colors"
              aria-label="Próximo mês"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Current month button */}
          <button
            onClick={goToCurrent}
            className="hidden sm:inline-flex btn-ghost text-xs"
            title="Ir para o mês atual"
          >
            Hoje
          </button>

          {/* Theme toggle */}
          <div className="relative" ref={themeRef}>
            <button
              onClick={() => setThemeOpen(!themeOpen)}
              className="rounded-xl border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 p-2 text-ink-600 dark:text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800 transition-colors"
              aria-label="Tema"
            >
              {themeIcon}
            </button>
            {themeOpen && (
              <div className="absolute right-0 mt-2 w-36 rounded-xl border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 shadow-elevated py-1 animate-scale-in z-50">
                {[
                  { value: 'light' as const, label: 'Claro', icon: <Sun size={15} /> },
                  { value: 'dark' as const, label: 'Escuro', icon: <Moon size={15} /> },
                  { value: 'system' as const, label: 'Sistema', icon: <Monitor size={15} /> },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => { setTheme(opt.value); setThemeOpen(false); }}
                    className={`flex items-center gap-2.5 w-full px-3 py-2 text-sm transition-colors ${
                      theme === opt.value
                        ? 'text-brand-600 dark:text-brand-400 font-medium'
                        : 'text-ink-600 dark:text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800'
                    }`}
                  >
                    {opt.icon}
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* New transaction */}
          <button onClick={onNewTransaction} className="btn-primary">
            <Plus size={18} />
            <span className="hidden sm:inline">Nova movimentação</span>
            <span className="sm:hidden">Nova</span>
          </button>
        </div>
      </div>
    </header>
  );
}
