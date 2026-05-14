import { InkDialog, type InkDialogState } from '@app/components/ui';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';

interface CombatResultDialogProps {
  dialogKey: string;
  open: boolean;
  title: string;
  content: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void | Promise<void>;
}

export function CombatResultDialog({
  dialogKey,
  open,
  title,
  content,
  confirmLabel = '知道了',
  cancelLabel = '先看看',
  onConfirm,
}: CombatResultDialogProps) {
  const [dismissed, setDismissed] = useState(false);

  const dialog = useMemo<InkDialogState | null>(() => {
    if (!open || dismissed) {
      return null;
    }

    return {
      id: dialogKey,
      title,
      content,
      confirmLabel,
      cancelLabel,
      onConfirm,
    };
  }, [cancelLabel, confirmLabel, content, dialogKey, dismissed, onConfirm, open, title]);

  return (
    <InkDialog
      dialog={dialog}
      onClose={() => {
        setDismissed(true);
      }}
    />
  );
}
