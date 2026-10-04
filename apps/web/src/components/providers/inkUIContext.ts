import type { InkDialogState, InkToastData } from '@app/components/ui';
import { createContext } from 'react';

export type ToastInput = Omit<InkToastData, 'id'> & { duration?: number };
export type DialogInput = Omit<InkDialogState, 'id'>;

export interface InkUIContextValue {
  pushToast: (toast: ToastInput) => string;
  dismissToast: (id: string) => void;
  openDialog: (dialog: DialogInput) => string;
  closeDialog: () => void;
}

export const InkUIContext = createContext<InkUIContextValue | null>(null);
