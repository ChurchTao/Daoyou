import { type ReactNode, useCallback, useMemo, useState } from 'react';
import type { InkDialogState, InkToastData } from '../ui';
import { InkDialog, InkToastHost } from '../ui';
import { DialogInput, InkUIContext, ToastInput } from './inkUIContext';

export function InkUIProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<InkToastData[]>([]);
  const [dialog, setDialog] = useState<InkDialogState | null>(null);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback(
    ({ duration = 3600, ...rest }: ToastInput) => {
      const id = `toast-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      setToasts((prev) => [...prev, { id, ...rest }]);

      if (duration > 0 && typeof window !== 'undefined') {
        window.setTimeout(() => dismissToast(id), duration);
      }

      return id;
    },
    [dismissToast],
  );

  const openDialog = useCallback((dialogConfig: DialogInput) => {
    const id = `dialog-${Date.now()}`;
    setDialog({ id, ...dialogConfig });
    return id;
  }, []);

  const closeDialog = useCallback(() => setDialog(null), []);

  const value = useMemo(
    () => ({
      pushToast,
      dismissToast,
      openDialog,
      closeDialog,
    }),
    [pushToast, dismissToast, openDialog, closeDialog],
  );

  return (
    <InkUIContext.Provider value={value}>
      {children}
      <InkToastHost toasts={toasts} onDismiss={dismissToast} />
      <InkDialog dialog={dialog} onClose={closeDialog} />
    </InkUIContext.Provider>
  );
}
