export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value || 0);
}

export function formatCurrencyShort(value: number): string {
  if (Math.abs(value) >= 1000) {
    return `R$ ${(value / 1000).toLocaleString('pt-BR', {
      maximumFractionDigits: 1,
    })}k`;
  }
  return formatCurrency(value);
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date + 'T00:00:00') : date;
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatDateLong(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date + 'T00:00:00') : date;
  return d.toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatMonthYear(month: number, year: number): string {
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

export function toISODate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function parseISODate(iso: string): Date {
  return new Date(iso + 'T00:00:00');
}

export function getMonthRange(month: number, year: number): { start: Date; end: Date } {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0); // last day of month
  return { start, end };
}

export function getPreviousMonth(month: number, year: number): { month: number; year: number } {
  if (month === 1) return { month: 12, year: year - 1 };
  return { month: month - 1, year };
}

export function getNextMonth(month: number, year: number): { month: number; year: number } {
  if (month === 12) return { month: 1, year: year + 1 };
  return { month: month + 1, year };
}

export function getMonthsAgo(month: number, year: number, count: number): { month: number; year: number } {
  let m = month;
  let y = year;
  for (let i = 0; i < count; i++) {
    const prev = getPreviousMonth(m, y);
    m = prev.month;
    y = prev.year;
  }
  return { month: m, year: y };
}

export const PAYMENT_METHODS: { value: string; label: string }[] = [
  { value: 'cash', label: 'Dinheiro' },
  { value: 'debit', label: 'Débito' },
  { value: 'credit', label: 'Crédito' },
  { value: 'pix', label: 'Pix' },
  { value: 'transfer', label: 'Transferência' },
  { value: 'other', label: 'Outro' },
];

export function getPaymentMethodLabel(method: string | null): string {
  if (!method) return '—';
  return PAYMENT_METHODS.find((m) => m.value === method)?.label ?? method;
}

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

export function addWeeks(date: Date, weeks: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + weeks * 7);
  return d;
}

export function addYears(date: Date, years: number): Date {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + years);
  return d;
}

export const CATEGORY_COLORS = [
  '#10b981', '#3b82f6', '#f97316', '#a855f7', '#ec4899',
  '#84cc16', '#0891b2', '#ef4444', '#f59e0b', '#14b8a6',
  '#6366f1', '#d946ef', '#22c55e', '#0d9488', '#64748b',
];

export const CATEGORY_ICONS = [
  'utensils', 'shopping-cart', 'ticket', 'shopping-bag', 'car',
  'heart-pulse', 'home', 'graduation-cap', 'repeat', 'receipt',
  'more-horizontal', 'briefcase', 'zap', 'laptop', 'tag',
  'gift', 'plus-circle', 'plane', 'smartphone', 'dumbbell',
  'coffee', 'gamepad-2', 'book', 'pill', 'baby',
  'piggy-bank', 'target', 'wallet', 'credit-card', 'banknote',
];

export function downloadCSV(filename: string, rows: (string | number)[][]): void {
  const csvContent = rows
    .map((row) =>
      row
        .map((cell) => {
          const str = String(cell ?? '');
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        })
        .join(',')
    )
    .join('\n');

  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}
