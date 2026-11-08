import { type ReactNode } from 'react';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-4">
      <div className="w-16 h-16 rounded-2xl bg-ink-100 dark:bg-ink-800 flex items-center justify-center text-ink-400 dark:text-ink-500 mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-ink-800 dark:text-ink-200 mb-1">{title}</h3>
      <p className="text-sm text-ink-500 dark:text-ink-400 max-w-sm mb-6">{description}</p>
      {action}
    </div>
  );
}
