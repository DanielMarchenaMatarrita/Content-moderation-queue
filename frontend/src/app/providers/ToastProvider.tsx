import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from 'react';
import { CheckCircle, Info, WarningCircle, X } from '@phosphor-icons/react';

type ToastTone = 'info' | 'success' | 'error';

interface ToastInput {
  title: string;
  description?: string;
  tone?: ToastTone;
}

interface ToastItem extends ToastInput {
  id: string;
}

interface ToastContextValue {
  showToast: (toast: ToastInput) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const toneIcons = {
  info: Info,
  success: CheckCircle,
  error: WarningCircle,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  function dismiss(id: string) {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }

  function showToast({ title, description, tone = 'info' }: ToastInput) {
    const id = crypto.randomUUID();
    setToasts((current) => [...current, { id, title, description, tone }]);
    window.setTimeout(() => dismiss(id), 4500);
  }

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="toast-viewport" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => {
          const Icon = toneIcons[toast.tone ?? 'info'];
          return (
            <div key={toast.id} className={`toast toast-${toast.tone ?? 'info'}`}>
              <Icon size={20} weight="fill" aria-hidden="true" />
              <div>
                <strong>{toast.title}</strong>
                {toast.description ? <p>{toast.description}</p> : null}
              </div>
              <button
                type="button"
                className="toast-dismiss"
                aria-label="Dismiss notification"
                onClick={() => dismiss(toast.id)}
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}
