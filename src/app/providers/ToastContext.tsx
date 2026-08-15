import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react';
import { ToastContainer, type ToastData, type ToastIntent } from '../../shared/ui/Toast/Toast';

interface ToastContextValue {
  showToast: (message: string, options?: { title?: string; intent?: ToastIntent; duration?: number }) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const showToast = useCallback(
    (message: string, options?: { title?: string; intent?: ToastIntent; duration?: number }) => {
      const id = `toast-${++nextId}`;
      setToasts((prev) => [
        ...prev,
        { id, message, title: options?.title, intent: options?.intent ?? 'info', duration: options?.duration },
      ]);
    },
    [],
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Stable context value so consumers never re-render on provider renders.
  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}

// oxlint-disable-next-line react/only-export-components
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}
