import { AlertTriangle } from 'lucide-react';
import Modal from './Modal';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  danger = true,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <div className="flex flex-col gap-4">
        <div className="flex gap-3">
          {danger && (
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-coral-100 dark:bg-coral-900/40 flex items-center justify-center">
              <AlertTriangle size={20} className="text-coral-600 dark:text-coral-400" />
            </div>
          )}
          <p className="text-sm text-ink-600 dark:text-ink-400 pt-2">{message}</p>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button className="btn-secondary" onClick={onClose}>
            {cancelLabel}
          </button>
          <button
            className={danger ? 'btn-danger' : 'btn-primary'}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
