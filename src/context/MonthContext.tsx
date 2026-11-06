import { createContext, useContext, useState, type ReactNode } from 'react';
import { getPreviousMonth, getNextMonth, formatMonthYear } from '@/lib/format';

interface MonthContextValue {
  month: number;
  year: number;
  label: string;
  setMonth: (m: number, y: number) => void;
  goToPrevious: () => void;
  goToNext: () => void;
  goToCurrent: () => void;
}

const MonthContext = createContext<MonthContextValue | null>(null);

export function MonthProvider({ children }: { children: ReactNode }) {
  const now = new Date();
  const [month, setMonthState] = useState(now.getMonth() + 1);
  const [year, setYearState] = useState(now.getFullYear());

  const setMonth = (m: number, y: number) => {
    setMonthState(m);
    setYearState(y);
  };

  const goToPrevious = () => {
    const prev = getPreviousMonth(month, year);
    setMonth(prev.month, prev.year);
  };

  const goToNext = () => {
    const next = getNextMonth(month, year);
    setMonth(next.month, next.year);
  };

  const goToCurrent = () => {
    const d = new Date();
    setMonth(d.getMonth() + 1, d.getFullYear());
  };

  return (
    <MonthContext.Provider
      value={{
        month,
        year,
        label: formatMonthYear(month, year),
        setMonth,
        goToPrevious,
        goToNext,
        goToCurrent,
      }}
    >
      {children}
    </MonthContext.Provider>
  );
}

export function useMonth() {
  const ctx = useContext(MonthContext);
  if (!ctx) throw new Error('useMonth must be used within MonthProvider');
  return ctx;
}
