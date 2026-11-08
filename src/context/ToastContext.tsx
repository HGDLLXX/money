import { createContext, useContext, useState, type ReactNode } from 'react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toasts: Toast[];
  showToast: (message: string, type?: ToastType) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = (message: string, type: ToastType = 'success') => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast }}>
      {children}
      <ToastContainer toasts={toasts} dismissToast={dismissToast} />
    </ToastContext.Provider>
  );
}

function ToastContainer({ toasts, dismissToast }: { toasts: Toast[]; dismissToast: (id: string) => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex items-center gap-3 rounded-xl px-4 py-3 shadow-elevated animate-slide-in max-w-sm ${
            toast.type === 'success'
              ? 'bg-brand-600 text-white'
              : toast.type === 'error'
              ? 'bg-coral-600 text-white'
              : 'bg-ink-800 text-white'
          }`}
          onClick={() => dismissToast(toast.id)}
          role="alert"
        >
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      ))}
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
